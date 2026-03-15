import fs from "fs";
import path from "path";
import {
  createCheckpoint,
  getCheckpointPath,
  persistTokenUsage,
  readCheckpoint,
  writeCheckpoint,
} from "../lib/checkpoint.js";
import { loadConfig } from "../lib/config.js";
import { DEFAULT_CONFIG, TASKS_DIR } from "../lib/constants.js";
import { startLiveProgress } from "../lib/live-progress.js";
import * as logger from "../lib/logger.js";
import { buildWebhookPayload, sendNotification } from "../lib/notifications.js";
import { invokeClaude, isClaudeInstalled } from "../lib/subprocess.js";
import { TokenTracker } from "../lib/token-tracker.js";
import type { CheckpointFile, KovaConfig } from "../types.js";
import { parsePlanTasks } from "./plan.js";

export interface BuildOptions {
  resume?: boolean;
  parallel?: number;
  modelOverride?: string;
  dryRun?: boolean;
  verbose?: boolean;
  validate?: boolean;
  live?: boolean;
}

/**
 * Find the most-recently modified .md file in tasksDir that is not an archive
 * and not a .progress.json file. Returns the absolute path or null.
 */
export function getLatestPlan(tasksDir: string): string | null {
  if (!fs.existsSync(tasksDir)) return null;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(tasksDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const planFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        !e.name.endsWith(".progress.json"),
    )
    .map((e) => {
      const fullPath = path.join(tasksDir, e.name);
      try {
        const stat = fs.statSync(fullPath);
        return { fullPath, mtime: stat.mtimeMs };
      } catch {
        return { fullPath, mtime: 0 };
      }
    });

  if (planFiles.length === 0) return null;
  planFiles.sort((a, b) => b.mtime - a.mtime);
  return planFiles[0]!.fullPath;
}

function displayDryRun(planPath: string, content: string): void {
  const planName = path.basename(planPath, ".md");
  logger.header(`Dry Run: ${planName}`);
  logger.info("Tasks that would be executed:");
  console.log();

  const tasks = parsePlanTasks(content);
  if (tasks.length === 0) {
    logger.warn("No tasks parsed from plan. Check plan format.");
    return;
  }

  for (const task of tasks) {
    const model = task.model ?? "auto";
    const agent = task.agent_type || task.assigned_to || "unassigned";
    const depStr =
      task.depends_on.length > 0
        ? `  depends: ${task.depends_on.join(", ")}`
        : "";
    logger.info(`  [${model}]  ${task.name}  (${agent})${depStr}`);
  }

  console.log();
  logger.table([
    ["total tasks", String(tasks.length)],
    ["plan", planPath],
  ]);
}

function displayBuildSummary(
  checkpoint: CheckpointFile,
  startedAt: number,
): void {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const taskEntries = Object.entries(checkpoint.tasks);
  const completed = taskEntries.filter(
    ([, t]) => t.status === "completed",
  ).length;
  const failed = taskEntries.filter(([, t]) => t.status === "failed").length;

  console.log();
  logger.header("Build Summary");
  logger.table([
    ["tasks completed", String(completed)],
    ["tasks failed", String(failed)],
    ["elapsed", `${elapsed}s`],
    ["status", checkpoint.status],
  ]);

  if (checkpoint.token_usage) {
    const u = checkpoint.token_usage;
    console.log();
    logger.table([
      ["tokens (input)", u.total_input.toLocaleString()],
      ["tokens (output)", u.total_output.toLocaleString()],
      ["tokens (total)", u.total_combined.toLocaleString()],
      ["cost estimate", `$${u.cost_estimate_usd.toFixed(4)} USD`],
    ]);
  }
}

export async function buildCommand(
  planPath: string | undefined,
  options: BuildOptions,
): Promise<void> {
  const projectDir = process.cwd();
  const tasksDir = path.join(projectDir, TASKS_DIR);

  // 1. Resolve plan path
  let resolvedPlanPath: string;
  if (planPath) {
    resolvedPlanPath = path.resolve(planPath);
  } else {
    const latest = getLatestPlan(tasksDir);
    if (!latest) {
      logger.error("No plan found. Run 'kova plan \"<your feature>\"' first.");
      process.exit(1);
    }
    resolvedPlanPath = latest;
  }

  if (!fs.existsSync(resolvedPlanPath)) {
    logger.error(`Plan file not found: ${resolvedPlanPath}`);
    process.exit(1);
  }

  // 2. Read plan file and display name
  const planContent = fs.readFileSync(resolvedPlanPath, "utf-8");
  const planName = path.basename(resolvedPlanPath, ".md");
  logger.info(`Plan: ${planName}`);

  // 3. Load config (use defaults if not found)
  let config: KovaConfig = DEFAULT_CONFIG;
  const loadedConfig = await loadConfig(projectDir);
  if (loadedConfig) config = loadedConfig;

  // 4. Dry-run: show task list and exit
  if (options.dryRun) {
    displayDryRun(resolvedPlanPath, planContent);
    return;
  }

  // 5. Create or resume checkpoint
  const checkpointPath = getCheckpointPath(resolvedPlanPath);
  let checkpoint: CheckpointFile;

  // Restore token tracker if resuming with existing token data
  let tokenTracker: TokenTracker | null = null;

  if (options.resume && fs.existsSync(checkpointPath)) {
    const existing = readCheckpoint(checkpointPath);
    if (existing) {
      checkpoint = existing;
      const completedCount = Object.values(checkpoint.tasks).filter(
        (t) => t.status === "completed",
      ).length;
      logger.info(
        `Resuming build: ${completedCount}/${Object.keys(checkpoint.tasks).length} tasks already completed.`,
      );
      if (checkpoint.token_usage) {
        tokenTracker = TokenTracker.fromCheckpoint(checkpoint.token_usage);
        logger.info(
          `Restored token tracking: ${checkpoint.token_usage.total_combined.toLocaleString()} tokens from previous run.`,
        );
      }
    } else {
      logger.warn("Could not read existing checkpoint. Starting fresh.");
      const tasks = parsePlanTasks(planContent);
      checkpoint = createCheckpoint(resolvedPlanPath, tasks);
    }
  } else {
    const tasks = parsePlanTasks(planContent);
    checkpoint = createCheckpoint(resolvedPlanPath, tasks);
  }

  // Reset status to in_progress in case we are re-running a completed build
  checkpoint.status = "in_progress";
  writeCheckpoint(checkpointPath, checkpoint);

  // 6. Verify Claude CLI
  const claudeAvailable = await isClaudeInstalled();
  if (!claudeAvailable) {
    logger.error("Claude CLI not found. Install it with:");
    logger.info("  npm install -g @anthropic-ai/claude-code");
    process.exit(1);
  }

  // 7. Execute the build
  logger.header(`Building: ${planName}`);

  // Start live progress if --live flag set
  let liveHandle: { stop: () => void } | null = null;
  if (options.live) {
    liveHandle = startLiveProgress(checkpointPath);
  }

  // Send build_start notification
  if (config.notifications?.on_build_complete) {
    const startPayload = buildWebhookPayload(
      checkpoint,
      "build_start",
      new Date(checkpoint.started_at).getTime(),
    );
    await sendNotification(
      config.notifications.on_build_complete,
      startPayload,
    );
  }

  const timeout =
    options.parallel && options.parallel > 1
      ? 600000
      : config.execution.task_timeout_seconds * 1000 * 2 || 300000;

  const result = await invokeClaude({
    command: `/build ${resolvedPlanPath}`,
    cwd: projectDir,
    timeout,
  });

  const startedAt = new Date(checkpoint.started_at).getTime();

  // Stop live progress
  if (liveHandle) {
    liveHandle.stop();
  }

  // 8. Update checkpoint on completion
  if (result.exitCode === 0) {
    checkpoint.status = "completed";
    logger.success("Build complete!");
  } else {
    checkpoint.status = "failed";
    logger.error(`Build failed with exit code ${result.exitCode}.`);
    if (result.stdout) {
      logger.info("Output: " + result.stdout.slice(0, 500));
    }
  }

  writeCheckpoint(checkpointPath, checkpoint);

  // Persist token usage if tracker was restored from a resume
  if (tokenTracker) {
    persistTokenUsage(checkpointPath, tokenTracker.toCheckpointData());
  }

  // Send completion notification
  if (config.notifications?.on_build_complete) {
    const event =
      result.exitCode === 0
        ? ("build_complete" as const)
        : ("build_fail" as const);
    const endPayload = buildWebhookPayload(checkpoint, event, startedAt);
    await sendNotification(config.notifications.on_build_complete, endPayload);
  }

  displayBuildSummary(checkpoint, startedAt);

  if (result.exitCode !== 0) {
    logger.info("To resume from where it left off, run:");
    logger.info(`  kova build "${resolvedPlanPath}" --resume`);
    process.exit(result.exitCode);
  }
}

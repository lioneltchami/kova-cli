import fs from "fs";
import path from "path";
import { loadConfig } from "../lib/config.js";
import type { PlanTemplateName } from "../lib/constants.js";
import { CLAUDE_DIR, DEFAULT_CONFIG, TASKS_DIR } from "../lib/constants.js";
import {
  buildIssueContext,
  createBranch,
  fetchIssue,
  getCurrentBranch,
  isGhInstalled as isGhAvailable,
  isGitRepo,
  isMainBranch,
  planNameToBranch,
} from "../lib/github.js";
import * as logger from "../lib/logger.js";
import {
  buildTemplatedPrompt,
  isValidTemplate,
  listTemplates,
} from "../lib/plan-templates.js";
import { invokeClaude, isClaudeInstalled } from "../lib/subprocess.js";
import type { KovaConfig, ModelTier, PlanTask } from "../types.js";

export interface PlanOptions {
  model?: string;
  autoBuild?: boolean;
  output?: string;
  template?: string;
  issue?: string;
  noBranch?: boolean;
}

/**
 * Return all .md filenames present in tasksDir (excluding .progress.json
 * sidecar files and archive/ subdirectory). Returns an empty set when the
 * directory does not yet exist.
 */
function listPlanFiles(tasksDir: string): Set<string> {
  if (!fs.existsSync(tasksDir)) return new Set();
  try {
    return new Set(
      fs
        .readdirSync(tasksDir)
        .filter((f) => f.endsWith(".md") && !f.endsWith(".progress.json")),
    );
  } catch {
    return new Set();
  }
}

/**
 * Compare pre- and post-invocation file sets; return the full path to whichever
 * filename appeared after the claude call, or null if none is detected.
 */
function findNewPlanFile(
  tasksDir: string,
  before: Set<string>,
  after: Set<string>,
): string | null {
  for (const filename of after) {
    if (!before.has(filename)) {
      return path.join(tasksDir, filename);
    }
  }
  return null;
}

/**
 * Extract the body of a level-2 markdown section by heading name.
 * Returns the trimmed body text up to the next ## heading (or EOF).
 */
function extractSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `^##\\s+${escaped}\\s*\n([\\s\\S]*?)(?=^##\\s|$)`,
    "im",
  );
  const m = re.exec(content);
  return m ? (m[1]?.trim() ?? "") : "";
}

/**
 * Parse plan tasks from markdown. Looks for ### N. Task Name headers, then
 * extracts optional metadata fields (Task ID, Depends On, Assigned To, etc.)
 * from the body following each header.
 */
export function parsePlanTasks(planContent: string): PlanTask[] {
  const headerRe = /^###\s+\d+\.\s+(.+)$/gim;
  const headers: Array<{ name: string; index: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(planContent)) !== null) {
    headers.push({ name: m[1]?.trim() ?? "", index: m.index });
  }

  return headers.map((h, i) => {
    const nextIdx =
      i + 1 < headers.length ? headers[i + 1]!.index : planContent.length;
    const body = planContent.slice(h.index, nextIdx);

    const field = (label: string) =>
      new RegExp(`\\*\\*${label}\\*\\*:\\s*(.+)`, "i")
        .exec(body)?.[1]
        ?.trim() ?? "";

    const dependsRaw = field("Depends\\s+On");
    const dependsOn =
      dependsRaw && !/^none$/i.test(dependsRaw)
        ? dependsRaw.split(/[,\s]+/).filter(Boolean)
        : [];

    const filesBlockMatch =
      /\*\*(?:Relevant\s+)?Files\*\*:\s*([\s\S]*?)(?:\n\n|\n\*\*|$)/i.exec(
        body,
      );
    const filesRaw = filesBlockMatch?.[1]?.trim() ?? "";
    const files = filesRaw
      ? filesRaw
          .split(/\n/)
          .map((l) => l.replace(/^[-*]\s*/, "").trim())
          .filter((l) => l.length > 0 && !l.startsWith("**"))
      : [];

    const rawModel = field("Model").toLowerCase();
    const model: ModelTier | null =
      rawModel === "haiku" || rawModel === "sonnet" || rawModel === "opus"
        ? rawModel
        : null;

    const parallelRaw = field("Parallel");

    return {
      id: field("Task(?:\\s+ID)?") || `task-${i + 1}`,
      name: h.name,
      depends_on: dependsOn,
      assigned_to: field("Assigned\\s+To"),
      agent_type: field("Agent\\s+Type"),
      parallel: /^(true|yes)$/i.test(parallelRaw),
      description: h.name,
      files,
      model,
    };
  });
}

function displayPlanSummary(planPath: string, content: string): void {
  const planName = path.basename(planPath, ".md");
  logger.header(`Plan Ready: ${planName}`);

  const objective = extractSection(content, "Objective");
  if (objective) {
    logger.info("Objective:");
    for (const line of objective.split("\n").slice(0, 4)) {
      if (line.trim()) logger.info("  " + line.trim());
    }
    console.log();
  }

  const tasks = parsePlanTasks(content);
  if (tasks.length > 0) {
    logger.info(`Tasks (${tasks.length}):`);
    for (const task of tasks) {
      const depStr =
        task.depends_on.length > 0
          ? `  [depends: ${task.depends_on.join(", ")}]`
          : "";
      const modelStr = task.model ? `  [${task.model}]` : "";
      logger.info(`  - ${task.name}${modelStr}${depStr}`);
    }
    console.log();
  }

  logger.table([["plan file", planPath]]);
}

export async function planCommand(
  prompt: string,
  options: PlanOptions,
): Promise<void> {
  const projectDir = process.cwd();

  // 1. Require a non-empty prompt
  if (!prompt || prompt.trim() === "") {
    logger.error(
      'Please provide a prompt. Example: kova plan "add user profiles"',
    );
    process.exit(1);
  }

  // 2. Validate .claude/ directory exists
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  if (!fs.existsSync(claudeDir)) {
    logger.error(
      "No .claude/ directory found. Run 'kova init' to set up this project first.",
    );
    process.exit(1);
  }

  // 3. Load config (warn but continue with defaults if missing)
  let config: KovaConfig = DEFAULT_CONFIG;
  const loadedConfig = await loadConfig(projectDir);
  if (!loadedConfig) {
    logger.warn(
      "No kova.yaml found. Using default configuration. Run 'kova init' to create one.",
    );
  } else {
    config = loadedConfig;
  }

  // 4. Verify Claude CLI is installed
  const claudeAvailable = await isClaudeInstalled();
  if (!claudeAvailable) {
    logger.error("Claude CLI not found. Install it with:");
    logger.info("  npm install -g @anthropic-ai/claude-code");
    process.exit(1);
  }

  // Apply plan template if specified
  let effectivePrompt = prompt.trim();
  if (options.template) {
    if (!isValidTemplate(options.template)) {
      logger.error(`Unknown template: "${options.template}"`);
      logger.info("Available templates:");
      for (const t of listTemplates()) {
        logger.info(`  ${t.name.padEnd(14)} ${t.description}`);
      }
      process.exit(1);
    }
    effectivePrompt = buildTemplatedPrompt(
      options.template as PlanTemplateName,
      effectivePrompt,
    );
    logger.info(`Using template: ${options.template}`);
  }

  // Fetch GitHub issue context if --issue specified
  if (options.issue) {
    const issueNum = parseInt(options.issue, 10);
    if (isNaN(issueNum)) {
      logger.error(`Invalid issue number: ${options.issue}`);
      process.exit(1);
    }
    const ghAvailable = await isGhAvailable(projectDir);
    if (!ghAvailable) {
      logger.warn(
        "GitHub CLI (gh) not installed. Skipping issue context. Install from: https://cli.github.com",
      );
    } else {
      const issue = await fetchIssue(projectDir, issueNum);
      if (issue) {
        const issueContext = buildIssueContext(issue);
        effectivePrompt = `${issueContext}\n\n${effectivePrompt}`;
        logger.info(`Linked issue #${issueNum}: ${issue.title}`);
      } else {
        logger.warn(
          `Could not fetch issue #${issueNum}. Continuing without issue context.`,
        );
      }
    }
  }

  // Resolve planning model -- CLI flag overrides kova.yaml
  const planningModel = options.model ?? config.models.planning;
  logger.info(
    `Planning: "${effectivePrompt.slice(0, 80).trim()}" (using ${planningModel} model)`,
  );

  // 5. Snapshot tasks directory before invoking claude so we can detect the new file
  const tasksDir = path.join(projectDir, TASKS_DIR);
  const planFilesBefore = listPlanFiles(tasksDir);

  // 6. Invoke claude with /team-plan
  logger.info("Running Claude Code... (this may take a moment)");
  const result = await invokeClaude({
    command: `/team-plan ${effectivePrompt}`,
    cwd: projectDir,
    timeout: 300000,
  });

  if (result.exitCode !== 0) {
    logger.error(
      `Claude exited with code ${result.exitCode}. Check your Claude Code installation and try again.`,
    );
    if (result.stdout) {
      logger.info("Output: " + result.stdout.slice(0, 500));
    }
    process.exit(result.exitCode);
  }

  // 7. Find the new plan file
  let resolvedPlanPath: string | null = null;

  if (options.output) {
    resolvedPlanPath = path.resolve(options.output);
  } else {
    const planFilesAfter = listPlanFiles(tasksDir);
    resolvedPlanPath = findNewPlanFile(
      tasksDir,
      planFilesBefore,
      planFilesAfter,
    );
  }

  // 8. Display plan summary
  if (resolvedPlanPath && fs.existsSync(resolvedPlanPath)) {
    const content = fs.readFileSync(resolvedPlanPath, "utf-8");
    console.log();
    displayPlanSummary(resolvedPlanPath, content);
  } else {
    logger.warn(
      "Claude completed but no new plan file was detected in .claude/tasks/.",
    );
    logger.info(
      "Check .claude/tasks/ manually for the generated plan, then run: kova build <plan-path>",
    );
    return;
  }

  // Auto-create feature branch if on main/master/develop
  if (!options.noBranch && resolvedPlanPath) {
    try {
      const isRepo = await isGitRepo(projectDir);
      if (isRepo) {
        const currentBranch = await getCurrentBranch(projectDir);
        if (currentBranch && isMainBranch(currentBranch)) {
          const planBaseName = path.basename(resolvedPlanPath, ".md");
          const branchName = planNameToBranch(planBaseName);
          const created = await createBranch(projectDir, branchName);
          if (created) {
            logger.success(`Created branch: ${branchName}`);
          }
        }
      }
    } catch {
      logger.debug("Auto-branch creation skipped or failed.");
    }
  }

  // 9. Auto-build or show next-step guidance
  if (options.autoBuild) {
    logger.info("--auto-build set. Launching build...");
    const { buildCommand } = await import("./build.js");
    await buildCommand(resolvedPlanPath, {});
  } else {
    logger.info("Review the plan, then run:");
    logger.info(`  kova build "${resolvedPlanPath}"`);
    console.log();
  }
}

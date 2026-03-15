import path from "path";
import { getLatestCheckpoint, readCheckpoint } from "../lib/checkpoint.js";
import { TASKS_DIR } from "../lib/constants.js";
import * as logger from "../lib/logger.js";
import type { CheckpointFile, TaskStatus } from "../types.js";

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsedMs = now - start;

  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDuration(durationS: number | null): string {
  if (durationS === null) return "";
  const minutes = Math.floor(durationS / 60);
  const seconds = Math.floor(durationS % 60);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function taskStatusToProgressKey(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "done";
    case "in_progress":
      return "running";
    case "pending":
      return "pending";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function renderProgressBar(
  completed: number,
  total: number,
  width = 30,
): string {
  if (total === 0) return "[" + " ".repeat(width) + "] 0%";
  const pct = completed / total;
  const filled = Math.round(pct * width);
  const bar = "=".repeat(filled) + "-".repeat(width - filled);
  return `[${bar}] ${Math.round(pct * 100)}%`;
}

function displayCheckpoint(checkpoint: CheckpointFile): void {
  // Plan name and status
  const planName = path.basename(checkpoint.plan, ".md");
  logger.header(`Build Status: ${planName}`);

  // Top-level info table
  const startedAt = new Date(checkpoint.started_at).toLocaleString();
  const elapsed = formatElapsed(checkpoint.started_at);
  logger.table([
    ["plan", planName],
    ["status", checkpoint.status],
    ["started", `${startedAt} (${elapsed} ago)`],
  ]);
  console.log();

  // Per-task progress
  const taskEntries = Object.entries(checkpoint.tasks);
  if (taskEntries.length === 0) {
    logger.info("No tasks recorded in this checkpoint.");
  } else {
    for (const [taskId, task] of taskEntries) {
      const statusKey = taskStatusToProgressKey(task.status);
      const model = task.model ?? "unknown";
      const duration =
        task.duration_s !== null ? formatDuration(task.duration_s) : "";
      const detail = [model, duration].filter(Boolean).join("  ");
      logger.progress(statusKey, taskId, detail);
    }
  }

  // Progress bar
  console.log();
  const total = taskEntries.length;
  const completed = taskEntries.filter(
    ([, t]) => t.status === "completed",
  ).length;
  const failed = taskEntries.filter(([, t]) => t.status === "failed").length;
  const inProgress = taskEntries.filter(
    ([, t]) => t.status === "in_progress",
  ).length;

  const bar = renderProgressBar(completed, total);
  logger.info(`Progress: ${bar}  (${completed}/${total} tasks)`);

  if (failed > 0) {
    logger.warn(`${failed} task(s) failed.`);
  }
  if (inProgress > 0) {
    logger.info(`${inProgress} task(s) currently running.`);
  }

  // Token usage
  if (checkpoint.token_usage) {
    const usage = checkpoint.token_usage;
    console.log();
    logger.header("Token Usage");
    logger.table([
      ["total_input", usage.total_input.toLocaleString()],
      ["total_output", usage.total_output.toLocaleString()],
      ["total_combined", usage.total_combined.toLocaleString()],
    ]);

    if (usage.plan_type !== "api" && isFinite(usage.window_allocation)) {
      const pct = (usage.total_combined / usage.window_allocation) * 100;
      const remaining = Math.max(
        0,
        usage.window_allocation - usage.total_combined,
      );
      logger.table([
        ["plan", usage.plan_type],
        ["budget_used", `${pct.toFixed(1)}%`],
        ["remaining_tokens", remaining.toLocaleString()],
      ]);
    }

    if (usage.cost_estimate_usd > 0) {
      logger.table([
        ["cost_estimate", `$${usage.cost_estimate_usd.toFixed(4)} USD`],
      ]);
    }
  }

  // Validation results
  if (checkpoint.validation) {
    console.log();
    const passed = checkpoint.validation.passed;
    if (passed) {
      logger.success("Validation passed.");
    } else {
      logger.warn("Validation failed. Review results:");
      for (const [check, result] of Object.entries(
        checkpoint.validation.results,
      )) {
        if (result) {
          logger.success(`  ${check}`);
        } else {
          logger.error(`  ${check}`);
        }
      }
    }
  }

  console.log();
}

export async function statusCommand(): Promise<void> {
  const tasksDir = path.join(process.cwd(), TASKS_DIR);
  const checkpointPath = await getLatestCheckpoint(tasksDir);

  if (!checkpointPath) {
    logger.info(
      "No active builds found. Run 'kova plan' to create a plan, then 'kova build' to execute.",
    );
    return;
  }

  const checkpoint = readCheckpoint(checkpointPath);
  if (!checkpoint) {
    logger.error(`Failed to read checkpoint at: ${checkpointPath}`);
    process.exit(1);
  }

  displayCheckpoint(checkpoint);
}

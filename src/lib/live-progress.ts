import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { CheckpointFile } from "../types.js";

const STATUS_ICONS: Record<string, string> = {
  completed: chalk.green("[done]"),
  in_progress: chalk.cyan("[running]"),
  pending: chalk.dim("[pending]"),
  blocked: chalk.yellow("[blocked]"),
  failed: chalk.red("[failed]"),
};

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function progressBar(
  completed: number,
  total: number,
  width: number = 30,
): string {
  if (total === 0) return "[" + " ".repeat(width) + "] 0%";
  const pct = completed / total;
  const filled = Math.round(pct * width);
  const bar = "=".repeat(filled) + "-".repeat(width - filled);
  return `[${bar}] ${Math.round(pct * 100)}%`;
}

export function renderProgress(checkpoint: CheckpointFile): string {
  const lines: string[] = [];
  const planName = path.basename(checkpoint.plan, ".md");

  lines.push("");
  lines.push(chalk.bold.hex("#4361EE")(`  KOVA Build: ${planName}`));
  lines.push(
    chalk.dim(
      `  Status: ${checkpoint.status}  |  Elapsed: ${formatElapsed(checkpoint.started_at)}`,
    ),
  );
  lines.push("");

  const taskEntries = Object.entries(checkpoint.tasks);
  const completed = taskEntries.filter(
    ([, t]) => t.status === "completed",
  ).length;
  const total = taskEntries.length;

  lines.push(
    `  ${progressBar(completed, total)}  (${completed}/${total} tasks)`,
  );
  lines.push("");

  for (const [taskId, task] of taskEntries) {
    const icon = STATUS_ICONS[task.status] ?? chalk.dim(`[${task.status}]`);
    const model = task.model ? chalk.dim(` ${task.model}`) : "";
    const duration =
      task.duration_s !== null ? chalk.dim(` ${task.duration_s}s`) : "";
    lines.push(`  ${icon}  ${taskId}${model}${duration}`);
  }

  if (checkpoint.token_usage) {
    const u = checkpoint.token_usage;
    lines.push("");
    lines.push(
      chalk.dim(
        `  Tokens: ${u.total_combined.toLocaleString()} used  |  $${u.cost_estimate_usd.toFixed(4)} est.`,
      ),
    );
    if (u.plan_type !== "api" && isFinite(u.window_allocation)) {
      const pct = ((u.total_combined / u.window_allocation) * 100).toFixed(1);
      lines.push(chalk.dim(`  Budget: ${pct}% of ${u.plan_type} allocation`));
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function startLiveProgress(
  checkpointPath: string,
  interval: number = 5000,
): { stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;

  const render = (): void => {
    try {
      if (!fs.existsSync(checkpointPath)) {
        process.stdout.write("\x1b[2J\x1b[H");
        process.stdout.write(chalk.dim("\n  Waiting for build to start...\n"));
        return;
      }

      const raw = fs.readFileSync(checkpointPath, "utf-8");
      const checkpoint = JSON.parse(raw) as CheckpointFile;

      process.stdout.write("\x1b[2J\x1b[H");
      process.stdout.write(renderProgress(checkpoint));
    } catch {
      // Checkpoint may be mid-write (JSON parse error) -- skip this tick
    }
  };

  // Initial render
  render();

  timer = setInterval(render, interval);

  // Prevent the timer from keeping the process alive
  if (timer && typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }

  return {
    stop: (): void => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      // Final render
      render();
    },
  };
}

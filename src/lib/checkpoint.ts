import fs from "fs";
import { glob } from "glob";
import path from "path";
import type {
  CheckpointFile,
  CheckpointTask,
  PlanTask,
  TaskStatus,
  TokenUsage,
} from "../types.js";

export function createCheckpoint(
  planName: string,
  tasks: PlanTask[],
): CheckpointFile {
  const taskEntries: Record<string, CheckpointTask> = {};

  for (const task of tasks) {
    taskEntries[task.id] = {
      status: "pending",
      agent_type: task.agent_type,
      model: task.model,
      agent_id: null,
      started_at: null,
      completed_at: null,
      duration_s: null,
      tokens: null,
    };
  }

  return {
    plan: planName,
    started_at: new Date().toISOString(),
    status: "in_progress",
    tasks: taskEntries,
    token_usage: null,
    validation: null,
  };
}

export function readCheckpoint(checkpointPath: string): CheckpointFile | null {
  try {
    const raw = fs.readFileSync(checkpointPath, "utf-8");
    return JSON.parse(raw) as CheckpointFile;
  } catch {
    return null;
  }
}

export function writeCheckpoint(
  checkpointPath: string,
  checkpoint: CheckpointFile,
): void {
  const tmpPath = `${checkpointPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(checkpoint, null, 2), "utf-8");
  try {
    fs.unlinkSync(checkpointPath);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") {
      // If unlink fails for reason other than "not found", fall back to direct write
      fs.writeFileSync(
        checkpointPath,
        JSON.stringify(checkpoint, null, 2),
        "utf-8",
      );
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore cleanup */
      }
      return;
    }
  }
  fs.renameSync(tmpPath, checkpointPath);
}

export function persistTokenUsage(
  checkpointPath: string,
  tokenData: TokenUsage,
): void {
  const checkpoint = readCheckpoint(checkpointPath);
  if (!checkpoint) return;
  checkpoint.token_usage = tokenData;
  writeCheckpoint(checkpointPath, checkpoint);
}

export function updateTaskStatus(
  checkpoint: CheckpointFile,
  taskId: string,
  status: TaskStatus,
  extra?: Partial<CheckpointTask>,
): CheckpointFile {
  const existing = checkpoint.tasks[taskId];
  if (existing) {
    checkpoint.tasks[taskId] = {
      ...existing,
      status,
      ...extra,
    };
  }
  return checkpoint;
}

export async function getLatestCheckpoint(
  tasksDir: string,
): Promise<string | null> {
  const pattern = path.join(tasksDir, "*.progress.json").replace(/\\/g, "/");

  let matches: string[];
  try {
    matches = await glob(pattern);
  } catch {
    return null;
  }

  if (matches.length === 0) return null;

  // Sort by modification time descending, return the most recent
  const withStats = matches.map((filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return { filePath, mtime: stat.mtimeMs };
    } catch {
      return { filePath, mtime: 0 };
    }
  });

  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats[0]?.filePath ?? null;
}

export function getCheckpointPath(planPath: string): string {
  return planPath.replace(/\.md$/, ".progress.json");
}

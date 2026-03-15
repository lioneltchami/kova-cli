import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCheckpoint,
  getCheckpointPath,
  getLatestCheckpoint,
  readCheckpoint,
  updateTaskStatus,
  writeCheckpoint,
} from "../src/lib/checkpoint.js";
import type { PlanTask } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makePlanTask(id: string, overrides: Partial<PlanTask> = {}): PlanTask {
  return {
    id,
    name: `Task ${id}`,
    depends_on: [],
    assigned_to: "frontend-specialist",
    agent_type: "frontend-specialist",
    parallel: false,
    description: "A sample task",
    files: [],
    model: null,
    ...overrides,
  };
}

describe("checkpoint", () => {
  describe("createCheckpoint", () => {
    it("creates checkpoint with all tasks as pending", () => {
      const tasks = [
        makePlanTask("task-1"),
        makePlanTask("task-2"),
        makePlanTask("task-3"),
      ];
      const checkpoint = createCheckpoint("my-plan.md", tasks);
      expect(checkpoint.tasks["task-1"]?.status).toBe("pending");
      expect(checkpoint.tasks["task-2"]?.status).toBe("pending");
      expect(checkpoint.tasks["task-3"]?.status).toBe("pending");
    });

    it("sets started_at to current time", () => {
      const before = new Date().toISOString();
      const checkpoint = createCheckpoint("plan.md", [makePlanTask("t1")]);
      const after = new Date().toISOString();
      expect(checkpoint.started_at >= before).toBe(true);
      expect(checkpoint.started_at <= after).toBe(true);
    });

    it("sets status to in_progress", () => {
      const checkpoint = createCheckpoint("plan.md", [makePlanTask("t1")]);
      expect(checkpoint.status).toBe("in_progress");
    });
  });

  describe("writeCheckpoint and readCheckpoint", () => {
    it("roundtrips checkpoint through write and read", () => {
      const tasks = [makePlanTask("t1"), makePlanTask("t2")];
      const checkpoint = createCheckpoint("my-plan.md", tasks);
      const checkpointPath = path.join(tmpDir, "my-plan.progress.json");

      writeCheckpoint(checkpointPath, checkpoint);
      const loaded = readCheckpoint(checkpointPath);

      expect(loaded).not.toBeNull();
      expect(loaded!.plan).toBe("my-plan.md");
      expect(loaded!.status).toBe("in_progress");
      expect(loaded!.tasks["t1"]?.status).toBe("pending");
      expect(loaded!.tasks["t2"]?.status).toBe("pending");
    });

    it("returns null for non-existent file", () => {
      const result = readCheckpoint(path.join(tmpDir, "nonexistent.json"));
      expect(result).toBeNull();
    });

    it("uses atomic write (no .tmp file left behind)", () => {
      const tasks = [makePlanTask("t1")];
      const checkpoint = createCheckpoint("plan.md", tasks);
      const checkpointPath = path.join(tmpDir, "plan.progress.json");

      writeCheckpoint(checkpointPath, checkpoint);

      // The .tmp file should not exist after write
      const tmpFile = `${checkpointPath}.tmp`;
      expect(fs.existsSync(tmpFile)).toBe(false);
      // The real file should exist
      expect(fs.existsSync(checkpointPath)).toBe(true);
    });
  });

  describe("updateTaskStatus", () => {
    it("updates task status to completed", () => {
      const tasks = [makePlanTask("t1")];
      const checkpoint = createCheckpoint("plan.md", tasks);
      const updated = updateTaskStatus(checkpoint, "t1", "completed");
      expect(updated.tasks["t1"]?.status).toBe("completed");
    });

    it("merges extra fields like agent_id and duration", () => {
      const tasks = [makePlanTask("t1")];
      const checkpoint = createCheckpoint("plan.md", tasks);
      const updated = updateTaskStatus(checkpoint, "t1", "completed", {
        agent_id: "agent-abc",
        duration_s: 42,
        completed_at: "2026-01-01T00:00:00.000Z",
      });
      expect(updated.tasks["t1"]?.agent_id).toBe("agent-abc");
      expect(updated.tasks["t1"]?.duration_s).toBe(42);
      expect(updated.tasks["t1"]?.completed_at).toBe(
        "2026-01-01T00:00:00.000Z",
      );
      expect(updated.tasks["t1"]?.status).toBe("completed");
    });
  });

  describe("getCheckpointPath", () => {
    it("replaces .md extension with .progress.json", () => {
      const result = getCheckpointPath("/some/dir/my-plan.md");
      expect(result).toBe("/some/dir/my-plan.progress.json");
    });

    it("handles paths without .md extension gracefully", () => {
      // When no .md extension, no replacement occurs
      const result = getCheckpointPath("/some/dir/plan");
      expect(result).toBe("/some/dir/plan");
    });
  });

  describe("getLatestCheckpoint", () => {
    it("finds the most recent .progress.json file", async () => {
      const file1 = path.join(tmpDir, "plan-a.progress.json");
      const file2 = path.join(tmpDir, "plan-b.progress.json");

      fs.writeFileSync(file1, "{}", "utf-8");
      // Small delay to ensure different mtime
      await new Promise((r) => setTimeout(r, 50));
      fs.writeFileSync(file2, "{}", "utf-8");

      const latest = await getLatestCheckpoint(tmpDir);
      // file2 was written last, so it should be the most recent
      expect(latest).not.toBeNull();
      // Normalize path separators for cross-platform comparison
      expect(latest!.replace(/\\/g, "/")).toContain("plan-b.progress.json");
    });

    it("returns null when no checkpoint files exist", async () => {
      const result = await getLatestCheckpoint(tmpDir);
      expect(result).toBeNull();
    });
  });
});

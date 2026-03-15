import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCheckpoint,
  getLatestCheckpoint,
  readCheckpoint,
  updateTaskStatus,
  writeCheckpoint,
} from "../src/lib/checkpoint.js";
import type { CheckpointFile, PlanTask } from "../src/types.js";

let tmpDir: string;
let tasksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-status-test-"));
  tasksDir = path.join(tmpDir, ".claude", "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });
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

function makeCheckpointFile(planName: string): CheckpointFile {
  return {
    plan: planName,
    started_at: new Date().toISOString(),
    status: "in_progress",
    tasks: {},
    token_usage: null,
    validation: null,
  };
}

describe("status integration", () => {
  it("displays progress from a checkpoint file with mixed statuses", () => {
    // Build a checkpoint with a realistic set of mixed task statuses
    const tasks = [
      makePlanTask("setup-db"),
      makePlanTask("build-api"),
      makePlanTask("build-ui"),
      makePlanTask("write-tests"),
    ];
    let checkpoint = createCheckpoint("my-feature-plan.md", tasks);

    // Simulate build progress
    checkpoint = updateTaskStatus(checkpoint, "setup-db", "completed", {
      agent_id: "agent-1",
      duration_s: 30,
      completed_at: new Date().toISOString(),
    });
    checkpoint = updateTaskStatus(checkpoint, "build-api", "completed", {
      agent_id: "agent-2",
      duration_s: 120,
      completed_at: new Date().toISOString(),
    });
    checkpoint = updateTaskStatus(checkpoint, "build-ui", "in_progress", {
      agent_id: "agent-3",
    });
    // write-tests remains pending

    const checkpointPath = path.join(tasksDir, "my-feature-plan.progress.json");
    writeCheckpoint(checkpointPath, checkpoint);

    // Read it back and verify all statuses are correct
    const loaded = readCheckpoint(checkpointPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.plan).toBe("my-feature-plan.md");
    expect(loaded!.status).toBe("in_progress");

    expect(loaded!.tasks["setup-db"]?.status).toBe("completed");
    expect(loaded!.tasks["setup-db"]?.agent_id).toBe("agent-1");
    expect(loaded!.tasks["setup-db"]?.duration_s).toBe(30);

    expect(loaded!.tasks["build-api"]?.status).toBe("completed");
    expect(loaded!.tasks["build-api"]?.agent_id).toBe("agent-2");
    expect(loaded!.tasks["build-api"]?.duration_s).toBe(120);

    expect(loaded!.tasks["build-ui"]?.status).toBe("in_progress");
    expect(loaded!.tasks["build-ui"]?.agent_id).toBe("agent-3");

    expect(loaded!.tasks["write-tests"]?.status).toBe("pending");

    // Derive summary counts the same way statusCommand does
    const entries = Object.values(loaded!.tasks);
    const completedCount = entries.filter(
      (t) => t.status === "completed",
    ).length;
    const inProgressCount = entries.filter(
      (t) => t.status === "in_progress",
    ).length;
    const pendingCount = entries.filter((t) => t.status === "pending").length;
    expect(completedCount).toBe(2);
    expect(inProgressCount).toBe(1);
    expect(pendingCount).toBe(1);
  });

  it("returns null when no checkpoint exists", async () => {
    const result = await getLatestCheckpoint(tasksDir);
    expect(result).toBeNull();
  });

  it("finds the most recent checkpoint among multiple", async () => {
    const file1 = path.join(tasksDir, "plan-alpha.progress.json");
    const file2 = path.join(tasksDir, "plan-beta.progress.json");
    const file3 = path.join(tasksDir, "plan-gamma.progress.json");

    // Write in sequence with small delays to guarantee different mtimes
    const cp1 = makeCheckpointFile("plan-alpha.md");
    writeCheckpoint(file1, cp1);

    await new Promise((r) => setTimeout(r, 30));
    const cp2 = makeCheckpointFile("plan-beta.md");
    writeCheckpoint(file2, cp2);

    await new Promise((r) => setTimeout(r, 30));
    const cp3 = makeCheckpointFile("plan-gamma.md");
    writeCheckpoint(file3, cp3);

    const latest = await getLatestCheckpoint(tasksDir);
    expect(latest).not.toBeNull();
    // Normalize separators for Windows compatibility
    expect(latest!.replace(/\\/g, "/")).toContain("plan-gamma.progress.json");
  });

  it("reads a checkpoint with failed tasks correctly", () => {
    const tasks = [makePlanTask("step-1"), makePlanTask("step-2")];
    let checkpoint = createCheckpoint("failing-plan.md", tasks);
    checkpoint = updateTaskStatus(checkpoint, "step-1", "failed");

    const checkpointPath = path.join(tasksDir, "failing-plan.progress.json");
    writeCheckpoint(checkpointPath, checkpoint);

    const loaded = readCheckpoint(checkpointPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.tasks["step-1"]?.status).toBe("failed");
    expect(loaded!.tasks["step-2"]?.status).toBe("pending");
  });

  it("reads a checkpoint with token_usage correctly", () => {
    const tasks = [makePlanTask("t1")];
    let checkpoint = createCheckpoint("token-plan.md", tasks);
    checkpoint = updateTaskStatus(checkpoint, "t1", "completed");

    // Attach token usage to the checkpoint
    checkpoint.token_usage = {
      total_input: 50000,
      total_output: 20000,
      total_combined: 70000,
      cost_estimate_usd: 0.5,
      per_task: {
        t1: { input: 50000, output: 20000, model: "sonnet" },
      },
      session_start: new Date().toISOString(),
      plan_type: "max5",
      window_allocation: 88000,
    };

    const checkpointPath = path.join(tasksDir, "token-plan.progress.json");
    writeCheckpoint(checkpointPath, checkpoint);

    const loaded = readCheckpoint(checkpointPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.token_usage).not.toBeNull();
    expect(loaded!.token_usage!.total_input).toBe(50000);
    expect(loaded!.token_usage!.total_output).toBe(20000);
    expect(loaded!.token_usage!.total_combined).toBe(70000);
    expect(loaded!.token_usage!.cost_estimate_usd).toBe(0.5);
    expect(loaded!.token_usage!.plan_type).toBe("max5");
  });

  it("reads a checkpoint with validation results correctly", () => {
    const tasks = [makePlanTask("validate-task")];
    let checkpoint = createCheckpoint("validated-plan.md", tasks);
    checkpoint = updateTaskStatus(checkpoint, "validate-task", "completed");

    checkpoint.status = "completed";
    checkpoint.validation = {
      passed: false,
      results: {
        lint: true,
        typecheck: true,
        tests: false,
        build: true,
      },
    };

    const checkpointPath = path.join(tasksDir, "validated-plan.progress.json");
    writeCheckpoint(checkpointPath, checkpoint);

    const loaded = readCheckpoint(checkpointPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe("completed");
    expect(loaded!.validation).not.toBeNull();
    expect(loaded!.validation!.passed).toBe(false);
    expect(loaded!.validation!.results["lint"]).toBe(true);
    expect(loaded!.validation!.results["tests"]).toBe(false);
  });

  it("handles getLatestCheckpoint on a directory with only non-progress files", async () => {
    // Write a .md file and a .json file (not .progress.json) -- should still return null
    fs.writeFileSync(path.join(tasksDir, "plan.md"), "# Plan", "utf-8");
    fs.writeFileSync(path.join(tasksDir, "notes.json"), "{}", "utf-8");

    const result = await getLatestCheckpoint(tasksDir);
    expect(result).toBeNull();
  });
});

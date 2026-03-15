import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCheckpoint,
  getCheckpointPath,
  persistTokenUsage,
  readCheckpoint,
  writeCheckpoint,
} from "../src/lib/checkpoint.js";
import { renderProgress } from "../src/lib/live-progress.js";
import { buildWebhookPayload } from "../src/lib/notifications.js";
import { TokenTracker } from "../src/lib/token-tracker.js";
import type { PlanTask } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-build-int-"));
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

describe("build-integration: checkpoint path derivation", () => {
  it("getCheckpointPath converts my-plan.md to my-plan.progress.json", () => {
    const result = getCheckpointPath("my-plan.md");
    expect(result).toBe("my-plan.progress.json");
  });

  it("getCheckpointPath works with absolute paths", () => {
    const result = getCheckpointPath(
      "/workspace/.claude/tasks/feature-plan.md",
    );
    expect(result).toBe("/workspace/.claude/tasks/feature-plan.progress.json");
  });

  it("getCheckpointPath leaves non-.md paths unchanged", () => {
    const result = getCheckpointPath("/some/dir/plan");
    expect(result).toBe("/some/dir/plan");
  });
});

describe("build-integration: create, write, read checkpoint roundtrip", () => {
  it("creates checkpoint from tasks, writes, and reads back correctly", () => {
    const tasks = [
      makePlanTask("task-1", {
        model: "sonnet",
        agent_type: "frontend-specialist",
      }),
      makePlanTask("task-2", {
        model: "haiku",
        agent_type: "backend-engineer",
      }),
      makePlanTask("task-3", { model: "opus", agent_type: "quality-engineer" }),
    ];

    const checkpoint = createCheckpoint("feature-plan.md", tasks);
    const checkpointPath = path.join(tmpDir, "feature-plan.progress.json");

    writeCheckpoint(checkpointPath, checkpoint);
    const loaded = readCheckpoint(checkpointPath);

    expect(loaded).not.toBeNull();
    expect(loaded!.plan).toBe("feature-plan.md");
    expect(loaded!.status).toBe("in_progress");
    expect(loaded!.tasks["task-1"]?.status).toBe("pending");
    expect(loaded!.tasks["task-1"]?.model).toBe("sonnet");
    expect(loaded!.tasks["task-2"]?.status).toBe("pending");
    expect(loaded!.tasks["task-3"]?.status).toBe("pending");
    expect(loaded!.token_usage).toBeNull();
  });

  it("checkpoint contains started_at timestamp within last second", () => {
    const before = Date.now();
    const checkpoint = createCheckpoint("plan.md", [makePlanTask("t1")]);
    const after = Date.now();

    const startedMs = new Date(checkpoint.started_at).getTime();
    expect(startedMs).toBeGreaterThanOrEqual(before);
    expect(startedMs).toBeLessThanOrEqual(after + 1);
  });
});

describe("build-integration: webhook payload from checkpoint", () => {
  it("builds correct payload from checkpoint with mixed task statuses", () => {
    const checkpoint = createCheckpoint("release-plan.md", [
      makePlanTask("task-1", { model: "sonnet" }),
      makePlanTask("task-2", { model: "sonnet" }),
      makePlanTask("task-3", { model: "haiku" }),
      makePlanTask("task-4", { model: "haiku" }),
      makePlanTask("task-5", { model: "opus" }),
    ]);

    // Simulate task completions
    checkpoint.tasks["task-1"]!.status = "completed";
    checkpoint.tasks["task-2"]!.status = "completed";
    checkpoint.tasks["task-3"]!.status = "failed";
    checkpoint.tasks["task-4"]!.status = "in_progress";
    checkpoint.status = "in_progress";

    const startedAt = Date.now() - 10_000;
    const payload = buildWebhookPayload(checkpoint, "build_fail", startedAt);

    expect(payload.event).toBe("build_fail");
    expect(payload.plan).toBe("release-plan.md");
    expect(payload.status).toBe("in_progress");
    expect(payload.tasks_total).toBe(5);
    expect(payload.tasks_completed).toBe(2);
    expect(payload.tasks_failed).toBe(1);
    expect(payload.duration_seconds).toBeGreaterThanOrEqual(9);
    expect(payload.models_used["sonnet"]).toBe(2);
    expect(payload.models_used["haiku"]).toBe(2);
    expect(payload.models_used["opus"]).toBe(1);
    expect(typeof payload.timestamp).toBe("string");
  });

  it("payload models_used is an empty object for checkpoint with no tasks", () => {
    const checkpoint = createCheckpoint("empty-plan.md", []);
    const payload = buildWebhookPayload(checkpoint, "build_start", Date.now());

    expect(payload.tasks_total).toBe(0);
    expect(Object.keys(payload.models_used)).toHaveLength(0);
  });
});

describe("build-integration: render progress from checkpoint", () => {
  it("renders progress string containing plan name and task counts", () => {
    const tasks = [
      makePlanTask("task-1", { model: "sonnet" }),
      makePlanTask("task-2", { model: "sonnet" }),
      makePlanTask("task-3", { model: "haiku" }),
    ];

    const checkpoint = createCheckpoint("ui-redesign.md", tasks);
    checkpoint.tasks["task-1"]!.status = "completed";
    checkpoint.tasks["task-2"]!.status = "completed";

    const output = renderProgress(checkpoint);

    expect(output).toContain("ui-redesign");
    expect(output).toContain("2/3");
  });

  it("renders progress with 100% when all tasks are completed", () => {
    const tasks = [makePlanTask("task-1"), makePlanTask("task-2")];

    const checkpoint = createCheckpoint("done-plan.md", tasks);
    checkpoint.tasks["task-1"]!.status = "completed";
    checkpoint.tasks["task-2"]!.status = "completed";
    checkpoint.status = "completed";

    const output = renderProgress(checkpoint);

    expect(output).toContain("100%");
    expect(output).toContain("2/2");
  });

  it("renders progress with 0% when no tasks are completed", () => {
    const tasks = [makePlanTask("task-1"), makePlanTask("task-2")];
    const checkpoint = createCheckpoint("fresh-plan.md", tasks);

    const output = renderProgress(checkpoint);

    expect(output).toContain("0%");
    expect(output).toContain("0/2");
  });
});

describe("build-integration: token tracker with checkpoint persistence", () => {
  it("creates tracker, adds usage, persists to checkpoint, reads back token_usage", () => {
    const tasks = [
      makePlanTask("task-1", { model: "sonnet" }),
      makePlanTask("task-2", { model: "haiku" }),
    ];
    const checkpoint = createCheckpoint("tracked-plan.md", tasks);
    const checkpointPath = path.join(tmpDir, "tracked-plan.progress.json");
    writeCheckpoint(checkpointPath, checkpoint);

    const tracker = new TokenTracker("max5");
    tracker.addTaskUsage("task-1", 10_000, 5_000, "sonnet");
    tracker.addTaskUsage("task-2", 3_000, 1_500, "haiku");

    const tokenData = tracker.toCheckpointData();
    persistTokenUsage(checkpointPath, tokenData);

    const loaded = readCheckpoint(checkpointPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.token_usage).not.toBeNull();
    expect(loaded!.token_usage!.total_input).toBe(13_000);
    expect(loaded!.token_usage!.total_output).toBe(6_500);
    expect(loaded!.token_usage!.total_combined).toBe(19_500);
    expect(loaded!.token_usage!.plan_type).toBe("max5");
    expect(loaded!.token_usage!.per_task["task-1"]).toBeDefined();
    expect(loaded!.token_usage!.per_task["task-2"]).toBeDefined();
  });

  it("token tracker restore from persisted checkpoint data", () => {
    const checkpointPath = path.join(tmpDir, "restore-test.progress.json");
    const checkpoint = createCheckpoint("restore-plan.md", [
      makePlanTask("task-1"),
    ]);
    writeCheckpoint(checkpointPath, checkpoint);

    // First session: add token usage
    const tracker1 = new TokenTracker("max5");
    tracker1.addTaskUsage("task-1", 20_000, 10_000, "sonnet");
    persistTokenUsage(checkpointPath, tracker1.toCheckpointData());

    // Second session: restore and continue
    const loaded = readCheckpoint(checkpointPath);
    expect(loaded!.token_usage).not.toBeNull();

    const tracker2 = TokenTracker.fromCheckpoint(loaded!.token_usage!);
    tracker2.addTaskUsage("task-2", 5_000, 2_500, "haiku");

    const finalTotals = tracker2.getTotalUsage();
    expect(finalTotals.total_combined).toBe(20_000 + 10_000 + 5_000 + 2_500);
    expect(finalTotals.total_combined).toBe(37_500);
  });

  it("budget percent is correct after full roundtrip through checkpoint", () => {
    const checkpointPath = path.join(tmpDir, "budget-test.progress.json");
    const checkpoint = createCheckpoint("budget-plan.md", [makePlanTask("t1")]);
    writeCheckpoint(checkpointPath, checkpoint);

    const tracker = new TokenTracker("max5");
    // Use exactly 44000 tokens = 50% of 88000 max5 allocation
    tracker.addTaskUsage("t1", 22_000, 22_000, "haiku");
    persistTokenUsage(checkpointPath, tracker.toCheckpointData());

    const loaded = readCheckpoint(checkpointPath);
    const restoredTracker = TokenTracker.fromCheckpoint(loaded!.token_usage!);

    expect(restoredTracker.getBudgetPercent()).toBeCloseTo(50.0, 1);
  });
});

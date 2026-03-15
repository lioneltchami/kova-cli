import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderProgress, startLiveProgress } from "../src/lib/live-progress.js";
import type { CheckpointFile } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-live-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeCheckpoint(
  overrides: Partial<CheckpointFile> = {},
): CheckpointFile {
  return {
    plan: "test-plan.md",
    started_at: new Date(Date.now() - 30_000).toISOString(),
    status: "in_progress",
    tasks: {},
    token_usage: null,
    validation: null,
    ...overrides,
  };
}

describe("renderProgress", () => {
  it("produces valid string output with empty tasks", () => {
    const checkpoint = makeCheckpoint({ tasks: {} });
    const output = renderProgress(checkpoint);

    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("shows correct progress percentage with 3 completed out of 7 tasks", () => {
    const checkpoint = makeCheckpoint({
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 10,
          tokens: null,
        },
        "task-2": {
          status: "completed",
          agent_type: "backend-engineer",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 15,
          tokens: null,
        },
        "task-3": {
          status: "completed",
          agent_type: "quality-engineer",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 5,
          tokens: null,
        },
        "task-4": {
          status: "pending",
          agent_type: "frontend-specialist",
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-5": {
          status: "pending",
          agent_type: "backend-engineer",
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-6": {
          status: "in_progress",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-7": {
          status: "failed",
          agent_type: "quality-engineer",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
      },
    });

    const output = renderProgress(checkpoint);

    // 3/7 = ~43%
    expect(output).toContain("43%");
    expect(output).toContain("3/7");
  });

  it("includes the plan name (without .md extension)", () => {
    const checkpoint = makeCheckpoint({ plan: "my-feature-plan.md" });
    const output = renderProgress(checkpoint);

    expect(output).toContain("my-feature-plan");
  });

  it("includes elapsed time indicator", () => {
    const checkpoint = makeCheckpoint({
      started_at: new Date(Date.now() - 125_000).toISOString(),
    });

    const output = renderProgress(checkpoint);

    // 125 seconds = 2m 5s
    expect(output).toContain("2m");
  });

  it("includes token usage when token_usage is present", () => {
    const checkpoint = makeCheckpoint({
      token_usage: {
        total_input: 10_000,
        total_output: 5_000,
        total_combined: 15_000,
        cost_estimate_usd: 0.0525,
        per_task: {},
        session_start: new Date().toISOString(),
        plan_type: "max5",
        window_allocation: 88_000,
      },
    });

    const output = renderProgress(checkpoint);

    expect(output).toContain("15,000");
    expect(output).toContain("0.0525");
  });

  it("omits token usage section when token_usage is null", () => {
    const checkpoint = makeCheckpoint({ token_usage: null });
    const output = renderProgress(checkpoint);

    expect(output).not.toContain("Tokens:");
    expect(output).not.toContain("Budget:");
  });

  it("shows budget percentage for non-api plan types", () => {
    const checkpoint = makeCheckpoint({
      token_usage: {
        total_input: 44_000,
        total_output: 44_000,
        total_combined: 88_000,
        cost_estimate_usd: 0.924,
        per_task: {},
        session_start: new Date().toISOString(),
        plan_type: "max5",
        window_allocation: 88_000,
      },
    });

    const output = renderProgress(checkpoint);

    expect(output).toContain("100.0%");
    expect(output).toContain("max5");
  });

  it("omits budget line when plan_type is api (infinite allocation)", () => {
    const checkpoint = makeCheckpoint({
      token_usage: {
        total_input: 1_000_000,
        total_output: 500_000,
        total_combined: 1_500_000,
        cost_estimate_usd: 10.5,
        per_task: {},
        session_start: new Date().toISOString(),
        plan_type: "api",
        window_allocation: Infinity,
      },
    });

    const output = renderProgress(checkpoint);

    expect(output).toContain("1,500,000");
    expect(output).not.toContain("Budget:");
  });

  it("shows [done] status for completed tasks", () => {
    const checkpoint = makeCheckpoint({
      tasks: {
        "task-done": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 30,
          tokens: null,
        },
      },
    });

    const output = renderProgress(checkpoint);
    expect(output).toContain("[done]");
    expect(output).toContain("task-done");
  });

  it("shows duration in seconds for tasks with duration_s set", () => {
    const checkpoint = makeCheckpoint({
      tasks: {
        "task-timed": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 42,
          tokens: null,
        },
      },
    });

    const output = renderProgress(checkpoint);
    expect(output).toContain("42s");
  });
});

describe("startLiveProgress", () => {
  it("returns an object with a stop() method", () => {
    const checkpointPath = path.join(tmpDir, "plan.progress.json");
    const handle = startLiveProgress(checkpointPath, 60_000);

    expect(handle).toBeDefined();
    expect(typeof handle.stop).toBe("function");

    handle.stop();
  });

  it("does not crash when checkpoint file does not exist", () => {
    const missingPath = path.join(tmpDir, "nonexistent.progress.json");

    expect(() => {
      const handle = startLiveProgress(missingPath, 60_000);
      handle.stop();
    }).not.toThrow();
  });

  it("does not crash when checkpoint file contains malformed JSON", () => {
    const badPath = path.join(tmpDir, "bad.progress.json");
    fs.writeFileSync(badPath, "{ this is not valid json !!!", "utf-8");

    expect(() => {
      const handle = startLiveProgress(badPath, 60_000);
      handle.stop();
    }).not.toThrow();
  });

  it("stop() does not crash when called multiple times", () => {
    const checkpointPath = path.join(tmpDir, "plan.progress.json");
    const checkpoint = makeCheckpoint();
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint), "utf-8");

    const handle = startLiveProgress(checkpointPath, 60_000);

    expect(() => {
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });

  it("renders progress when valid checkpoint file exists at start", () => {
    const checkpointPath = path.join(tmpDir, "valid.progress.json");
    const checkpoint = makeCheckpoint({
      plan: "feature-plan.md",
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: 10,
          tokens: null,
        },
      },
    });
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint), "utf-8");

    // Should not throw during initial render
    expect(() => {
      const handle = startLiveProgress(checkpointPath, 60_000);
      handle.stop();
    }).not.toThrow();
  });

  it("uses fake timers to verify interval fires without throwing", () => {
    vi.useFakeTimers();

    const checkpointPath = path.join(tmpDir, "timed.progress.json");
    const checkpoint = makeCheckpoint();
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint), "utf-8");

    const handle = startLiveProgress(checkpointPath, 1000);

    // Advance timer to trigger interval
    expect(() => {
      vi.advanceTimersByTime(3000);
    }).not.toThrow();

    handle.stop();
    vi.useRealTimers();
  });
});

import { describe, expect, it } from "vitest";
import { TokenTracker } from "../src/lib/token-tracker.js";
import { PLAN_ALLOCATIONS } from "../src/lib/constants.js";
import type { TokenUsage } from "../src/types.js";

function makeTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    total_input: 10_000,
    total_output: 5_000,
    total_combined: 15_000,
    cost_estimate_usd: 0.105,
    per_task: {
      "task-1": { input: 5_000, output: 2_500, model: "sonnet" },
      "task-2": { input: 3_000, output: 1_500, model: "haiku" },
      "task-3": { input: 2_000, output: 1_000, model: "sonnet" },
    },
    session_start: "2026-01-01T00:00:00.000Z",
    plan_type: "max5",
    window_allocation: 88_000,
    ...overrides,
  };
}

describe("TokenTracker.fromCheckpoint (resume flow)", () => {
  it("restores totals matching the original tracker", () => {
    // Build original tracker
    const original = new TokenTracker("max5");
    original.addTaskUsage("task-1", 5_000, 2_500, "sonnet");
    original.addTaskUsage("task-2", 3_000, 1_500, "haiku");
    original.addTaskUsage("task-3", 2_000, 1_000, "sonnet");

    const serialized = original.toCheckpointData();
    const restored = TokenTracker.fromCheckpoint(serialized);

    const originalTotals = original.getTotalUsage();
    const restoredTotals = restored.getTotalUsage();

    expect(restoredTotals.total_input).toBe(originalTotals.total_input);
    expect(restoredTotals.total_output).toBe(originalTotals.total_output);
    expect(restoredTotals.total_combined).toBe(originalTotals.total_combined);
    expect(restoredTotals.plan_type).toBe(originalTotals.plan_type);
  });

  it("resume + continue: restored tracker accumulates new tasks on top of old", () => {
    const original = new TokenTracker("max5");
    original.addTaskUsage("task-1", 5_000, 2_500, "sonnet");
    original.addTaskUsage("task-2", 3_000, 1_500, "haiku");
    original.addTaskUsage("task-3", 2_000, 1_000, "sonnet");

    const serialized = original.toCheckpointData();
    const restored = TokenTracker.fromCheckpoint(serialized);

    // Add 2 more tasks after restore
    restored.addTaskUsage("task-4", 4_000, 2_000, "sonnet");
    restored.addTaskUsage("task-5", 1_000, 500, "haiku");

    const oldTotal = original.getTotalUsage().total_combined; // 15_000
    const newTotal = restored.getTotalUsage().total_combined;

    expect(newTotal).toBe(oldTotal + 4_000 + 2_000 + 1_000 + 500);
    expect(newTotal).toBe(22_500);
  });

  it("creates a fresh tracker with zero usage when checkpoint token_usage is null-like data", () => {
    // Simulate a case where we construct manually with empty per_task
    const emptyUsage: TokenUsage = {
      total_input: 0,
      total_output: 0,
      total_combined: 0,
      cost_estimate_usd: 0,
      per_task: {},
      session_start: new Date().toISOString(),
      plan_type: "pro",
      window_allocation: 44_000,
    };

    const tracker = TokenTracker.fromCheckpoint(emptyUsage);
    const totals = tracker.getTotalUsage();

    expect(totals.total_input).toBe(0);
    expect(totals.total_output).toBe(0);
    expect(totals.total_combined).toBe(0);
    expect(totals.plan_type).toBe("pro");
  });

  it("fromCheckpoint preserves session_start timestamp from original", () => {
    const fixedSessionStart = "2026-01-15T10:30:00.000Z";
    const tokenUsage = makeTokenUsage({ session_start: fixedSessionStart });

    const restored = TokenTracker.fromCheckpoint(tokenUsage);
    const totals = restored.getTotalUsage();

    expect(totals.session_start).toBe(fixedSessionStart);
  });

  it("fromCheckpoint preserves plan_type from original", () => {
    const tokenUsage = makeTokenUsage({
      plan_type: "max20",
      window_allocation: 220_000,
    });

    const restored = TokenTracker.fromCheckpoint(tokenUsage);
    expect(restored.getTotalUsage().plan_type).toBe("max20");
  });

  it("fromCheckpoint preserves all per_task entries", () => {
    const tokenUsage = makeTokenUsage();

    const restored = TokenTracker.fromCheckpoint(tokenUsage);

    const task1 = restored.getTaskUsage("task-1");
    expect(task1).not.toBeNull();
    expect(task1!.input).toBe(5_000);
    expect(task1!.output).toBe(2_500);
    expect(task1!.model).toBe("sonnet");

    const task2 = restored.getTaskUsage("task-2");
    expect(task2).not.toBeNull();
    expect(task2!.model).toBe("haiku");

    const task3 = restored.getTaskUsage("task-3");
    expect(task3).not.toBeNull();
    expect(task3!.input).toBe(2_000);
  });

  it("formatBuildSummary() after restore includes all tasks (old + new)", () => {
    const original = new TokenTracker("max5");
    original.addTaskUsage("old-task-1", 5_000, 2_500, "sonnet");
    original.addTaskUsage("old-task-2", 3_000, 1_500, "haiku");

    const restored = TokenTracker.fromCheckpoint(original.toCheckpointData());
    restored.addTaskUsage("new-task-3", 2_000, 1_000, "sonnet");

    const summary = restored.formatBuildSummary();

    expect(summary).toContain("old-task-1");
    expect(summary).toContain("old-task-2");
    expect(summary).toContain("new-task-3");
    expect(summary).toContain("Build Token Summary");
    expect(summary).toContain("TOTAL");
  });

  it("serialized checkpoint data roundtrips correctly", () => {
    const original = new TokenTracker("max5");
    original.addTaskUsage("task-1", 5_000, 2_500, "sonnet");
    original.addTaskUsage("task-2", 3_000, 1_500, "haiku");

    const firstSerialized = original.toCheckpointData();
    const restored = TokenTracker.fromCheckpoint(firstSerialized);
    const secondSerialized = restored.toCheckpointData();

    expect(secondSerialized.total_input).toBe(firstSerialized.total_input);
    expect(secondSerialized.total_output).toBe(firstSerialized.total_output);
    expect(secondSerialized.total_combined).toBe(
      firstSerialized.total_combined,
    );
    expect(secondSerialized.plan_type).toBe(firstSerialized.plan_type);
    expect(secondSerialized.session_start).toBe(firstSerialized.session_start);
    expect(Object.keys(secondSerialized.per_task)).toEqual(
      Object.keys(firstSerialized.per_task),
    );
  });

  it("budget calculations are correct after restore (50K tokens on max5 = ~56.8%)", () => {
    const allocation = PLAN_ALLOCATIONS["max5"]; // 88_000
    const tokensUsed = 50_000;

    const tokenUsage: TokenUsage = {
      total_input: 25_000,
      total_output: 25_000,
      total_combined: tokensUsed,
      cost_estimate_usd: 0.5,
      per_task: {
        "task-1": { input: 25_000, output: 25_000, model: "sonnet" },
      },
      session_start: new Date().toISOString(),
      plan_type: "max5",
      window_allocation: allocation,
    };

    const restored = TokenTracker.fromCheckpoint(tokenUsage);
    const budgetPct = restored.getBudgetPercent();
    const expectedPct = (tokensUsed / allocation) * 100;

    expect(budgetPct).toBeCloseTo(expectedPct, 1);
    // 50000 / 88000 * 100 = 56.818...%
    expect(budgetPct).toBeGreaterThan(56);
    expect(budgetPct).toBeLessThan(58);
  });

  it("cost estimate is recalculated correctly after restore", () => {
    // sonnet: 3.0 per 1M input, 15.0 per 1M output
    const tokenUsage: TokenUsage = {
      total_input: 1_000_000,
      total_output: 1_000_000,
      total_combined: 2_000_000,
      cost_estimate_usd: 18.0, // stale value from original
      per_task: {
        "task-1": { input: 1_000_000, output: 1_000_000, model: "sonnet" },
      },
      session_start: new Date().toISOString(),
      plan_type: "api",
      window_allocation: Infinity,
    };

    const restored = TokenTracker.fromCheckpoint(tokenUsage);
    const cost = restored.estimateCost();

    // (1M / 1M) * 3.0 + (1M / 1M) * 15.0 = 18.0
    expect(cost).toBeCloseTo(18.0, 4);
  });
});

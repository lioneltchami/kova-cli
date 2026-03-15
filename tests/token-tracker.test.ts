import { beforeEach, describe, expect, it } from "vitest";
import { PLAN_ALLOCATIONS, TOKEN_COSTS } from "../src/lib/constants.js";
import { TokenTracker } from "../src/lib/token-tracker.js";

describe("TokenTracker", () => {
	let tracker: TokenTracker;

	beforeEach(() => {
		tracker = new TokenTracker("max5");
	});

	it("tracks token usage per task", () => {
		tracker.addTaskUsage("task-1", 1000, 500, "sonnet");
		const usage = tracker.getTaskUsage("task-1");
		expect(usage).not.toBeNull();
		expect(usage!.input).toBe(1000);
		expect(usage!.output).toBe(500);
		expect(usage!.total).toBe(1500);
		expect(usage!.model).toBe("sonnet");
	});

	it("calculates total usage across all tasks", () => {
		tracker.addTaskUsage("task-1", 1000, 500, "sonnet");
		tracker.addTaskUsage("task-2", 2000, 1000, "haiku");
		tracker.addTaskUsage("task-3", 500, 250, "opus");

		const total = tracker.getTotalUsage();
		expect(total.total_input).toBe(3500);
		expect(total.total_output).toBe(1750);
		expect(total.total_combined).toBe(5250);
		expect(total.per_task["task-1"]).toBeDefined();
		expect(total.per_task["task-2"]).toBeDefined();
		expect(total.per_task["task-3"]).toBeDefined();
	});

	it("calculates budget percentage for max5 plan", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		// Use exactly half
		const half = allocation / 2;
		tracker.addTaskUsage("task-1", half / 2, half / 2, "sonnet");

		const pct = tracker.getBudgetPercent();
		expect(pct).toBeCloseTo(50, 1);
	});

	it("calculates remaining tokens", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		tracker.addTaskUsage("task-1", 10000, 5000, "sonnet");

		const remaining = tracker.getRemainingTokens();
		expect(remaining).toBe(allocation - 15000);
	});

	it("estimates cost based on model rates", () => {
		// sonnet: 3.0 per 1M input, 15.0 per 1M output
		const sonnetRates = TOKEN_COSTS["sonnet"]!;
		const inputTokens = 1_000_000;
		const outputTokens = 1_000_000;
		tracker.addTaskUsage("task-1", inputTokens, outputTokens, "sonnet");

		const cost = tracker.estimateCost();
		const expectedCost =
			(inputTokens / 1_000_000) * sonnetRates.input +
			(outputTokens / 1_000_000) * sonnetRates.output;
		expect(cost).toBeCloseTo(expectedCost, 6);
	});

	it("warns at 80% budget", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		// Add 81% of allocation
		const tokens = Math.floor(allocation * 0.81);
		tracker.addTaskUsage("task-1", tokens / 2, tokens / 2, "haiku");

		expect(tracker.shouldWarn()).toBe(true);
	});

	it("does not warn below 80% budget", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		const tokens = Math.floor(allocation * 0.5);
		tracker.addTaskUsage("task-1", tokens / 2, tokens / 2, "haiku");

		expect(tracker.shouldWarn()).toBe(false);
	});

	it("pauses at 95% budget", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		const tokens = Math.floor(allocation * 0.96);
		tracker.addTaskUsage("task-1", tokens / 2, tokens / 2, "haiku");

		expect(tracker.shouldPause()).toBe(true);
	});

	it("does not pause below 95% budget", () => {
		const allocation = PLAN_ALLOCATIONS["max5"]; // 88000
		const tokens = Math.floor(allocation * 0.8);
		tracker.addTaskUsage("task-1", tokens / 2, tokens / 2, "haiku");

		expect(tracker.shouldPause()).toBe(false);
	});

	it("formats task summary string", () => {
		tracker.addTaskUsage("task-1", 1000, 500, "sonnet");
		const summary = tracker.formatTaskSummary("task-1");
		expect(summary).toContain("1000");
		expect(summary).toContain("500");
		expect(summary).toContain("1500");
	});

	it("formats task summary for unknown task", () => {
		const summary = tracker.formatTaskSummary("unknown-task");
		expect(summary).toContain("unknown-task");
		expect(summary).toContain("no usage recorded");
	});

	it("formats build summary with table", () => {
		tracker.addTaskUsage("task-1", 1000, 500, "sonnet");
		tracker.addTaskUsage("task-2", 2000, 1000, "haiku");

		const summary = tracker.formatBuildSummary();
		expect(summary).toContain("Build Token Summary");
		expect(summary).toContain("task-1");
		expect(summary).toContain("task-2");
		expect(summary).toContain("TOTAL");
		expect(summary).toContain("Estimated cost:");
		expect(summary).toContain("Budget used:");
		// Total combined: 1500 + 3000 = 4500
		expect(summary).toContain("4500");
	});

	it("serializes to checkpoint data", () => {
		tracker.addTaskUsage("task-1", 1000, 500, "sonnet");
		const data = tracker.toCheckpointData();

		expect(data.total_input).toBe(1000);
		expect(data.total_output).toBe(500);
		expect(data.total_combined).toBe(1500);
		expect(data.plan_type).toBe("max5");
		expect(data.window_allocation).toBe(PLAN_ALLOCATIONS["max5"]);
		expect(data.session_start).toBeTruthy();
		expect(data.per_task["task-1"]).toBeDefined();
	});

	it("handles api plan type (infinite budget)", () => {
		const apiTracker = new TokenTracker("api");
		// Add a lot of tokens
		apiTracker.addTaskUsage("task-1", 1_000_000, 500_000, "opus");

		// Budget percent should be 0 (infinite allocation)
		expect(apiTracker.getBudgetPercent()).toBe(0);
		// Remaining should be Infinity
		expect(apiTracker.getRemainingTokens()).toBe(Infinity);
		// Should never warn or pause
		expect(apiTracker.shouldWarn()).toBe(false);
		expect(apiTracker.shouldPause()).toBe(false);

		// Build summary should include the budget line but show 0.0% (infinite allocation means 0% used)
		const summary = apiTracker.formatBuildSummary();
		expect(summary).toContain("Build Token Summary");
		// api plan has infinite allocation, so getBudgetPercent returns 0 (finite), budget line still shows
		expect(summary).toContain("Budget used: 0.0% of api allocation");
	});
});

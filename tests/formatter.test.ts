import { describe, expect, it } from "vitest";
import {
	formatBudgetStatus,
	formatCostSummary,
	formatDailyTable,
	formatModelBreakdown,
	formatMoney,
	formatSparkline,
	formatTokens,
} from "../src/lib/formatter.js";
import type { CostSummary, KovaFinOpsConfig } from "../src/types.js";

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe("formatMoney", () => {
	it("formats zero correctly", () => {
		expect(formatMoney(0)).toBe("$0.00");
	});

	it("formats small decimal correctly", () => {
		expect(formatMoney(1.23)).toBe("$1.23");
	});

	it("formats large amount correctly", () => {
		expect(formatMoney(1234.56)).toBe("$1234.56");
	});

	it("always produces 2 decimal places", () => {
		expect(formatMoney(5)).toBe("$5.00");
		expect(formatMoney(0.1)).toBe("$0.10");
	});

	it("starts with dollar sign", () => {
		expect(formatMoney(42)).toMatch(/^\$/);
	});
});

// ---------------------------------------------------------------------------
// formatTokens
// ---------------------------------------------------------------------------

describe("formatTokens", () => {
	it("adds commas for large numbers", () => {
		expect(formatTokens(1234567)).toBe("1,234,567");
	});

	it("handles zero", () => {
		expect(formatTokens(0)).toBe("0");
	});

	it("handles small numbers without commas", () => {
		expect(formatTokens(999)).toBe("999");
	});

	it("formats millions correctly", () => {
		expect(formatTokens(2_000_000)).toBe("2,000,000");
	});

	it("rounds floating point values", () => {
		// toLocaleString with Math.round
		const result = formatTokens(1234.6);
		expect(result).toBe("1,235");
	});
});

// ---------------------------------------------------------------------------
// formatSparkline
// ---------------------------------------------------------------------------

describe("formatSparkline", () => {
	it("returns empty string for empty array", () => {
		expect(formatSparkline([])).toBe("");
	});

	it("produces correct length output equal to input array length", () => {
		const values = [1, 2, 3, 4, 5];
		expect(formatSparkline(values)).toHaveLength(5);
	});

	it("handles single value", () => {
		const result = formatSparkline([5]);
		expect(result).toHaveLength(1);
	});

	it("handles all same values - uses max density character", () => {
		const result = formatSparkline([3, 3, 3]);
		// When all values are equal (non-zero), they should all be max (idx=7)
		expect(result).toHaveLength(3);
		// All chars should be the same
		expect(new Set(result.split("")).size).toBe(1);
	});

	it("handles all-zero values - returns lowest block chars", () => {
		const result = formatSparkline([0, 0, 0]);
		// max === 0, so returns lowest char repeated
		expect(result).toHaveLength(3);
	});

	it("uses block characters from the sparkline set", () => {
		const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
		const result = formatSparkline([1, 2, 3, 4, 5]);
		for (const char of result) {
			expect(SPARKLINE_CHARS).toContain(char);
		}
	});

	it("highest value produces highest block character", () => {
		const result = formatSparkline([0, 0, 100]);
		// Last character should be the highest block
		expect(result[result.length - 1]).toBe("█");
	});
});

// ---------------------------------------------------------------------------
// formatDailyTable
// ---------------------------------------------------------------------------

describe("formatDailyTable", () => {
	it("shows dates and costs", () => {
		const daily = { "2026-03-15": 1.5, "2026-03-16": 2.3 };
		const result = formatDailyTable(daily);
		expect(result).toContain("2026-03-15");
		expect(result).toContain("2026-03-16");
		expect(result).toContain("$1.50");
		expect(result).toContain("$2.30");
	});

	it("returns a message for empty input", () => {
		const result = formatDailyTable({});
		expect(result).toContain("No daily data");
	});

	it("sorts dates chronologically", () => {
		const daily = { "2026-03-20": 1.0, "2026-03-10": 2.0, "2026-03-15": 0.5 };
		const result = formatDailyTable(daily);
		const lines = result.split("\n").filter((l) => l.includes("2026-03-"));
		const dates = lines.map((l) => l.match(/2026-03-\d+/)?.[0] ?? "");
		expect(dates).toEqual(["2026-03-10", "2026-03-15", "2026-03-20"]);
	});
});

// ---------------------------------------------------------------------------
// formatModelBreakdown
// ---------------------------------------------------------------------------

describe("formatModelBreakdown", () => {
	it("includes percentages in output", () => {
		const modelCosts = {
			sonnet: {
				cost_usd: 8.0,
				input_tokens: 1000,
				output_tokens: 500,
				requests: 2,
			},
			haiku: {
				cost_usd: 2.0,
				input_tokens: 500,
				output_tokens: 250,
				requests: 1,
			},
		};
		const result = formatModelBreakdown(modelCosts);
		expect(result).toContain("sonnet");
		expect(result).toContain("haiku");
		expect(result).toContain("%");
	});

	it("returns a message for empty input", () => {
		const result = formatModelBreakdown({});
		expect(result).toContain("No model data");
	});

	it("includes cost amounts", () => {
		const modelCosts = {
			opus: {
				cost_usd: 42.0,
				input_tokens: 1000,
				output_tokens: 500,
				requests: 5,
			},
		};
		const result = formatModelBreakdown(modelCosts);
		expect(result).toContain("$42.00");
	});
});

// ---------------------------------------------------------------------------
// formatBudgetStatus
// ---------------------------------------------------------------------------

function makeConfig(
	monthly: number | null = null,
	warnAt = 80,
): KovaFinOpsConfig {
	return {
		budget: { monthly_usd: monthly, daily_usd: null, warn_at_percent: warnAt },
		tracking: {
			tools: ["claude_code"],
			auto_sync: false,
			scan_interval_minutes: 60,
		},
		display: { currency: "usd", show_tokens: true, show_model_breakdown: true },
	};
}

describe("formatBudgetStatus", () => {
	it("shows 'not configured' when budget is null", () => {
		const config = makeConfig(null);
		const result = formatBudgetStatus(config, 10.0, "March 2026");
		expect(result).toContain("not configured");
	});

	it("shows current spend even when no budget is set", () => {
		const config = makeConfig(null);
		const result = formatBudgetStatus(config, 15.5, "March 2026");
		expect(result).toContain("$15.50");
	});

	it("shows percentage when budget is configured", () => {
		const config = makeConfig(100);
		const result = formatBudgetStatus(config, 50.0, "March 2026");
		expect(result).toContain("50%");
	});

	it("shows warning message when spend exceeds warn_at_percent", () => {
		const config = makeConfig(100, 80);
		// 85% of 100
		const result = formatBudgetStatus(config, 85.0, "March 2026");
		expect(result).toContain("Warning");
	});

	it("does not show warning when below warn_at_percent", () => {
		const config = makeConfig(100, 80);
		// 50% - below 80%
		const result = formatBudgetStatus(config, 50.0, "March 2026");
		expect(result).not.toContain("Warning");
	});

	it("includes period label in output", () => {
		const config = makeConfig(100);
		const result = formatBudgetStatus(config, 25.0, "test-period");
		expect(result).toContain("test-period");
	});

	it("shows both spent and budget amounts", () => {
		const config = makeConfig(200);
		const result = formatBudgetStatus(config, 100.0, "March 2026");
		expect(result).toContain("$100.00");
		expect(result).toContain("$200.00");
	});
});

// ---------------------------------------------------------------------------
// formatCostSummary
// ---------------------------------------------------------------------------

function makeSummary(overrides: Partial<CostSummary> = {}): CostSummary {
	return {
		total_cost_usd: overrides.total_cost_usd ?? 42.5,
		total_input_tokens: overrides.total_input_tokens ?? 1_000_000,
		total_output_tokens: overrides.total_output_tokens ?? 500_000,
		total_sessions: overrides.total_sessions ?? 15,
		by_tool: overrides.by_tool ?? {},
		by_model: overrides.by_model ?? {
			sonnet: {
				cost_usd: 30.0,
				input_tokens: 800_000,
				output_tokens: 400_000,
				requests: 10,
			},
			haiku: {
				cost_usd: 12.5,
				input_tokens: 200_000,
				output_tokens: 100_000,
				requests: 5,
			},
		},
		by_project: overrides.by_project ?? {},
		by_day: overrides.by_day ?? {
			"2026-03-14": 10.0,
			"2026-03-15": 32.5,
		},
		period: overrides.period ?? {
			from: "2026-03-01T00:00:00.000Z",
			to: "2026-03-19T00:00:00.000Z",
		},
	};
}

describe("formatCostSummary", () => {
	it("includes total spend", () => {
		const result = formatCostSummary(makeSummary({ total_cost_usd: 42.5 }));
		expect(result).toContain("$42.50");
	});

	it("includes session count", () => {
		const result = formatCostSummary(makeSummary({ total_sessions: 15 }));
		expect(result).toContain("15");
	});

	it("includes model breakdown entries", () => {
		const result = formatCostSummary(makeSummary());
		expect(result).toContain("sonnet");
		expect(result).toContain("haiku");
	});

	it("includes period information", () => {
		const result = formatCostSummary(makeSummary());
		// Should contain some date information (month names or year)
		expect(result).toContain("2026");
	});

	it("includes a daily trend sparkline when by_day has data", () => {
		const summary = makeSummary({
			by_day: {
				"2026-03-14": 10.0,
				"2026-03-15": 32.5,
				"2026-03-16": 5.0,
			},
		});
		const result = formatCostSummary(summary);
		expect(result).toContain("Daily Trend");
	});
});

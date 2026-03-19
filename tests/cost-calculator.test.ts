import { describe, expect, it } from "vitest";
import {
  aggregateCosts,
  computeCost,
  getDailyCosts,
  getModelCosts,
  getMonthlyCosts,
  getProjectCosts,
  getToolCosts,
} from "../src/lib/cost-calculator.js";
import type { UsageRecord } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: overrides.id ?? "rec-001",
    tool: overrides.tool ?? "claude_code",
    model: overrides.model ?? "sonnet",
    session_id: overrides.session_id ?? "session-001",
    project: overrides.project ?? "test-project",
    input_tokens: overrides.input_tokens ?? 1000,
    output_tokens: overrides.output_tokens ?? 500,
    cost_usd: overrides.cost_usd ?? 0.0105,
    timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
    duration_ms: overrides.duration_ms ?? null,
    metadata: overrides.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// computeCost
// ---------------------------------------------------------------------------

describe("computeCost", () => {
  it("returns correct cost for haiku model", () => {
    // haiku: input $0.25/1M, output $1.25/1M
    const cost = computeCost("haiku", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(1.5, 5);
  });

  it("returns correct cost for sonnet model", () => {
    // sonnet: input $3.00/1M, output $15.00/1M
    const cost = computeCost("sonnet", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.0, 5);
  });

  it("returns correct cost for opus model", () => {
    // opus: input $15.00/1M, output $75.00/1M
    const cost = computeCost("opus", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(90.0, 5);
  });

  it("returns 0 for unknown model", () => {
    const cost = computeCost("unknown", 1000, 500);
    expect(cost).toBe(0);
  });

  it("handles zero tokens", () => {
    const cost = computeCost("sonnet", 0, 0);
    expect(cost).toBe(0);
  });

  it("only charges input tokens when output is zero", () => {
    // sonnet: $3.00 per 1M input tokens
    const cost = computeCost("sonnet", 1_000_000, 0);
    expect(cost).toBeCloseTo(3.0, 5);
  });

  it("only charges output tokens when input is zero", () => {
    // sonnet: $15.00 per 1M output tokens
    const cost = computeCost("sonnet", 0, 1_000_000);
    expect(cost).toBeCloseTo(15.0, 5);
  });

  it("handles fractional token counts", () => {
    // 500k input at sonnet = $1.50
    const cost = computeCost("sonnet", 500_000, 0);
    expect(cost).toBeCloseTo(1.5, 5);
  });

  it("returns correct cost for gpt-4o model", () => {
    // gpt-4o: input $2.50/1M, output $10.00/1M
    const cost = computeCost("gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 5);
  });
});

// ---------------------------------------------------------------------------
// getDailyCosts
// ---------------------------------------------------------------------------

describe("getDailyCosts", () => {
  it("groups records by date correctly", () => {
    const records = [
      makeRecord({
        timestamp: "2026-03-15T10:00:00.000Z",
        cost_usd: 1.0,
        id: "r1",
      }),
      makeRecord({
        timestamp: "2026-03-15T14:00:00.000Z",
        cost_usd: 2.0,
        id: "r2",
      }),
      makeRecord({
        timestamp: "2026-03-16T08:00:00.000Z",
        cost_usd: 0.5,
        id: "r3",
      }),
    ];
    const daily = getDailyCosts(records);
    expect(daily["2026-03-15"]).toBeCloseTo(3.0, 5);
    expect(daily["2026-03-16"]).toBeCloseTo(0.5, 5);
  });

  it("returns empty object for empty records", () => {
    expect(getDailyCosts([])).toEqual({});
  });

  it("handles records across multiple days", () => {
    const records = [
      makeRecord({
        timestamp: "2026-01-01T00:00:00.000Z",
        cost_usd: 5.0,
        id: "r1",
      }),
      makeRecord({
        timestamp: "2026-01-15T00:00:00.000Z",
        cost_usd: 3.0,
        id: "r2",
      }),
      makeRecord({
        timestamp: "2026-02-01T00:00:00.000Z",
        cost_usd: 2.0,
        id: "r3",
      }),
    ];
    const daily = getDailyCosts(records);
    expect(Object.keys(daily)).toHaveLength(3);
    expect(daily["2026-01-01"]).toBeCloseTo(5.0, 5);
  });
});

// ---------------------------------------------------------------------------
// getMonthlyCosts
// ---------------------------------------------------------------------------

describe("getMonthlyCosts", () => {
  it("groups records by month correctly", () => {
    const records = [
      makeRecord({
        timestamp: "2026-03-01T10:00:00.000Z",
        cost_usd: 5.0,
        id: "r1",
      }),
      makeRecord({
        timestamp: "2026-03-15T10:00:00.000Z",
        cost_usd: 3.0,
        id: "r2",
      }),
      makeRecord({
        timestamp: "2026-04-01T10:00:00.000Z",
        cost_usd: 2.0,
        id: "r3",
      }),
    ];
    const monthly = getMonthlyCosts(records);
    expect(monthly["2026-03"]).toBeCloseTo(8.0, 5);
    expect(monthly["2026-04"]).toBeCloseTo(2.0, 5);
  });

  it("returns empty object for empty records", () => {
    expect(getMonthlyCosts([])).toEqual({});
  });

  it("uses YYYY-MM format keys", () => {
    const records = [makeRecord({ timestamp: "2026-03-15T10:00:00.000Z" })];
    const monthly = getMonthlyCosts(records);
    expect(Object.keys(monthly)[0]).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// getToolCosts
// ---------------------------------------------------------------------------

describe("getToolCosts", () => {
  it("groups by tool with correct cost breakdown", () => {
    const records = [
      makeRecord({
        tool: "claude_code",
        cost_usd: 1.0,
        input_tokens: 500,
        output_tokens: 250,
        id: "r1",
      }),
      makeRecord({
        tool: "claude_code",
        cost_usd: 2.0,
        input_tokens: 1000,
        output_tokens: 500,
        id: "r2",
      }),
    ];
    const toolCosts = getToolCosts(records);
    expect(toolCosts["claude_code"]?.cost_usd).toBeCloseTo(3.0, 5);
    expect(toolCosts["claude_code"]?.sessions).toBe(2);
    expect(toolCosts["claude_code"]?.input_tokens).toBe(1500);
  });

  it("collects unique models_used across records for a tool", () => {
    const records = [
      makeRecord({ tool: "claude_code", model: "sonnet", id: "r1" }),
      makeRecord({ tool: "claude_code", model: "haiku", id: "r2" }),
      makeRecord({ tool: "claude_code", model: "sonnet", id: "r3" }),
    ];
    const toolCosts = getToolCosts(records);
    const models = toolCosts["claude_code"]?.models_used ?? [];
    expect(models).toContain("sonnet");
    expect(models).toContain("haiku");
    // sonnet should not be duplicated
    expect(models.filter((m) => m === "sonnet")).toHaveLength(1);
  });

  it("returns empty object for empty records", () => {
    expect(getToolCosts([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getModelCosts
// ---------------------------------------------------------------------------

describe("getModelCosts", () => {
  it("groups by model with request counts", () => {
    const records = [
      makeRecord({ model: "sonnet", cost_usd: 5.0, id: "r1" }),
      makeRecord({ model: "sonnet", cost_usd: 3.0, id: "r2" }),
      makeRecord({ model: "haiku", cost_usd: 0.5, id: "r3" }),
    ];
    const modelCosts = getModelCosts(records);
    expect(modelCosts["sonnet"]?.requests).toBe(2);
    expect(modelCosts["sonnet"]?.cost_usd).toBeCloseTo(8.0, 5);
    expect(modelCosts["haiku"]?.requests).toBe(1);
  });

  it("accumulates token counts per model", () => {
    const records = [
      makeRecord({
        model: "opus",
        input_tokens: 1000,
        output_tokens: 500,
        id: "r1",
      }),
      makeRecord({
        model: "opus",
        input_tokens: 2000,
        output_tokens: 1000,
        id: "r2",
      }),
    ];
    const modelCosts = getModelCosts(records);
    expect(modelCosts["opus"]?.input_tokens).toBe(3000);
    expect(modelCosts["opus"]?.output_tokens).toBe(1500);
  });

  it("returns empty object for empty records", () => {
    expect(getModelCosts([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getProjectCosts
// ---------------------------------------------------------------------------

describe("getProjectCosts", () => {
  it("groups by project and sums cost", () => {
    const records = [
      makeRecord({ project: "proj-a", cost_usd: 1.0, id: "r1" }),
      makeRecord({ project: "proj-a", cost_usd: 2.0, id: "r2" }),
      makeRecord({ project: "proj-b", cost_usd: 0.5, id: "r3" }),
    ];
    const projectCosts = getProjectCosts(records);
    expect(projectCosts["proj-a"]).toBeCloseTo(3.0, 5);
    expect(projectCosts["proj-b"]).toBeCloseTo(0.5, 5);
  });

  it("skips null project records", () => {
    const records = [
      makeRecord({ project: null, cost_usd: 9.0, id: "r1" }),
      makeRecord({ project: "valid-proj", cost_usd: 1.0, id: "r2" }),
    ];
    const projectCosts = getProjectCosts(records);
    expect(Object.keys(projectCosts)).not.toContain("null");
    expect(projectCosts["valid-proj"]).toBeCloseTo(1.0, 5);
  });

  it("returns empty object for empty records", () => {
    expect(getProjectCosts([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// aggregateCosts
// ---------------------------------------------------------------------------

describe("aggregateCosts", () => {
  it("computes correct totals from records", () => {
    const records = [
      makeRecord({
        cost_usd: 5.0,
        input_tokens: 1000,
        output_tokens: 500,
        id: "r1",
      }),
      makeRecord({
        cost_usd: 3.0,
        input_tokens: 500,
        output_tokens: 250,
        id: "r2",
      }),
    ];
    const summary = aggregateCosts(records);
    expect(summary.total_cost_usd).toBeCloseTo(8.0, 5);
    expect(summary.total_input_tokens).toBe(1500);
    expect(summary.total_output_tokens).toBe(750);
  });

  it("counts unique sessions correctly", () => {
    const records = [
      makeRecord({ session_id: "sess-1", id: "r1" }),
      makeRecord({ session_id: "sess-1", id: "r2" }),
      makeRecord({ session_id: "sess-2", id: "r3" }),
    ];
    const summary = aggregateCosts(records);
    expect(summary.total_sessions).toBe(2);
  });

  it("filters by period when provided", () => {
    const records = [
      makeRecord({
        timestamp: "2026-01-01T00:00:00.000Z",
        cost_usd: 10.0,
        id: "r1",
      }),
      makeRecord({
        timestamp: "2026-03-15T00:00:00.000Z",
        cost_usd: 5.0,
        id: "r2",
      }),
      makeRecord({
        timestamp: "2026-05-01T00:00:00.000Z",
        cost_usd: 3.0,
        id: "r3",
      }),
    ];
    const period = {
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
    };
    const summary = aggregateCosts(records, period);
    expect(summary.total_cost_usd).toBeCloseTo(5.0, 5);
  });

  it("returns empty summary for empty records", () => {
    const summary = aggregateCosts([]);
    expect(summary.total_cost_usd).toBe(0);
    expect(summary.total_input_tokens).toBe(0);
    expect(summary.total_output_tokens).toBe(0);
    expect(summary.total_sessions).toBe(0);
  });

  it("includes by_tool, by_model, by_project, by_day in result", () => {
    const records = [makeRecord({})];
    const summary = aggregateCosts(records);
    expect(summary).toHaveProperty("by_tool");
    expect(summary).toHaveProperty("by_model");
    expect(summary).toHaveProperty("by_project");
    expect(summary).toHaveProperty("by_day");
    expect(summary).toHaveProperty("period");
  });

  it("period field uses provided date boundaries", () => {
    const records = [makeRecord({ timestamp: "2026-03-15T10:00:00.000Z" })];
    const from = new Date("2026-03-01T00:00:00.000Z");
    const to = new Date("2026-03-31T23:59:59.999Z");
    const summary = aggregateCosts(records, { from, to });
    expect(summary.period.from).toBe(from.toISOString());
    expect(summary.period.to).toBe(to.toISOString());
  });

  it("period from/to derived from data when not provided", () => {
    const records = [
      makeRecord({ timestamp: "2026-03-10T00:00:00.000Z", id: "r1" }),
      makeRecord({ timestamp: "2026-03-20T00:00:00.000Z", id: "r2" }),
    ];
    const summary = aggregateCosts(records);
    // Should use actual timestamps from data
    expect(summary.period.from).toBe("2026-03-10T00:00:00.000Z");
    expect(summary.period.to).toBe("2026-03-20T00:00:00.000Z");
  });
});

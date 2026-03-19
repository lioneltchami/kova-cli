import type {
  AiModel,
  AiTool,
  UsageRecord,
  CostSummary,
  ToolCostBreakdown,
  ModelCostBreakdown,
} from "../types.js";
import { TOKEN_COSTS } from "./constants.js";

/**
 * Compute the USD cost for a given model and token counts.
 * Returns 0 if the model is not found in TOKEN_COSTS.
 */
export function computeCost(
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = TOKEN_COSTS[model as string];
  if (!rates) return 0;
  return (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;
}

/**
 * Group records by YYYY-MM-DD date string and sum cost_usd per day.
 */
export function getDailyCosts(
  records: UsageRecord[],
): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const r of records) {
    const day = r.timestamp.slice(0, 10); // YYYY-MM-DD
    daily[day] = (daily[day] ?? 0) + r.cost_usd;
  }
  return daily;
}

/**
 * Group records by YYYY-MM month string and sum cost_usd per month.
 */
export function getMonthlyCosts(
  records: UsageRecord[],
): Record<string, number> {
  const monthly: Record<string, number> = {};
  for (const r of records) {
    const month = r.timestamp.slice(0, 7); // YYYY-MM
    monthly[month] = (monthly[month] ?? 0) + r.cost_usd;
  }
  return monthly;
}

/**
 * Group records by AI tool and return a breakdown per tool.
 */
export function getToolCosts(
  records: UsageRecord[],
): Partial<Record<AiTool, ToolCostBreakdown>> {
  const result: Partial<Record<AiTool, ToolCostBreakdown>> = {};
  for (const r of records) {
    const existing = result[r.tool];
    if (existing) {
      existing.cost_usd += r.cost_usd;
      existing.input_tokens += r.input_tokens;
      existing.output_tokens += r.output_tokens;
      existing.sessions += 1;
      if (!existing.models_used.includes(r.model)) {
        existing.models_used.push(r.model);
      }
    } else {
      result[r.tool] = {
        cost_usd: r.cost_usd,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        sessions: 1,
        models_used: [r.model],
      };
    }
  }
  return result;
}

/**
 * Group records by model name and return a breakdown per model.
 */
export function getModelCosts(
  records: UsageRecord[],
): Record<string, ModelCostBreakdown> {
  const result: Record<string, ModelCostBreakdown> = {};
  for (const r of records) {
    const existing = result[r.model];
    if (existing) {
      existing.cost_usd += r.cost_usd;
      existing.input_tokens += r.input_tokens;
      existing.output_tokens += r.output_tokens;
      existing.requests += 1;
    } else {
      result[r.model] = {
        cost_usd: r.cost_usd,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        requests: 1,
      };
    }
  }
  return result;
}

/**
 * Group records by project (skipping null) and sum cost_usd per project.
 */
export function getProjectCosts(
  records: UsageRecord[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const r of records) {
    if (r.project === null) continue;
    result[r.project] = (result[r.project] ?? 0) + r.cost_usd;
  }
  return result;
}

/**
 * Aggregate UsageRecord[] into a complete CostSummary.
 * Optionally filters to a date range via the `period` argument.
 */
export function aggregateCosts(
  records: UsageRecord[],
  period?: { from: Date; to: Date },
): CostSummary {
  let filtered = records;
  if (period) {
    filtered = records.filter((r) => {
      const ts = new Date(r.timestamp);
      return ts >= period.from && ts <= period.to;
    });
  }

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const sessionIds = new Set<string>();

  for (const r of filtered) {
    totalCost += r.cost_usd;
    totalInput += r.input_tokens;
    totalOutput += r.output_tokens;
    sessionIds.add(r.session_id);
  }

  // Determine period boundaries from actual data when not provided
  const timestamps = filtered.map((r) => r.timestamp).sort();
  const periodFrom = period
    ? period.from.toISOString()
    : (timestamps[0] ?? new Date().toISOString());
  const periodTo = period
    ? period.to.toISOString()
    : (timestamps[timestamps.length - 1] ?? new Date().toISOString());

  return {
    total_cost_usd: totalCost,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_sessions: sessionIds.size,
    by_tool: getToolCosts(filtered),
    by_model: getModelCosts(filtered),
    by_project: getProjectCosts(filtered),
    by_day: getDailyCosts(filtered),
    period: { from: periodFrom, to: periodTo },
  };
}

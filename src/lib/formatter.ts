import chalk from "chalk";
import type {
  CostSummary,
  ToolCostBreakdown,
  ModelCostBreakdown,
  KovaFinOpsConfig,
} from "../types.js";
import { colors } from "./constants.js";

// Sparkline block characters ordered from lowest to highest density
const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

// -------------------------------------------------------------------------
// Primitive formatters
// -------------------------------------------------------------------------

/** Format a USD amount as "$X.XX" (always 2 decimal places). */
export function formatMoney(amount: number): string {
  return "$" + amount.toFixed(2);
}

/** Format a large integer with comma separators, e.g. 1234567 -> "1,234,567". */
export function formatTokens(count: number): string {
  return Math.round(count).toLocaleString("en-US");
}

// -------------------------------------------------------------------------
// Sparkline
// -------------------------------------------------------------------------

/**
 * Convert an array of numbers into a single-line sparkline string using
 * block characters (▁▂▃▄▅▆▇█).  All values are normalized to the 0-7 range.
 * Returns an empty string for empty or all-zero inputs.
 */
export function formatSparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  if (max === 0) return SPARKLINE_CHARS[0].repeat(values.length);

  return values
    .map((v) => {
      const idx = Math.min(7, Math.round((v / max) * 7));
      return SPARKLINE_CHARS[idx];
    })
    .join("");
}

// -------------------------------------------------------------------------
// Daily table
// -------------------------------------------------------------------------

/**
 * Render a two-column table of date -> cost sorted chronologically.
 */
export function formatDailyTable(dailyCosts: Record<string, number>): string {
  const entries = Object.entries(dailyCosts).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (entries.length === 0) {
    return colors.dim("  No daily data available.");
  }

  const lines: string[] = [
    colors.bold("  Date          Cost"),
    colors.dim("  " + "-".repeat(24)),
  ];

  for (const [date, cost] of entries) {
    const dateStr = date.padEnd(14);
    lines.push(
      "  " + colors.dim(dateStr) + "  " + colors.brand(formatMoney(cost)),
    );
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Tool comparison
// -------------------------------------------------------------------------

/**
 * Render a per-tool cost comparison table.
 */
export function formatToolComparison(
  toolCosts: Partial<Record<string, ToolCostBreakdown>>,
): string {
  const entries = Object.entries(toolCosts) as [string, ToolCostBreakdown][];

  if (entries.length === 0) {
    return colors.dim("  No tool data available.");
  }

  // Sort by cost descending
  entries.sort(([, a], [, b]) => b.cost_usd - a.cost_usd);

  const totalCost = entries.reduce((s, [, v]) => s + v.cost_usd, 0);

  const lines: string[] = [
    colors.bold("  Tool            Cost       Sessions   Models"),
    colors.dim("  " + "-".repeat(54)),
  ];

  for (const [tool, bd] of entries) {
    const pct =
      totalCost > 0 ? ((bd.cost_usd / totalCost) * 100).toFixed(1) : "0.0";
    const toolStr = tool.padEnd(16);
    const costStr = formatMoney(bd.cost_usd).padEnd(10);
    const sessStr = String(bd.sessions).padEnd(10);
    const modelStr = bd.models_used.join(", ");
    lines.push(
      "  " +
        colors.info(toolStr) +
        colors.brand(costStr) +
        colors.dim(sessStr) +
        colors.wolf(modelStr) +
        colors.dim("  (" + pct + "%)"),
    );
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Model breakdown
// -------------------------------------------------------------------------

/**
 * Render a per-model cost breakdown table.
 */
export function formatModelBreakdown(
  modelCosts: Record<string, ModelCostBreakdown>,
): string {
  const entries = Object.entries(modelCosts);

  if (entries.length === 0) {
    return colors.dim("  No model data available.");
  }

  entries.sort(([, a], [, b]) => b.cost_usd - a.cost_usd);

  const totalCost = entries.reduce((s, [, v]) => s + v.cost_usd, 0);

  const lines: string[] = [
    colors.bold(
      "  Model          Cost       Requests   Tokens In      Tokens Out",
    ),
    colors.dim("  " + "-".repeat(68)),
  ];

  for (const [model, bd] of entries) {
    const pct =
      totalCost > 0 ? ((bd.cost_usd / totalCost) * 100).toFixed(1) : "0.0";
    const modelStr = model.padEnd(16);
    const costStr = formatMoney(bd.cost_usd).padEnd(10);
    const reqStr = String(bd.requests).padEnd(10);
    const inStr = formatTokens(bd.input_tokens).padEnd(14);
    const outStr = formatTokens(bd.output_tokens).padEnd(12);
    lines.push(
      "  " +
        colors.wolf(modelStr) +
        colors.brand(costStr) +
        colors.dim(reqStr) +
        colors.dim(inStr) +
        colors.dim(outStr) +
        colors.dim("(" + pct + "%)"),
    );
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Budget status
// -------------------------------------------------------------------------

/**
 * Render a budget progress bar with color coding:
 *   < 60%  -> green
 *   60-80% -> yellow
 *   > 80%  -> red
 */
export function formatBudgetStatus(
  config: KovaFinOpsConfig,
  currentSpend: number,
  period: string,
): string {
  const budget = config.budget.monthly_usd;

  if (budget === null || budget <= 0) {
    return (
      colors.dim("  Budget: ") +
      colors.wolf("not configured") +
      "\n  " +
      colors.dim("Current spend: ") +
      colors.brand(formatMoney(currentSpend))
    );
  }

  const pct = Math.min(100, (currentSpend / budget) * 100);
  const barWidth = 20;
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;

  const fillChar = "█";
  const emptyChar = "░";

  let colorFn: (text: string) => string;
  if (pct < 60) {
    colorFn = chalk.green;
  } else if (pct < 80) {
    colorFn = chalk.yellow;
  } else {
    colorFn = chalk.red;
  }

  const bar = colorFn(
    "[" + fillChar.repeat(filled) + emptyChar.repeat(empty) + "]",
  );
  const pctStr = pct.toFixed(0) + "%";
  const spendStr = formatMoney(currentSpend) + " / " + formatMoney(budget);

  const lines: string[] = [
    colors.bold("  Budget Status  ") + colors.dim("(" + period + ")"),
    "  " + bar + "  " + colorFn(pctStr) + "  " + colors.dim(spendStr),
  ];

  if (pct >= (config.budget.warn_at_percent ?? 80)) {
    lines.push("  " + chalk.yellow("  Warning: approaching budget limit."));
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Full cost summary
// -------------------------------------------------------------------------

/**
 * Render a complete human-readable cost summary for the terminal.
 *
 * Example output:
 *
 *   Kova Cost Summary
 *   =================
 *   Period: Mar 1 - Mar 19, 2026
 *
 *   Total Spend: $42.17
 *   Sessions: 156
 *   Tokens: 2,345,678 in / 1,234,567 out
 *
 *   By Model:
 *     sonnet    $28.50  (67.6%)
 *     opus      $12.30  (29.2%)
 *     haiku      $1.37   (3.2%)
 *
 *   Daily Trend: ▁▃▅▇▅▃▂▅▇█▅▃
 */
export function formatCostSummary(summary: CostSummary): string {
  const lines: string[] = [];

  // Header
  const title = "Kova Cost Summary";
  const rule = colors.brand("=".repeat(title.length + 4));
  lines.push("");
  lines.push(rule);
  lines.push(colors.bold.hex("#4361EE")("  " + title));
  lines.push(rule);
  lines.push("");

  // Period
  const fromLabel = formatDateLabel(summary.period.from);
  const toLabel = formatDateLabel(summary.period.to);
  lines.push(
    "  " + colors.dim("Period: ") + colors.wolf(fromLabel + " - " + toLabel),
  );
  lines.push("");

  // Totals
  lines.push(
    "  " +
      colors.dim("Total Spend: ") +
      colors.brand.bold(formatMoney(summary.total_cost_usd)),
  );
  lines.push(
    "  " +
      colors.dim("Sessions:    ") +
      colors.wolf(String(summary.total_sessions)),
  );
  lines.push(
    "  " +
      colors.dim("Tokens:      ") +
      colors.wolf(formatTokens(summary.total_input_tokens)) +
      colors.dim(" in / ") +
      colors.wolf(formatTokens(summary.total_output_tokens)) +
      colors.dim(" out"),
  );
  lines.push("");

  // By model
  const modelEntries = Object.entries(summary.by_model).sort(
    ([, a], [, b]) => b.cost_usd - a.cost_usd,
  );

  if (modelEntries.length > 0) {
    lines.push("  " + colors.bold("By Model:"));
    for (const [model, bd] of modelEntries) {
      const pct =
        summary.total_cost_usd > 0
          ? ((bd.cost_usd / summary.total_cost_usd) * 100).toFixed(1)
          : "0.0";
      const modelStr = ("    " + model).padEnd(14);
      const costStr = formatMoney(bd.cost_usd).padEnd(8);
      lines.push(
        colors.wolf(modelStr) +
          colors.brand(costStr) +
          colors.dim("  (" + pct + "%)"),
      );
    }
    lines.push("");
  }

  // Daily sparkline
  const dayEntries = Object.entries(summary.by_day).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (dayEntries.length > 0) {
    const dayValues = dayEntries.map(([, v]) => v);
    const sparkline = formatSparkline(dayValues);
    lines.push("  " + colors.dim("Daily Trend: ") + colors.brand(sparkline));
    lines.push("");
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

/** Format an ISO date string as "Mar 19, 2026". */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

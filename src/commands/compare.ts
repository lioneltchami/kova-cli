import chalk from "chalk";
import { colors } from "../lib/constants.js";
import { parseSinceDate } from "../lib/date-parser.js";
import { formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { AiTool } from "../types.js";

export interface CompareOptions {
  tools?: boolean;
  models?: boolean;
  period?: string; // 7d, 30d, 90d
}

interface GroupStats {
  name: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  cost_per_session: number;
  cost_per_1k_tokens: number;
}

function parsePeriodDays(period: string | undefined): number {
  if (!period) return 30;
  const parsed = parseSinceDate(period);
  if (parsed === null) {
    logger.warn(`Invalid period: "${period}". Defaulting to 30d.`);
    return 30;
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((Date.now() - parsed.getTime()) / msPerDay) || 30;
}

function buildGroupStats(
  groups: Map<
    string,
    { sessions: Set<string>; input: number; output: number; cost: number }
  >,
): GroupStats[] {
  const results: GroupStats[] = [];

  for (const [name, data] of groups) {
    const sessions = data.sessions.size;
    const total_tokens = data.input + data.output;
    const cost_per_session = sessions > 0 ? data.cost / sessions : 0;
    const cost_per_1k_tokens =
      total_tokens > 0 ? (data.cost / total_tokens) * 1000 : 0;

    results.push({
      name,
      sessions,
      input_tokens: data.input,
      output_tokens: data.output,
      cost: data.cost,
      cost_per_session,
      cost_per_1k_tokens,
    });
  }

  // Sort by cost descending
  results.sort((a, b) => b.cost - a.cost);
  return results;
}

function formatCompareTable(stats: GroupStats[], groupLabel: string): string {
  const lines: string[] = [];

  if (stats.length === 0) {
    return colors.dim("  No data available.");
  }

  // Find most efficient (lowest cost/1K tokens) and most expensive (highest total cost)
  const withTokens = stats.filter((s) => s.cost_per_1k_tokens > 0);
  const mostEfficient =
    withTokens.length > 0
      ? withTokens.reduce((a, b) =>
          a.cost_per_1k_tokens < b.cost_per_1k_tokens ? a : b,
        )
      : null;
  const mostExpensive = stats[0] ?? null; // already sorted by cost desc

  // Header
  const col1 = groupLabel.padEnd(16);
  const col2 = "Sessions".padEnd(10);
  const col3 = "Cost".padEnd(10);
  const col4 = "Cost/Session".padEnd(14);
  const col5 = "Cost/1K Tokens";

  lines.push(colors.bold(`  ${col1}${col2}${col3}${col4}${col5}`));
  lines.push(colors.dim("  " + "-".repeat(66)));

  for (const s of stats) {
    const isMostExpensive =
      mostExpensive && s.name === mostExpensive.name && stats.length > 1;
    const isMostEfficient =
      mostEfficient && s.name === mostEfficient.name && stats.length > 1;

    const nameStr = s.name.padEnd(16);
    const sessStr = String(s.sessions).padEnd(10);
    const costStr = formatMoney(s.cost).padEnd(10);
    const costPerSessStr = formatMoney(s.cost_per_session).padEnd(14);
    const costPer1kStr = formatMoney(s.cost_per_1k_tokens);

    let line = `  ${nameStr}${sessStr}${costStr}${costPerSessStr}${costPer1kStr}`;

    if (isMostExpensive) {
      line = chalk.yellow(line);
    } else if (isMostEfficient) {
      line = chalk.green(line);
    }

    lines.push(line);
  }

  return lines.join("\n");
}

export async function compareCommand(
  options: CompareOptions = {},
): Promise<void> {
  const periodDays = parsePeriodDays(options.period);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - periodDays);
  sinceDate.setHours(0, 0, 0, 0);

  const records = queryRecords({ since: sinceDate });

  if (records.length === 0) {
    logger.info(
      "No usage data found for the selected period. Run 'kova track' first.",
    );
    return;
  }

  // Default to --tools grouping when neither flag is set
  const groupByModel = options.models === true && options.tools !== true;

  const periodLabel = options.period
    ? `Last ${periodDays} Days`
    : "Last 30 Days";

  const groupLabel = groupByModel ? "Model" : "Tool";

  console.log();
  console.log(
    colors.bold.hex("#4361EE")(
      `  AI ${groupLabel} Cost Comparison (${periodLabel})`,
    ),
  );
  console.log(colors.brand("  " + "=".repeat(50)));
  console.log();

  // Build group map
  const groups = new Map<
    string,
    {
      sessions: Set<string>;
      input: number;
      output: number;
      cost: number;
    }
  >();

  for (const record of records) {
    const key = groupByModel ? record.model : record.tool;
    const existing = groups.get(key);
    if (existing) {
      existing.sessions.add(record.session_id);
      existing.input += record.input_tokens;
      existing.output += record.output_tokens;
      existing.cost += record.cost_usd;
    } else {
      groups.set(key, {
        sessions: new Set([record.session_id]),
        input: record.input_tokens,
        output: record.output_tokens,
        cost: record.cost_usd,
      });
    }
  }

  const stats = buildGroupStats(groups);

  console.log(formatCompareTable(stats, groupLabel));
  console.log();

  // Summary
  const totalCost = stats.reduce((s, g) => s + g.cost, 0);
  const totalSessions = stats.reduce((s, g) => s + g.sessions, 0);

  console.log(
    "  " +
      colors.dim("Total: ") +
      colors.brand.bold(formatMoney(totalCost)) +
      colors.dim(` across ${totalSessions.toLocaleString("en-US")} sessions`),
  );

  // Most efficient
  const withTokens = stats.filter((s) => s.cost_per_1k_tokens > 0);
  if (withTokens.length > 1) {
    const mostEfficient = withTokens.reduce((a, b) =>
      a.cost_per_1k_tokens < b.cost_per_1k_tokens ? a : b,
    );
    console.log(
      "  " +
        colors.dim("Most efficient: ") +
        chalk.green(mostEfficient.name) +
        colors.dim(
          ` (${formatMoney(mostEfficient.cost_per_1k_tokens)}/1K tokens)`,
        ),
    );
  }

  console.log();
}

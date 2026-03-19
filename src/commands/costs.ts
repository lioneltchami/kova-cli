import { readConfig } from "../lib/config-store.js";
import { aggregateCosts } from "../lib/cost-calculator.js";
import {
  formatBudgetStatus,
  formatCostSummary,
  formatDailyTable,
  formatToolComparison,
} from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { AiTool } from "../types.js";

export interface CostsOptions {
  today?: boolean;
  week?: boolean;
  month?: string | boolean;
  tool?: string;
  project?: string;
  detailed?: boolean;
  json?: boolean;
}

function getDateRange(options: CostsOptions): { from: Date; to: Date } | null {
  const now = new Date();

  if (options.today) {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { from, to };
  }

  if (options.week) {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }

  if (options.month !== undefined && options.month !== false) {
    // --month with YYYY-MM value, or --month alone (current month)
    if (
      typeof options.month === "string" &&
      options.month.match(/^\d{4}-\d{2}$/)
    ) {
      const [year, month] = options.month.split("-").map(Number) as [
        number,
        number,
      ];
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);
      return { from, to };
    }
    // Default: current month
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { from, to };
  }

  return null;
}

export async function costsCommand(options: CostsOptions = {}): Promise<void> {
  const dateRange = getDateRange(options);

  const records = queryRecords({
    tool: options.tool as AiTool | undefined,
    project: options.project,
    since: dateRange?.from,
    until: dateRange?.to,
  });

  if (records.length === 0) {
    logger.info("No usage data found. Run 'kova track' first.");
    return;
  }

  const summary = aggregateCosts(records);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(formatCostSummary(summary));

  if (options.detailed) {
    console.log();
    console.log(formatToolComparison(summary.by_tool));
    console.log();
    console.log(formatDailyTable(summary.by_day));
  }

  const config = readConfig();

  // Show daily budget bar for --today
  if (config.budget.daily_usd !== null && options.today) {
    console.log();
    console.log(formatBudgetStatus(config, summary.total_cost_usd, "today"));
  }

  // Show monthly budget bar only when viewing monthly data (not --today or --week)
  if (config.budget.monthly_usd !== null && !options.today && !options.week) {
    const periodLabel =
      options.month !== undefined && options.month !== false
        ? typeof options.month === "string"
          ? options.month
          : new Date().toISOString().slice(0, 7)
        : "all time";

    console.log();
    console.log(
      formatBudgetStatus(config, summary.total_cost_usd, periodLabel),
    );
  }
}

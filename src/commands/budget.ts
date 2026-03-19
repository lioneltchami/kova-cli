import { readConfig, updateConfig } from "../lib/config-store.js";
import { aggregateCosts } from "../lib/cost-calculator.js";
import { formatBudgetStatus, formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";

export interface BudgetOptions {
  monthly?: string;
  daily?: string;
  warnAt?: string;
}

export async function budgetCommand(
  action: string | undefined,
  options: BudgetOptions = {},
): Promise<void> {
  if (!action) {
    // Display current budget status
    const config = readConfig();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const records = queryRecords({ since: monthStart, until: monthEnd });
    const summary = aggregateCosts(records);
    const periodLabel = now.toISOString().slice(0, 7);

    logger.header("Budget Status");

    if (
      config.budget.monthly_usd === null &&
      config.budget.daily_usd === null
    ) {
      logger.info("No budget configured.");
      logger.info(
        "Set a budget with: kova budget set --monthly <amount> --daily <amount>",
      );
      console.log();
      logger.info(
        `Current month spend: ${formatMoney(summary.total_cost_usd)}`,
      );
      return;
    }

    console.log(
      formatBudgetStatus(config, summary.total_cost_usd, periodLabel),
    );

    if (config.budget.daily_usd !== null) {
      // Find today's spend
      const today = now.toISOString().slice(0, 10);
      const todayStart = new Date(today + "T00:00:00.000Z");
      const todayEnd = new Date(today + "T23:59:59.999Z");
      const todayRecords = queryRecords({
        since: todayStart,
        until: todayEnd,
      });
      const todaySummary = aggregateCosts(todayRecords);

      console.log();
      logger.table([
        ["daily budget", formatMoney(config.budget.daily_usd)],
        ["today spend", formatMoney(todaySummary.total_cost_usd)],
        ["warn at", String(config.budget.warn_at_percent ?? 80) + "%"],
      ]);
    }

    return;
  }

  if (action === "set") {
    const config = readConfig();

    let changed = false;

    if (options.monthly !== undefined) {
      const amount = parseFloat(options.monthly);
      if (isNaN(amount) || amount < 0) {
        logger.error(
          `Invalid monthly amount: "${options.monthly}". Must be a non-negative number.`,
        );
        return;
      }
      config.budget.monthly_usd = amount;
      changed = true;
    }

    if (options.daily !== undefined) {
      const amount = parseFloat(options.daily);
      if (isNaN(amount) || amount < 0) {
        logger.error(
          `Invalid daily amount: "${options.daily}". Must be a non-negative number.`,
        );
        return;
      }
      config.budget.daily_usd = amount;
      changed = true;
    }

    if (options.warnAt !== undefined) {
      const pct = parseFloat(options.warnAt);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        logger.error(
          `Invalid warn-at percentage: "${options.warnAt}". Must be 0-100.`,
        );
        return;
      }
      config.budget.warn_at_percent = pct;
      changed = true;
    }

    if (!changed) {
      logger.warn(
        "No budget values provided. Use --monthly, --daily, or --warn-at.",
      );
      return;
    }

    updateConfig({ budget: config.budget });

    const rows: [string, string][] = [];
    if (config.budget.monthly_usd !== null) {
      rows.push(["monthly budget", formatMoney(config.budget.monthly_usd)]);
    }
    if (config.budget.daily_usd !== null) {
      rows.push(["daily budget", formatMoney(config.budget.daily_usd)]);
    }
    rows.push(["warn at", String(config.budget.warn_at_percent) + "%"]);

    logger.success("Budget updated.");
    logger.table(rows);
    return;
  }

  if (action === "clear") {
    updateConfig({
      budget: {
        monthly_usd: null,
        daily_usd: null,
        warn_at_percent: 80,
      },
    });
    logger.success("Budget cleared.");
    return;
  }

  logger.error(`Unknown budget action: "${action}". Use set, clear, or omit.`);
}

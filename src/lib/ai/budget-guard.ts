import { colors } from "../constants.js";
import * as logger from "../logger.js";

export interface BudgetGuard {
  /** Record spending. Returns false if budget exceeded (hard stop). */
  recordSpend(amount: number): boolean;
  /** Check if budget is approaching or exceeded. */
  check(): BudgetStatus;
  /** Get total spent so far. */
  spent(): number;
}

export interface BudgetStatus {
  spent: number;
  budget: number;
  percent: number;
  warning: boolean;
  exceeded: boolean;
}

/**
 * Create a budget guard for a session.
 * @param budgetUsd Maximum budget in USD. If 0 or undefined, no enforcement.
 * @param warnPercent Percentage at which to warn (default 80).
 */
export function createBudgetGuard(
  budgetUsd: number | undefined,
  warnPercent = 80,
): BudgetGuard | null {
  if (!budgetUsd || budgetUsd <= 0) return null;

  let totalSpent = 0;
  let hasWarned = false;

  return {
    recordSpend(amount: number): boolean {
      totalSpent += amount;

      const percent = (totalSpent / budgetUsd) * 100;

      if (percent >= 100) {
        logger.warn(
          `Budget exceeded: ${colors.brand("$" + totalSpent.toFixed(4))} / $${budgetUsd.toFixed(2)} (${percent.toFixed(0)}%)`,
        );
        return false;
      }

      if (percent >= warnPercent && !hasWarned) {
        hasWarned = true;
        logger.warn(
          `Approaching budget: ${colors.brand("$" + totalSpent.toFixed(4))} / $${budgetUsd.toFixed(2)} (${percent.toFixed(0)}%)`,
        );
      }

      return true;
    },

    check(): BudgetStatus {
      const percent = budgetUsd > 0 ? (totalSpent / budgetUsd) * 100 : 0;
      return {
        spent: totalSpent,
        budget: budgetUsd,
        percent,
        warning: percent >= warnPercent,
        exceeded: percent >= 100,
      };
    },

    spent(): number {
      return totalSpent;
    },
  };
}

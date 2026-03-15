import type { ModelTier, PlanType, TokenUsage } from "../types.js";
import { PLAN_ALLOCATIONS, TOKEN_COSTS } from "./constants.js";

interface TaskEntry {
  input: number;
  output: number;
  model: ModelTier;
}

export class TokenTracker {
  private planType: PlanType;
  private taskUsage: Map<string, TaskEntry>;
  private sessionStart: string;

  constructor(planType: PlanType) {
    this.planType = planType;
    this.taskUsage = new Map();
    this.sessionStart = new Date().toISOString();
  }

  addTaskUsage(
    taskId: string,
    input: number,
    output: number,
    model: ModelTier,
  ): void {
    this.taskUsage.set(taskId, { input, output, model });
  }

  getTotalUsage(): TokenUsage {
    let totalInput = 0;
    let totalOutput = 0;

    const perTask: Record<
      string,
      { input: number; output: number; model: ModelTier }
    > = {};

    for (const [taskId, entry] of this.taskUsage) {
      totalInput += entry.input;
      totalOutput += entry.output;
      perTask[taskId] = {
        input: entry.input,
        output: entry.output,
        model: entry.model,
      };
    }

    const totalCombined = totalInput + totalOutput;

    return {
      total_input: totalInput,
      total_output: totalOutput,
      total_combined: totalCombined,
      cost_estimate_usd: this.estimateCost(),
      per_task: perTask,
      session_start: this.sessionStart,
      plan_type: this.planType,
      window_allocation: PLAN_ALLOCATIONS[this.planType],
    };
  }

  getTaskUsage(
    taskId: string,
  ): { input: number; output: number; total: number; model: ModelTier } | null {
    const entry = this.taskUsage.get(taskId);
    if (!entry) return null;
    return {
      input: entry.input,
      output: entry.output,
      total: entry.input + entry.output,
      model: entry.model,
    };
  }

  getBudgetPercent(): number {
    const allocation = PLAN_ALLOCATIONS[this.planType];
    if (!isFinite(allocation) || allocation === 0) return 0;

    let total = 0;
    for (const entry of this.taskUsage.values()) {
      total += entry.input + entry.output;
    }
    return (total / allocation) * 100;
  }

  getRemainingTokens(): number {
    const allocation = PLAN_ALLOCATIONS[this.planType];
    if (!isFinite(allocation)) return Infinity;

    let total = 0;
    for (const entry of this.taskUsage.values()) {
      total += entry.input + entry.output;
    }
    return allocation - total;
  }

  estimateCost(): number {
    let cost = 0;
    for (const entry of this.taskUsage.values()) {
      const rates = TOKEN_COSTS[entry.model];
      if (rates) {
        cost += (entry.input / 1_000_000) * rates.input;
        cost += (entry.output / 1_000_000) * rates.output;
      }
    }
    return cost;
  }

  formatTaskSummary(taskId: string): string {
    const usage = this.getTaskUsage(taskId);
    if (!usage) return `Task ${taskId}: no usage recorded`;
    return `Tokens: ${usage.input} input + ${usage.output} output = ${usage.total} total`;
  }

  formatBuildSummary(): string {
    const lines: string[] = [];

    lines.push("Build Token Summary");
    lines.push("=".repeat(60));

    // Header row
    const col1 = "Task".padEnd(30);
    const col2 = "Model".padEnd(8);
    const col3 = "Input".padStart(10);
    const col4 = "Output".padStart(10);
    const col5 = "Total".padStart(10);
    lines.push(`${col1} ${col2} ${col3} ${col4} ${col5}`);
    lines.push("-".repeat(60));

    let grandInput = 0;
    let grandOutput = 0;

    for (const [taskId, entry] of this.taskUsage) {
      grandInput += entry.input;
      grandOutput += entry.output;
      const total = entry.input + entry.output;

      const c1 = taskId.slice(0, 30).padEnd(30);
      const c2 = entry.model.padEnd(8);
      const c3 = entry.input.toString().padStart(10);
      const c4 = entry.output.toString().padStart(10);
      const c5 = total.toString().padStart(10);
      lines.push(`${c1} ${c2} ${c3} ${c4} ${c5}`);
    }

    lines.push("=".repeat(60));

    const grandTotal = grandInput + grandOutput;
    const totC1 = "TOTAL".padEnd(30);
    const totC2 = "".padEnd(8);
    const totC3 = grandInput.toString().padStart(10);
    const totC4 = grandOutput.toString().padStart(10);
    const totC5 = grandTotal.toString().padStart(10);
    lines.push(`${totC1} ${totC2} ${totC3} ${totC4} ${totC5}`);

    const cost = this.estimateCost();
    lines.push("");
    lines.push(`Estimated cost: $${cost.toFixed(4)} USD`);

    const budgetPct = this.getBudgetPercent();
    if (isFinite(budgetPct)) {
      lines.push(
        `Budget used: ${budgetPct.toFixed(1)}% of ${this.planType} allocation`,
      );
    }

    return lines.join("\n");
  }

  shouldWarn(): boolean {
    return this.getBudgetPercent() >= 80;
  }

  shouldPause(): boolean {
    return this.getBudgetPercent() >= 95;
  }

  toCheckpointData(): TokenUsage {
    return this.getTotalUsage();
  }

  static fromCheckpoint(tokenUsage: TokenUsage): TokenTracker {
    const tracker = new TokenTracker(tokenUsage.plan_type);
    tracker.sessionStart = tokenUsage.session_start;
    for (const [taskId, entry] of Object.entries(tokenUsage.per_task)) {
      tracker.taskUsage.set(taskId, {
        input: entry.input,
        output: entry.output,
        model: entry.model,
      });
    }
    return tracker;
  }
}

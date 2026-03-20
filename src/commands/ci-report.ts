import { colors } from "../lib/constants.js";
import { formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type {
  AiTool,
  ModelCostBreakdown,
  ToolCostBreakdown,
} from "../types.js";

export interface CiReportOptions {
  format?: string; // json | table
  period?: string; // 7d | 30d
}

interface ToolEntry {
  tool: AiTool;
  cost_usd: number;
  sessions: number;
}

interface ModelEntry {
  model: string;
  cost_usd: number;
  requests: number;
}

export interface CiReportOutput {
  period_cost_usd: number;
  baseline_cost_usd: number;
  delta_usd: number;
  delta_pct: number;
  by_tool: ToolEntry[];
  by_model: ModelEntry[];
  sessions: number;
  report_url: string;
}

function parsePeriodDays(period: string | undefined): number {
  if (!period) return 7;
  const match = /^(\d+)d$/.exec(period);
  if (match) return parseInt(match[1], 10);
  // Accept "30d", "7d" etc.; fallback to 7
  return 7;
}

function buildReport(sinceDate: Date): CiReportOutput {
  const records = queryRecords({ since: sinceDate });

  // Aggregate by tool
  const toolMap = new Map<AiTool, { cost: number; sessions: Set<string> }>();

  // Aggregate by model
  const modelMap = new Map<string, { cost: number; requests: number }>();

  let totalCost = 0;
  const allSessions = new Set<string>();

  for (const r of records) {
    totalCost += r.cost_usd;
    allSessions.add(r.session_id);

    // Tool
    const toolEntry = toolMap.get(r.tool);
    if (toolEntry) {
      toolEntry.cost += r.cost_usd;
      toolEntry.sessions.add(r.session_id);
    } else {
      toolMap.set(r.tool, {
        cost: r.cost_usd,
        sessions: new Set([r.session_id]),
      });
    }

    // Model
    const modelEntry = modelMap.get(r.model);
    if (modelEntry) {
      modelEntry.cost += r.cost_usd;
      modelEntry.requests += 1;
    } else {
      modelMap.set(r.model, { cost: r.cost_usd, requests: 1 });
    }
  }

  const by_tool: ToolEntry[] = Array.from(toolMap.entries())
    .map(([tool, d]) => ({
      tool,
      cost_usd: d.cost,
      sessions: d.sessions.size,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  const by_model: ModelEntry[] = Array.from(modelMap.entries())
    .map(([model, d]) => ({
      model,
      cost_usd: d.cost,
      requests: d.requests,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  // baseline_cost_usd defaults to 0 when no baseline file is present.
  // A CI run that writes .kova-baseline.json can supply a non-zero baseline
  // on the next run. delta_pct is 0 when both values are 0 (no division by zero).
  const baseline_cost_usd = 0;
  const delta_usd = totalCost - baseline_cost_usd;
  const delta_pct =
    baseline_cost_usd > 0 ? (delta_usd / baseline_cost_usd) * 100 : 0;

  return {
    period_cost_usd: totalCost,
    baseline_cost_usd,
    delta_usd,
    delta_pct,
    by_tool,
    by_model,
    sessions: allSessions.size,
    report_url: "https://kova.dev/dashboard",
  };
}

function formatTable(report: CiReportOutput, periodLabel: string): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    colors.bold.hex("#4361EE")(`  Kova CI Cost Report (${periodLabel})`),
  );
  lines.push(colors.brand("  " + "=".repeat(50)));
  lines.push("");
  lines.push(
    "  " +
      colors.dim("Period Cost: ") +
      colors.brand.bold(formatMoney(report.period_cost_usd)),
  );
  lines.push(
    "  " + colors.dim("Sessions:    ") + colors.wolf(String(report.sessions)),
  );
  lines.push("");

  if (report.by_tool.length > 0) {
    lines.push("  " + colors.bold("By Tool"));
    lines.push(colors.dim("  " + "-".repeat(42)));
    for (const t of report.by_tool) {
      const nameStr = t.tool.padEnd(18);
      const costStr = formatMoney(t.cost_usd).padEnd(10);
      const sessStr = `${t.sessions} sessions`;
      lines.push(
        "  " +
          colors.info(nameStr) +
          colors.brand(costStr) +
          colors.dim(sessStr),
      );
    }
    lines.push("");
  }

  if (report.by_model.length > 0) {
    lines.push("  " + colors.bold("By Model"));
    lines.push(colors.dim("  " + "-".repeat(42)));
    for (const m of report.by_model) {
      const nameStr = m.model.padEnd(18);
      const costStr = formatMoney(m.cost_usd).padEnd(10);
      const reqStr = `${m.requests} requests`;
      lines.push(
        "  " +
          colors.wolf(nameStr) +
          colors.brand(costStr) +
          colors.dim(reqStr),
      );
    }
    lines.push("");
  }

  lines.push(
    "  " + colors.dim("Dashboard: ") + colors.brand(report.report_url),
  );
  lines.push("");

  return lines.join("\n");
}

export async function ciReportCommand(
  options: CiReportOptions = {},
): Promise<void> {
  const periodDays = parsePeriodDays(options.period ?? "7d");
  const format = options.format ?? "table";

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - periodDays);
  sinceDate.setHours(0, 0, 0, 0);

  const report = buildReport(sinceDate);

  if (format === "json") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  // Table format
  const periodLabel = options.period === "30d" ? "Last 30 Days" : "Last 7 Days";
  process.stdout.write(formatTable(report, periodLabel));
}

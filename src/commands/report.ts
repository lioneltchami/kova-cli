import fs from "fs";
import { aggregateCosts } from "../lib/cost-calculator.js";
import { formatCostSummary } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { UsageRecord } from "../types.js";

export interface ReportOptions {
  format?: string;
  output?: string;
  month?: string;
}

const CSV_HEADERS =
  "date,tool,model,project,input_tokens,output_tokens,cost_usd\n";

function buildCsv(records: UsageRecord[]): string {
  const rows = records.map((r) => {
    const date = r.timestamp.slice(0, 10);
    const project = r.project ?? "";
    // Escape any commas or quotes in text fields
    const escapeCsv = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    return [
      date,
      escapeCsv(r.tool),
      escapeCsv(r.model),
      escapeCsv(project),
      String(r.input_tokens),
      String(r.output_tokens),
      r.cost_usd.toFixed(6),
    ].join(",");
  });

  return CSV_HEADERS + rows.join("\n") + "\n";
}

function getMonthRange(monthStr?: string): { from: Date; to: Date } | null {
  if (!monthStr) return null;

  if (!monthStr.match(/^\d{4}-\d{2}$/)) {
    return null;
  }

  const [year, month] = monthStr.split("-").map(Number) as [number, number];
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from, to };
}

export async function reportCommand(
  options: ReportOptions = {},
): Promise<void> {
  const format = options.format ?? "text";

  const dateRange = options.month ? getMonthRange(options.month) : null;

  if (options.month && !dateRange) {
    logger.error(
      `Invalid month format: "${options.month}". Use YYYY-MM (e.g. 2026-03).`,
    );
    return;
  }

  const records = queryRecords({
    since: dateRange?.from,
    until: dateRange?.to,
  });

  if (records.length === 0) {
    logger.info(
      "No usage data found for the specified period. Run 'kova track' first.",
    );
    return;
  }

  let output: string;

  if (format === "csv") {
    output = buildCsv(records);
  } else if (format === "json") {
    const summary = aggregateCosts(records);
    output = JSON.stringify(summary, null, 2) + "\n";
  } else {
    // Default: human-readable text summary
    const summary = aggregateCosts(records);
    output = formatCostSummary(summary);
  }

  if (options.output) {
    try {
      fs.writeFileSync(options.output, output, "utf-8");
      logger.success(`Report written to: ${options.output}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to write report to "${options.output}": ${msg}`);
    }
  } else {
    process.stdout.write(output);
  }
}

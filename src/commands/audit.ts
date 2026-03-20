import fs from "fs";
import { DASHBOARD_API_URL } from "../lib/constants.js";
import { readCredentials, isLoggedIn } from "../lib/dashboard.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { UsageRecord } from "../types.js";

export interface AuditExportOptions {
  format?: string; // csv | json
  since?: string; // YYYY-MM
  output?: string; // file path
  local?: boolean; // force local data even if logged in
}

function parseMonthSince(since: string | undefined): Date | undefined {
  if (!since) return undefined;
  if (!/^\d{4}-\d{2}$/.test(since)) return undefined;
  const [year, month] = since.split("-").map(Number) as [number, number];
  return new Date(year, month - 1, 1);
}

function recordsToCsv(records: UsageRecord[]): string {
  const header =
    "id,tool,model,session_id,project,input_tokens,output_tokens,cost_usd,timestamp,duration_ms\n";
  const escapeCsv = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };
  const rows = records.map((r) =>
    [
      escapeCsv(r.id),
      escapeCsv(r.tool),
      escapeCsv(r.model),
      escapeCsv(r.session_id),
      escapeCsv(r.project ?? ""),
      String(r.input_tokens),
      String(r.output_tokens),
      r.cost_usd.toFixed(6),
      escapeCsv(r.timestamp),
      r.duration_ms !== null ? String(r.duration_ms) : "",
    ].join(","),
  );
  return header + rows.join("\n") + "\n";
}

async function fetchRemoteAuditLog(
  apiKey: string,
  since: Date | undefined,
): Promise<UsageRecord[]> {
  const baseUrl = DASHBOARD_API_URL.replace("/api/v1", "");
  let url = `${baseUrl}/api/v2/audit-log`;
  if (since) {
    url += `?since=${since.toISOString()}`;
  }

  const records: UsageRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageUrl = url + (url.includes("?") ? "&" : "?") + `page=${page}`;
    const response = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(
        `API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      records: UsageRecord[];
      has_more?: boolean;
    };

    if (!Array.isArray(data.records) || data.records.length === 0) {
      hasMore = false;
    } else {
      records.push(...data.records);
      hasMore = data.has_more === true;
      page++;
    }
  }

  return records;
}

export async function auditExportCommand(
  options: AuditExportOptions = {},
): Promise<void> {
  const format = options.format ?? "json";
  const since = parseMonthSince(options.since);

  if (options.since && !since) {
    logger.error(
      `Invalid --since format: "${options.since}". Use YYYY-MM (e.g. 2026-01).`,
    );
    return;
  }

  let records: UsageRecord[];
  const useRemote = isLoggedIn() && !options.local;

  if (useRemote) {
    const creds = readCredentials();
    if (!creds?.apiKey) {
      logger.error("No API key found. Run 'kova login' first.");
      return;
    }

    logger.info("Fetching audit log from Kova cloud...");

    try {
      records = await fetchRemoteAuditLog(creds.apiKey, since);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `Could not fetch remote data: ${msg}. Falling back to local data.`,
      );
      records = queryRecords({ since });
    }
  } else {
    if (options.local) {
      logger.info("Using local data (--local flag).");
    } else {
      logger.info("Not logged in. Exporting local ~/.kova/ data.");
    }
    records = queryRecords({ since });
  }

  if (records.length === 0) {
    logger.info("No records found for the specified criteria.");
    return;
  }

  let output: string;
  if (format === "csv") {
    output = recordsToCsv(records);
  } else {
    output = JSON.stringify(records, null, 2) + "\n";
  }

  if (options.output) {
    try {
      fs.writeFileSync(options.output, output, "utf-8");
      logger.success(
        `Audit log written to: ${options.output} (${records.length} records)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to write to "${options.output}": ${msg}`);
    }
  } else {
    process.stdout.write(output);
  }
}

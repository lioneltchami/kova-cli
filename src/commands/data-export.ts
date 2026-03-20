import fs from "fs";
import path from "path";
import { readUsageDatabase } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";

export interface DataExportOptions {
  output?: string;
}

export async function dataExportCommand(
  options: DataExportOptions = {},
): Promise<void> {
  logger.info("Reading local usage database...");

  const db = readUsageDatabase();

  if (db.records.length === 0) {
    logger.info(
      "No usage records found locally. Run 'kova track' to collect data first.",
    );
  }

  // Build export payload without any credentials or sensitive config
  const exportPayload = {
    export_metadata: {
      exported_at: new Date().toISOString(),
      cli_version: (await import("../lib/constants.js")).VERSION,
      record_count: db.records.length,
      last_scan: db.last_scan,
    },
    usage_records: db.records.map((r) => ({
      id: r.id,
      tool: r.tool,
      model: r.model,
      session_id: r.session_id,
      project: r.project,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: r.cost_usd,
      timestamp: r.timestamp,
      duration_ms: r.duration_ms,
      // metadata is included but may contain tool-specific info (no API keys)
      metadata: sanitizeMetadata(r.metadata),
    })),
  };

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(`kova-export-${new Date().toISOString().slice(0, 10)}.json`);

  const content = JSON.stringify(exportPayload, null, 2);

  try {
    fs.writeFileSync(outputPath, content, { encoding: "utf-8", mode: 0o600 });
    logger.success(
      `Exported ${db.records.length} usage records to: ${outputPath}`,
    );
    logger.info(
      "This file contains your local usage data only -- no API keys or credentials.",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to write export file: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * Strip any metadata keys that could contain credentials.
 * Preserves informational keys (project, model info, etc.)
 */
function sanitizeMetadata(
  metadata: Record<string, string>,
): Record<string, string> {
  const BLOCKED_KEYS = [
    "api_key",
    "apikey",
    "token",
    "secret",
    "password",
    "auth",
    "credential",
    "key",
  ];

  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const lower = k.toLowerCase();
    if (!BLOCKED_KEYS.some((blocked) => lower.includes(blocked))) {
      result[k] = v;
    }
  }
  return result;
}

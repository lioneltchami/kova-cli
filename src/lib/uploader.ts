import type { UsageRecord, UsageUploadPayload } from "../types.js";
import { VERSION } from "./constants.js";
import { readCredentials } from "./dashboard.js";
import * as logger from "./logger.js";

const BATCH_SIZE = 500;

export async function uploadUsage(records: UsageRecord[]): Promise<boolean> {
  const creds = readCredentials();
  if (!creds?.apiKey) {
    logger.debug("uploadUsage: not logged in, skipping.");
    return false;
  }

  if (records.length === 0) return true;

  const timestamps = records.map((r) => r.timestamp).sort();
  const period = {
    from: timestamps[0] ?? new Date().toISOString(),
    to: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
  };

  // Split records into batches of BATCH_SIZE
  const batches: UsageRecord[][] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }

  const uploadUrl = `${creds.dashboardUrl}/api/v1/usage`;
  let allSucceeded = true;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;

    const payload: UsageUploadPayload = {
      cli_version: VERSION,
      records: batch.map((r) => ({
        tool: r.tool,
        model: r.model,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cost_usd: r.cost_usd,
        timestamp: r.timestamp,
        project: r.project,
      })),
      period,
      os: process.platform,
      node_version: process.version,
    };

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.debug(
          `Upload batch ${batchIndex + 1}/${batches.length} failed: HTTP ${response.status}`,
        );
        allSucceeded = false;
      } else {
        logger.debug(
          `Upload batch ${batchIndex + 1}/${batches.length} succeeded (${batch.length} records).`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(
        `Upload batch ${batchIndex + 1}/${batches.length} error: ${msg}`,
      );
      allSucceeded = false;
    }
  }

  return allSucceeded;
}

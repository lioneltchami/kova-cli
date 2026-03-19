import type {
  UsageRecord,
  UsageUploadPayload,
  UsageUploadResponse,
} from "../types.js";
import { VERSION } from "./constants.js";
import { readCredentials } from "./dashboard.js";
import * as logger from "./logger.js";

const BATCH_SIZE = 500;

export interface UploadResult {
  success: boolean;
  accepted: number;
  duplicates: number;
}

export async function uploadUsage(
  records: UsageRecord[],
): Promise<UploadResult> {
  const creds = readCredentials();
  if (!creds?.apiKey) {
    logger.debug("uploadUsage: not logged in, skipping.");
    return { success: false, accepted: 0, duplicates: 0 };
  }

  if (records.length === 0)
    return { success: true, accepted: 0, duplicates: 0 };

  // Split records into batches of BATCH_SIZE
  const batches: UsageRecord[][] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }

  const uploadUrl = `${creds.dashboardUrl}/api/v1/usage`;
  let allSucceeded = true;
  let totalAccepted = 0;
  let totalDuplicates = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;

    const payload: UsageUploadPayload = {
      records: batch.map((r) => ({
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
        cli_version: VERSION,
      })),
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
        const data = (await response.json()) as UsageUploadResponse;
        totalAccepted += data.accepted ?? 0;
        totalDuplicates += data.duplicates ?? 0;
        logger.debug(
          `Upload batch ${batchIndex + 1}/${batches.length} succeeded: ${data.accepted} accepted, ${data.duplicates} duplicates.`,
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

  return {
    success: allSucceeded,
    accepted: totalAccepted,
    duplicates: totalDuplicates,
  };
}

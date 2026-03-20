import crypto from "crypto";
import type { UsageRecord } from "../../types.js";
import { AMAZON_Q_TOKEN_COSTS } from "../constants.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

const TIMEOUT_MS = 15_000;

// AWS Cost Explorer API endpoint (us-east-1 only, as required by AWS).
const COST_EXPLORER_URL = "https://ce.us-east-1.amazonaws.com/";

// Amazon Q Developer service name in Cost Explorer.
const AMAZON_Q_SERVICE = "Amazon Q Developer";

interface CostResultsByTime {
  TimePeriod?: { Start?: string; End?: string };
  Total?: Record<string, { Amount?: string; Unit?: string }>;
  Groups?: Array<{
    Keys?: string[];
    Metrics?: Record<string, { Amount?: string; Unit?: string }>;
  }>;
}

interface CostExplorerResponse {
  ResultsByTime?: CostResultsByTime[];
}

/**
 * Retrieve AWS credentials from environment variables or from the stored
 * tool key in kova config.
 *
 * kova config set-key amazon_q <ACCESS_KEY_ID>:<SECRET_ACCESS_KEY>
 * OR set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY environment variables.
 */
function getAwsCredentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} | null {
  // Prefer environment variables (standard AWS SDK behaviour).
  const envKey = process.env["AWS_ACCESS_KEY_ID"];
  const envSecret = process.env["AWS_SECRET_ACCESS_KEY"];
  if (envKey && envSecret) {
    return { accessKeyId: envKey, secretAccessKey: envSecret };
  }

  // Fall back to kova stored key (format: "ACCESS_KEY_ID:SECRET_ACCESS_KEY").
  const stored = getToolKey("amazon_q");
  if (stored) {
    const parts = stored.split(":");
    if (parts.length >= 2) {
      const accessKeyId = parts[0] ?? "";
      const secretAccessKey = parts.slice(1).join(":");
      if (accessKeyId && secretAccessKey) {
        return { accessKeyId, secretAccessKey };
      }
    }
  }

  return null;
}

/**
 * Sign an AWS request using Signature Version 4.
 * This is a minimal implementation sufficient for Cost Explorer POST requests.
 */
async function signRequest(
  method: string,
  url: string,
  body: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string,
  service: string,
  amzDate: string,
  dateStamp: string,
): Promise<Record<string, string>> {
  const { createHmac, createHash } = await import("crypto");

  const payloadHash = createHash("sha256").update(body).digest("hex");
  const canonicalHeaders =
    `host:ce.us-east-1.amazonaws.com\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:AWSInsightsIndexService.GetCostAndUsage\n`;
  const signedHeaders = "host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    method,
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  function hmac(key: Buffer | string, data: string): Buffer {
    return createHmac("sha256", key).update(data).digest();
  }

  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), region),
      service,
    ),
    "aws4_request",
  );

  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authHeader,
    "x-amz-date": amzDate,
    "x-amz-target": "AWSInsightsIndexService.GetCostAndUsage",
    "Content-Type": "application/x-amz-json-1.1",
  };
}

function makeId(timePeriodStart: string, amount: string): string {
  return crypto
    .createHash("sha256")
    .update(`amazon_q:${timePeriodStart}:${amount}`)
    .digest("hex")
    .slice(0, 16);
}

export const amazonQCollector: Collector = {
  name: "amazon_q",

  async isAvailable(): Promise<boolean> {
    return getAwsCredentials() !== null;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const records: UsageRecord[] = [];

    const credentials = getAwsCredentials();
    if (!credentials) {
      return {
        tool: "amazon_q",
        records: [],
        errors: [],
        scanned_paths: [],
      };
    }

    const now = new Date();
    const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = (since ?? defaultSince).toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    // Cost Explorer requires start != end.
    if (startDate === endDate) {
      return { tool: "amazon_q", records: [], errors: [], scanned_paths: [] };
    }

    const requestBody = JSON.stringify({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: "DAILY",
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: [AMAZON_Q_SERVICE],
        },
      },
      Metrics: ["AmortizedCost"],
    });

    const now2 = new Date();
    const amzDate =
      now2
        .toISOString()
        .replace(/[:-]|\.\d{3}/g, "")
        .slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);

    let headers: Record<string, string>;
    try {
      headers = await signRequest(
        "POST",
        COST_EXPLORER_URL,
        requestBody,
        credentials,
        "us-east-1",
        "ce",
        amzDate,
        dateStamp,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to sign AWS request: ${msg}`);
      return { tool: "amazon_q", records: [], errors, scanned_paths: [] };
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(COST_EXPLORER_URL, {
          method: "POST",
          headers,
          body: requestBody,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Amazon Q AWS Cost Explorer network error: ${msg}`);
      return { tool: "amazon_q", records: [], errors, scanned_paths: [] };
    }

    if (response.status === 401 || response.status === 403) {
      errors.push(
        `Amazon Q AWS Cost Explorer returned ${response.status}. ` +
          "Check your AWS credentials and ensure the IAM policy includes ce:GetCostAndUsage.",
      );
      return { tool: "amazon_q", records: [], errors, scanned_paths: [] };
    }

    if (!response.ok) {
      errors.push(
        `Amazon Q AWS Cost Explorer returned HTTP ${response.status}.`,
      );
      return { tool: "amazon_q", records: [], errors, scanned_paths: [] };
    }

    let data: CostExplorerResponse;
    try {
      data = (await response.json()) as CostExplorerResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Amazon Q AWS Cost Explorer JSON parse error: ${msg}`);
      return { tool: "amazon_q", records: [], errors, scanned_paths: [] };
    }

    for (const period of data.ResultsByTime ?? []) {
      const periodStart = period.TimePeriod?.Start ?? "";
      const amountStr = period.Total?.["AmortizedCost"]?.Amount ?? "0";
      const cost_usd = parseFloat(amountStr);

      // Skip zero-cost periods.
      if (cost_usd === 0) continue;

      const timestamp = new Date(periodStart).toISOString();

      if (since !== undefined) {
        try {
          if (new Date(timestamp) < since) continue;
        } catch {
          // Include on unparseable.
        }
      }

      // Amazon Q Developer does not expose per-request token counts via
      // Cost Explorer, so we back-calculate tokens from cost for reporting.
      const estimatedInputTokens = Math.round(
        (cost_usd / AMAZON_Q_TOKEN_COSTS.input) * 1_000_000 * 0.8,
      );
      const estimatedOutputTokens = Math.round(
        (cost_usd / AMAZON_Q_TOKEN_COSTS.output) * 1_000_000 * 0.2,
      );

      const id = makeId(periodStart, amountStr);

      records.push({
        id,
        tool: "amazon_q",
        model: "unknown",
        session_id: "",
        project: null,
        input_tokens: estimatedInputTokens,
        output_tokens: estimatedOutputTokens,
        cost_usd,
        timestamp,
        duration_ms: null,
        metadata: {
          source: "aws_cost_explorer",
          period_start: periodStart,
          period_end: period.TimePeriod?.End ?? "",
          service: AMAZON_Q_SERVICE,
        },
      });
    }

    return {
      tool: "amazon_q",
      records,
      errors,
      scanned_paths: [COST_EXPLORER_URL],
    };
  },
};

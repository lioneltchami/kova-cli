import crypto from "crypto";
import type { AiModel, UsageRecord } from "../../types.js";
import { CURSOR_POOL_RATES } from "../constants.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

interface CursorUsageEvent {
  timestamp?: string;
  model?: string;
  kind?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalCents?: number;
  };
  chargedCents?: number;
}

interface CursorApiResponse {
  events?: CursorUsageEvent[];
  data?: CursorUsageEvent[];
  [key: string]: unknown;
}

function mapCursorModel(raw: string | undefined): AiModel {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  if (lower.includes("gpt-4.1")) return "gpt-4.1";
  if (lower.includes("gpt-5-mini") || lower.includes("gpt-5 mini"))
    return "gpt-5-mini";
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("gemini") && lower.includes("flash"))
    return "gemini-flash";
  if (lower.includes("gemini") && lower.includes("pro")) return "gemini-pro";
  return "unknown";
}

function makeId(timestamp: string, model: string, inputTokens: number): string {
  return crypto
    .createHash("sha256")
    .update(`cursor:${timestamp}:${model}:${inputTokens}`)
    .digest("hex")
    .slice(0, 16);
}

function computeCostFromTokens(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * CURSOR_POOL_RATES.input +
      outputTokens * CURSOR_POOL_RATES.output) /
    1_000_000
  );
}

function extractEvents(body: CursorApiResponse): CursorUsageEvent[] {
  if (Array.isArray(body.events)) return body.events;
  if (Array.isArray(body.data)) return body.data;
  // Some responses may return the array at the top level.
  if (Array.isArray(body)) return body as unknown as CursorUsageEvent[];
  return [];
}

async function fetchPage(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  errors: string[],
): Promise<CursorUsageEvent[] | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Cursor API network error: ${msg}`);
    return null;
  }

  if (response.status === 401) {
    errors.push(
      "Cursor API key invalid or expired. Run: kova config set-key cursor <new-key>",
    );
    return null;
  }

  if (response.status === 429) {
    errors.push("Cursor API rate limit exceeded. Try again later.");
    return null;
  }

  if (!response.ok) {
    errors.push(
      `Cursor API returned HTTP ${response.status}: ${response.statusText}`,
    );
    return null;
  }

  let parsed: CursorApiResponse;
  try {
    parsed = (await response.json()) as CursorApiResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Cursor API JSON parse error: ${msg}`);
    return null;
  }

  return extractEvents(parsed);
}

export const cursorCollector: Collector = {
  name: "cursor",

  async isAvailable(): Promise<boolean> {
    return getToolKey("cursor") !== null;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const records: UsageRecord[] = [];

    const key = getToolKey("cursor");
    if (!key) {
      errors.push(
        "No Cursor API key configured. Run: kova config set-key cursor <key>",
      );
      return { tool: "cursor", records, errors, scanned_paths: [] };
    }

    const isPersonal = key.startsWith("user_");
    const nowMs = Date.now();
    const sinceMs = since ? since.getTime() : nowMs - 30 * 24 * 60 * 60 * 1000;

    let url: string;
    let headers: Record<string, string>;

    if (isPersonal) {
      url = "https://www.cursor.com/api/dashboard/get-filtered-usage-events";
      headers = {
        Cookie: `WorkosCursorSessionToken=${key}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        Origin: "https://cursor.com",
        Referer: "https://cursor.com/cn/dashboard",
      };
    } else {
      url = "https://api.cursor.com/teams/filtered-usage-events";
      headers = {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
      };
    }

    const seenIds = new Set<string>();
    let page = 1;

    while (true) {
      const pageBody: Record<string, unknown> = {
        startDate: sinceMs,
        endDate: nowMs,
        page,
        pageSize: 100,
      };

      const events = await fetchPage(url, headers, pageBody, errors);

      // Stop on error or empty page.
      if (!events || events.length === 0) break;

      for (const event of events) {
        let timestamp: string;
        try {
          timestamp = event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date(0).toISOString();
        } catch {
          timestamp = new Date(0).toISOString();
        }

        // Skip events before `since`.
        if (since !== undefined) {
          try {
            if (new Date(timestamp) < since) continue;
          } catch {
            // Include if unparseable.
          }
        }

        const model = mapCursorModel(event.model);
        const inputTokens = event.tokenUsage?.inputTokens ?? 0;
        const outputTokens = event.tokenUsage?.outputTokens ?? 0;

        let cost_usd: number;
        if (event.tokenUsage?.totalCents !== undefined) {
          cost_usd = event.tokenUsage.totalCents / 100;
        } else {
          cost_usd = computeCostFromTokens(inputTokens, outputTokens);
        }

        const id = makeId(timestamp, event.model ?? "", inputTokens);

        // Deduplicate within this collection run.
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        records.push({
          id,
          tool: "cursor",
          model,
          session_id: "",
          project: null,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd,
          timestamp,
          duration_ms: null,
          metadata: {
            raw_model: event.model ?? "",
            kind: event.kind ?? "",
          },
        });
      }

      // If fewer than pageSize events were returned, we've reached the last page.
      if (events.length < 100) break;

      page++;
    }

    return {
      tool: "cursor",
      records,
      errors,
      scanned_paths: [],
    };
  },
};

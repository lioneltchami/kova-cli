import crypto from "crypto";
import type { AiModel, UsageRecord } from "../../types.js";
import { WINDSURF_CREDIT_RATE_TEAMS } from "../constants.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

const WINDSURF_API_URL = "https://server.codeium.com/api/v1/CascadeAnalytics";
const TIMEOUT_MS = 15_000;

interface CascadeRun {
  day?: string;
  model?: string;
  mode?: string;
  messagesSent?: number;
  promptsUsed?: number;
}

interface WindsurfResponse {
  queryResults?: Array<{
    cascadeRuns?: CascadeRun[];
  }>;
}

function mapModelName(raw: string | undefined | null): AiModel {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("swe-1")) return "swe-1.5";
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  if (lower.includes("gpt-4.1")) return "gpt-4.1";
  if (lower.includes("gpt-5-mini")) return "gpt-5-mini";
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("gemini-flash")) return "gemini-flash";
  if (lower.includes("gemini")) return "gemini-pro";
  return "unknown";
}

function makeId(
  day: string,
  model: string,
  mode: string,
  messagesSent: number,
  promptsUsed: number,
): string {
  return crypto
    .createHash("sha256")
    .update(`windsurf:${day}:${model}:${mode}:${messagesSent}:${promptsUsed}`)
    .digest("hex")
    .slice(0, 16);
}

export const windsurfCollector: Collector = {
  name: "windsurf",

  async isAvailable(): Promise<boolean> {
    return getToolKey("windsurf") !== null;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const records: UsageRecord[] = [];

    const key = getToolKey("windsurf");
    if (!key) {
      return { tool: "windsurf", records: [], errors: [], scanned_paths: [] };
    }

    const now = new Date();
    const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startTimestamp = (since ?? defaultSince).toISOString();
    const endTimestamp = now.toISOString();

    const body = {
      service_key: key,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      query_requests: [{ cascade_runs: {} }],
    };

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(WINDSURF_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Windsurf API network error: ${msg}`);
      return { tool: "windsurf", records: [], errors, scanned_paths: [] };
    }

    if (response.status === 401) {
      errors.push(
        "Windsurf API returned 401 Unauthorized. Check your service key.",
      );
      return { tool: "windsurf", records: [], errors, scanned_paths: [] };
    }

    if (response.status === 429) {
      errors.push(
        "Windsurf API returned 429 Too Many Requests. Try again later.",
      );
      return { tool: "windsurf", records: [], errors, scanned_paths: [] };
    }

    if (!response.ok) {
      errors.push(`Windsurf API returned HTTP ${response.status}.`);
      return { tool: "windsurf", records: [], errors, scanned_paths: [] };
    }

    let data: WindsurfResponse;
    try {
      data = (await response.json()) as WindsurfResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Windsurf API JSON parse error: ${msg}`);
      return { tool: "windsurf", records: [], errors, scanned_paths: [] };
    }

    const runs = data?.queryResults?.[0]?.cascadeRuns ?? [];

    for (const run of runs) {
      const day = run.day ?? "";
      const rawModel = run.model ?? "";
      const mode = run.mode ?? "";
      const messagesSent = run.messagesSent ?? 0;
      const promptsUsed = run.promptsUsed ?? 0;

      // promptsUsed is in cents; convert to credits and then to USD
      const credits = promptsUsed / 100;
      const cost = credits * WINDSURF_CREDIT_RATE_TEAMS;

      const model = mapModelName(rawModel);
      const id = makeId(day, rawModel, mode, messagesSent, promptsUsed);

      // day is a date string like "2025-01-15"; build an ISO timestamp
      const timestamp = day
        ? new Date(day).toISOString()
        : new Date().toISOString();

      records.push({
        id,
        tool: "windsurf",
        model,
        session_id: "",
        project: null,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: cost,
        timestamp,
        duration_ms: null,
        metadata: {
          raw_model: rawModel,
          mode,
          messages_sent: String(messagesSent),
          prompts_used: String(promptsUsed),
          credits: String(credits),
        },
      });
    }

    return {
      tool: "windsurf",
      records,
      errors,
      scanned_paths: [WINDSURF_API_URL],
    };
  },
};

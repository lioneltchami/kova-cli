import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { AiModel, UsageRecord } from "../../types.js";
import {
  AIDER_CHAT_HISTORY_NAMES,
  AIDER_REPORTS_DIR,
  AIDER_SEARCH_ROOTS,
  TOKEN_COSTS,
} from "../constants.js";
import type { Collector, CollectorResult } from "./types.js";

// Shape of a structured Aider cost report JSON file.
interface AiderReportEntry {
  timestamp?: string;
  model?: string;
  cost?: number;
  tokens?: {
    input?: number;
    output?: number;
    sent?: number;
    received?: number;
  };
  send_tokens?: number;
  recv_tokens?: number;
  total_cost?: number;
}

/**
 * Map an Aider model string to our canonical AiModel type.
 * Aider supports Claude, GPT-4, and Gemini models.
 */
function mapAiderModel(raw: string | undefined | null): AiModel {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
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
  if (lower.includes("gemini") && lower.includes("flash"))
    return "gemini-flash";
  if (lower.includes("gemini")) return "gemini-pro";
  return "unknown";
}

function computeCost(
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = TOKEN_COSTS[model];
  if (!rates) return 0;
  return (
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output
  );
}

function makeId(prefix: string, ...parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update([prefix, ...parts].join(":"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Parse a single Aider report JSON file (one entry or array of entries).
 */
function parseReportFile(
  filePath: string,
  since: Date | undefined,
  errors: string[],
): UsageRecord[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to read ${filePath}: ${msg}`);
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`JSON parse error in ${filePath}: ${msg}`);
    return [];
  }

  const entries: AiderReportEntry[] = Array.isArray(parsed)
    ? (parsed as AiderReportEntry[])
    : [parsed as AiderReportEntry];

  const records: UsageRecord[] = [];

  for (const entry of entries) {
    const timestamp = entry.timestamp ?? new Date(0).toISOString();

    if (since !== undefined) {
      try {
        if (new Date(timestamp) < since) continue;
      } catch {
        // Include on unparseable timestamp.
      }
    }

    const rawModel = entry.model ?? "";
    const model = mapAiderModel(rawModel);

    // Support both token field shapes used across Aider versions.
    const inputTokens =
      entry.tokens?.input ?? entry.tokens?.sent ?? entry.send_tokens ?? 0;
    const outputTokens =
      entry.tokens?.output ?? entry.tokens?.received ?? entry.recv_tokens ?? 0;

    // Use reported cost if available, otherwise compute from tokens.
    const costRaw = entry.cost ?? entry.total_cost ?? null;
    const cost_usd =
      costRaw !== null
        ? costRaw
        : computeCost(model, inputTokens, outputTokens);

    const id = makeId("aider", filePath, timestamp, rawModel);

    records.push({
      id,
      tool: "aider",
      model,
      session_id: "",
      project: null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd,
      timestamp,
      duration_ms: null,
      metadata: {
        raw_model: rawModel,
        source: "report",
        file: filePath,
      },
    });
  }

  return records;
}

/**
 * Estimate usage from chat history line count when no structured report exists.
 * Each exchange is approximated at ~2000 input tokens and ~500 output tokens.
 */
function estimateFromChatHistory(
  historyPath: string,
  since: Date | undefined,
  errors: string[],
): UsageRecord[] {
  let raw: string;
  try {
    raw = fs.readFileSync(historyPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to read ${historyPath}: ${msg}`);
    return [];
  }

  // Count #### USER: markers as session exchange boundaries.
  const exchangeCount = (raw.match(/^#{1,4}\s+USER:/gm) ?? []).length;
  if (exchangeCount === 0) return [];

  const stat = fs.statSync(historyPath);
  const timestamp = stat.mtime.toISOString();

  if (since !== undefined) {
    try {
      if (new Date(timestamp) < since) return [];
    } catch {
      // Include on unparseable.
    }
  }

  // Rough token estimate per exchange.
  const INPUT_PER_EXCHANGE = 2000;
  const OUTPUT_PER_EXCHANGE = 500;
  const inputTokens = exchangeCount * INPUT_PER_EXCHANGE;
  const outputTokens = exchangeCount * OUTPUT_PER_EXCHANGE;
  const cost_usd = computeCost("unknown", inputTokens, outputTokens);

  const id = makeId("aider-estimate", historyPath, timestamp);

  return [
    {
      id,
      tool: "aider",
      model: "unknown",
      session_id: "",
      project: null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd,
      timestamp,
      duration_ms: null,
      metadata: {
        source: "chat_history_estimate",
        exchanges: String(exchangeCount),
        file: historyPath,
      },
    },
  ];
}

/**
 * Search common locations for Aider chat history and report files.
 * Returns all candidate paths that exist.
 */
function findAiderFiles(): {
  chatHistories: string[];
  reportDirs: string[];
} {
  const searchRoots = AIDER_SEARCH_ROOTS;
  const chatHistories: string[] = [];
  const reportDirs: string[] = [];

  for (const root of searchRoots) {
    for (const name of AIDER_CHAT_HISTORY_NAMES) {
      const p = path.join(root, name);
      if (fs.existsSync(p)) chatHistories.push(p);
    }

    const reportsDir = path.join(root, AIDER_REPORTS_DIR);
    if (fs.existsSync(reportsDir)) reportDirs.push(reportsDir);
  }

  return { chatHistories, reportDirs };
}

export const aiderCollector: Collector = {
  name: "aider",

  async isAvailable(): Promise<boolean> {
    const { chatHistories, reportDirs } = findAiderFiles();
    return chatHistories.length > 0 || reportDirs.length > 0;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const scanned_paths: string[] = [];
    const records: UsageRecord[] = [];

    const { chatHistories, reportDirs } = findAiderFiles();

    // Parse structured report files first.
    for (const reportsDir of reportDirs) {
      let files: string[];
      try {
        files = fs
          .readdirSync(reportsDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.join(reportsDir, f));
      } catch {
        continue;
      }

      for (const filePath of files) {
        scanned_paths.push(filePath);
        const fileRecords = parseReportFile(filePath, since, errors);
        records.push(...fileRecords);
      }
    }

    // Fall back to chat history estimation if no report files were found.
    if (records.length === 0) {
      for (const historyPath of chatHistories) {
        scanned_paths.push(historyPath);
        const estimated = estimateFromChatHistory(historyPath, since, errors);
        records.push(...estimated);
      }
    }

    return {
      tool: "aider",
      records,
      errors,
      scanned_paths,
    };
  },
};

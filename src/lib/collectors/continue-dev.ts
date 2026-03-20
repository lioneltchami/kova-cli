import crypto from "crypto";
import fs from "fs";
import type { AiModel, UsageRecord } from "../../types.js";
import { CONTINUE_SESSIONS_DIR, TOKEN_COSTS } from "../constants.js";
import type { Collector, CollectorResult } from "./types.js";

// Shape of a Continue.dev session JSON file.
interface ContinueSession {
  sessionId?: string;
  title?: string;
  dateCreated?: string;
  workspaceDirectory?: string;
  history?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    contextItems?: unknown[];
    promptLogs?: Array<{
      modelTitle?: string;
      completionOptions?: {
        model?: string;
      };
      prompt?: string;
      completion?: string;
      tokens?: {
        prompt?: number;
        completion?: number;
      };
      rawResponse?: {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      };
    }>;
  }>;
}

/**
 * Map a Continue.dev model string to our canonical AiModel type.
 */
function mapContinueModel(raw: string | undefined | null): AiModel {
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

function makeId(sessionId: string, index: number): string {
  return crypto
    .createHash("sha256")
    .update(`continue_dev:${sessionId}:${index}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Parse a single Continue.dev session JSON file.
 */
function parseSessionFile(
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

  let session: ContinueSession;
  try {
    session = JSON.parse(raw) as ContinueSession;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`JSON parse error in ${filePath}: ${msg}`);
    return [];
  }

  const sessionId = session.sessionId ?? filePath;
  const sessionTimestamp = session.dateCreated ?? new Date(0).toISOString();
  const project = session.workspaceDirectory
    ? (session.workspaceDirectory.split(/[/\\]/).filter(Boolean).pop() ?? null)
    : null;

  const records: UsageRecord[] = [];
  const history = session.history ?? [];

  let logIndex = 0;
  for (const item of history) {
    const logs = item.promptLogs ?? [];
    for (const log of logs) {
      const rawModel = log.completionOptions?.model ?? log.modelTitle ?? "";
      const model = mapContinueModel(rawModel);

      // Extract token counts from wherever Continue stores them.
      const rawUsage = log.rawResponse?.usage;
      const inputTokens =
        rawUsage?.prompt_tokens ??
        rawUsage?.input_tokens ??
        log.tokens?.prompt ??
        0;
      const outputTokens =
        rawUsage?.completion_tokens ??
        rawUsage?.output_tokens ??
        log.tokens?.completion ??
        0;

      if (inputTokens === 0 && outputTokens === 0) {
        logIndex++;
        continue;
      }

      const timestamp = sessionTimestamp;

      if (since !== undefined) {
        try {
          if (new Date(timestamp) < since) {
            logIndex++;
            continue;
          }
        } catch {
          // Include on unparseable timestamp.
        }
      }

      const cost_usd = computeCost(model, inputTokens, outputTokens);
      const id = makeId(sessionId, logIndex);

      records.push({
        id,
        tool: "continue_dev",
        model,
        session_id: sessionId,
        project,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd,
        timestamp,
        duration_ms: null,
        metadata: {
          raw_model: rawModel,
          file: filePath,
        },
      });

      logIndex++;
    }
  }

  return records;
}

export const continueDevCollector: Collector = {
  name: "continue_dev",

  async isAvailable(): Promise<boolean> {
    return fs.existsSync(CONTINUE_SESSIONS_DIR);
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const scanned_paths: string[] = [];
    const records: UsageRecord[] = [];

    if (!fs.existsSync(CONTINUE_SESSIONS_DIR)) {
      return {
        tool: "continue_dev",
        records: [],
        errors: [],
        scanned_paths: [],
      };
    }

    let files: string[];
    try {
      files = fs
        .readdirSync(CONTINUE_SESSIONS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => `${CONTINUE_SESSIONS_DIR}/${f}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to read Continue sessions directory: ${msg}`);
      return { tool: "continue_dev", records: [], errors, scanned_paths: [] };
    }

    for (const filePath of files) {
      scanned_paths.push(filePath);
      const fileRecords = parseSessionFile(filePath, since, errors);
      records.push(...fileRecords);
    }

    return { tool: "continue_dev", records, errors, scanned_paths };
  },
};

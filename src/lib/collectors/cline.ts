import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { AiModel, UsageRecord } from "../../types.js";
import { CLINE_STORAGE_PATHS, TOKEN_COSTS } from "../constants.js";
import type { Collector, CollectorResult } from "./types.js";

// Shape of a Cline task JSON stored in VS Code globalStorage.
interface ClineApiUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;
}

interface ClineTask {
  id?: string;
  ts?: number; // unix ms
  task?: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheWrites?: number;
  cacheReads?: number;
  totalCost?: number;
  api_usage?: ClineApiUsage;
  apiUsage?: ClineApiUsage;
  model?: string;
}

/**
 * Map a Cline model identifier to our canonical AiModel type.
 * Cline supports any model available via Anthropic/OpenAI/AWS Bedrock.
 */
function mapClineModel(raw: string | undefined | null): AiModel {
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

function makeId(taskId: string): string {
  return crypto
    .createHash("sha256")
    .update(`cline:${taskId}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Return the platform-specific Cline storage path, or null if unsupported.
 */
function getClineStoragePath(): string | null {
  return CLINE_STORAGE_PATHS[process.platform] ?? null;
}

/**
 * Parse a single Cline task JSON file and return a UsageRecord.
 */
function parseTaskFile(
  filePath: string,
  since: Date | undefined,
  errors: string[],
): UsageRecord | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to read ${filePath}: ${msg}`);
    return null;
  }

  let task: ClineTask;
  try {
    task = JSON.parse(raw) as ClineTask;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`JSON parse error in ${filePath}: ${msg}`);
    return null;
  }

  const taskId = task.id ?? path.basename(filePath, ".json");
  const tsMs = task.ts ?? 0;
  const timestamp = new Date(tsMs).toISOString();

  if (since !== undefined) {
    try {
      if (new Date(timestamp) < since) return null;
    } catch {
      // Include on unparseable timestamp.
    }
  }

  // Support both top-level token fields and nested api_usage/apiUsage objects.
  const apiUsage = task.api_usage ?? task.apiUsage;
  const inputTokens = apiUsage?.inputTokens ?? task.tokensIn ?? 0;
  const outputTokens = apiUsage?.outputTokens ?? task.tokensOut ?? 0;

  if (inputTokens === 0 && outputTokens === 0) return null;

  const rawModel = task.model ?? "";
  const model = mapClineModel(rawModel);

  // Use reported total cost if available, otherwise compute from tokens.
  const reportedCost = apiUsage?.totalCost ?? task.totalCost ?? null;
  const cost_usd =
    reportedCost !== null
      ? reportedCost
      : computeCost(model, inputTokens, outputTokens);

  const id = makeId(taskId);

  return {
    id,
    tool: "cline",
    model,
    session_id: taskId,
    project: null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd,
    timestamp,
    duration_ms: null,
    metadata: {
      raw_model: rawModel,
      task_description: (task.task ?? "").slice(0, 100),
      file: filePath,
    },
  };
}

export const clineCollector: Collector = {
  name: "cline",

  async isAvailable(): Promise<boolean> {
    const storagePath = getClineStoragePath();
    if (!storagePath) return false;
    return fs.existsSync(storagePath);
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const scanned_paths: string[] = [];
    const records: UsageRecord[] = [];

    const storagePath = getClineStoragePath();
    if (!storagePath || !fs.existsSync(storagePath)) {
      return { tool: "cline", records: [], errors: [], scanned_paths: [] };
    }

    // Cline stores tasks in <storagePath>/tasks/<taskId>/task.json
    // or directly as JSON files in the storage root.
    const tasksDir = path.join(storagePath, "tasks");
    const searchDir = fs.existsSync(tasksDir) ? tasksDir : storagePath;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(searchDir, { withFileTypes: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to read Cline storage directory: ${msg}`);
      return { tool: "cline", records: [], errors, scanned_paths: [] };
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        // Check for task.json inside task subdirectory.
        const taskFile = path.join(searchDir, entry.name, "task.json");
        if (fs.existsSync(taskFile)) {
          scanned_paths.push(taskFile);
          const record = parseTaskFile(taskFile, since, errors);
          if (record) records.push(record);
        }
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        const filePath = path.join(searchDir, entry.name);
        scanned_paths.push(filePath);
        const record = parseTaskFile(filePath, since, errors);
        if (record) records.push(record);
      }
    }

    return { tool: "cline", records, errors, scanned_paths };
  },
};

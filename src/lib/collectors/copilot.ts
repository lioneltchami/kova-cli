import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { AiModel, UsageRecord } from "../../types.js";
import { getToolKey } from "../credential-manager.js";
import { COPILOT_CHAT_PATHS, TOKEN_COSTS } from "../constants.js";
import type { Collector, CollectorResult } from "./types.js";

// Shape of a Copilot chat session file stored on disk.
interface CopilotRequest {
  id?: string;
  timestamp?: string | number;
  model?: string;
  response?: {
    model?: string;
    timestamp?: string | number;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}

interface CopilotSession {
  conversationId?: string;
  requests?: CopilotRequest[];
}

// Shape of a GitHub billing API usage item.
interface BillingUsageItem {
  model?: string;
  pricePerUnit?: number;
  grossQuantity?: number;
  netAmount?: number;
  date?: string;
}

interface BillingResponse {
  usageItems?: BillingUsageItem[];
}

/**
 * Map a raw Copilot model string to our canonical AiModel type.
 */
function mapCopilotModel(raw: string | undefined): AiModel {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower === "default") return "gpt-4o";
  if (lower.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  if (lower.includes("gpt-4.1")) return "gpt-4.1";
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("haiku")) return "haiku";
  return "unknown";
}

/**
 * Compute cost from TOKEN_COSTS (cost per 1M tokens).
 */
function computeCost(
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = TOKEN_COSTS[model];
  if (!rates) return 0;
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

/**
 * Normalise a timestamp from a session file to an ISO string.
 * Copilot stores timestamps as either ISO strings or Unix ms numbers.
 */
function normaliseTimestamp(ts: string | number | undefined): string {
  if (ts === undefined || ts === null) return new Date(0).toISOString();
  if (typeof ts === "number") return new Date(ts).toISOString();
  return ts;
}

/**
 * Generate a deterministic 16-character deduplication ID.
 */
function makeId(prefix: string, ...parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update([prefix, ...parts].join(":"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Parse all Copilot chat session JSON files under chatDir and return UsageRecords.
 */
function parseLocalSessions(
  chatDir: string,
  since: Date | undefined,
  errors: string[],
  scannedPaths: string[],
): UsageRecord[] {
  const records: UsageRecord[] = [];

  let files: string[];
  try {
    files = fs
      .readdirSync(chatDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(chatDir, f));
  } catch {
    // chatSessions dir does not exist or is not readable -- silent skip.
    return records;
  }

  for (const filePath of files) {
    scannedPaths.push(filePath);

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to read ${filePath}: ${msg}`);
      continue;
    }

    let session: CopilotSession;
    try {
      session = JSON.parse(raw) as CopilotSession;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`JSON parse error in ${filePath}: ${msg}`);
      continue;
    }

    const conversationId =
      session.conversationId ?? path.basename(filePath, ".json");

    if (!Array.isArray(session.requests)) continue;

    for (const req of session.requests) {
      const usage = req.response?.usage;
      if (!usage) continue;

      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;
      if (inputTokens === 0 && outputTokens === 0) continue;

      const rawModel = req.response?.model ?? req.model;
      const model = mapCopilotModel(rawModel);

      // Use the response timestamp if available, otherwise the request timestamp.
      const rawTs = req.response?.timestamp ?? req.timestamp;
      const timestamp = normaliseTimestamp(rawTs);

      if (since !== undefined) {
        try {
          if (new Date(timestamp) < since) continue;
        } catch {
          // Unparseable timestamp -- include rather than skip.
        }
      }

      const requestId = req.id ?? "";
      const id = makeId("copilot", conversationId, requestId, timestamp);
      const cost = computeCost(model, inputTokens, outputTokens);

      records.push({
        id,
        tool: "copilot",
        model,
        session_id: conversationId,
        project: null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: cost,
        timestamp,
        duration_ms: null,
        metadata: {
          raw_model: rawModel ?? "",
          source: "local",
          file: filePath,
        },
      });
    }
  }

  return records;
}

/**
 * Fetch the authenticated GitHub user's login from the API.
 * Returns null on any error.
 */
async function fetchGitHubLogin(
  pat: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: string };
    return data.login ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch Copilot billing usage from the GitHub API for a given year/month.
 * Returns an empty array on any auth error or network failure.
 */
async function fetchBillingMonth(
  pat: string,
  login: string,
  year: number,
  month: number,
  signal: AbortSignal,
  errors: string[],
): Promise<UsageRecord[]> {
  const monthStr = String(month).padStart(2, "0");
  const url =
    `https://api.github.com/users/${login}/settings/billing/premium_request/usage` +
    `?year=${year}&month=${monthStr}&product=Copilot`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`GitHub billing API request failed: ${msg}`);
    return [];
  }

  if (res.status === 401) {
    errors.push("GitHub PAT is invalid or expired (401).");
    return [];
  }
  if (res.status === 403) {
    errors.push(
      "GitHub PAT lacks billing read scope or organisation SSO is required (403).",
    );
    return [];
  }
  if (!res.ok) {
    errors.push(
      `GitHub billing API returned ${res.status} for ${year}-${monthStr}.`,
    );
    return [];
  }

  let body: BillingResponse;
  try {
    body = (await res.json()) as BillingResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to parse GitHub billing response: ${msg}`);
    return [];
  }

  const records: UsageRecord[] = [];
  for (const item of body.usageItems ?? []) {
    const rawModel = item.model;
    const model = mapCopilotModel(rawModel);
    const date = item.date ?? `${year}-${monthStr}-01`;
    const timestamp = new Date(date).toISOString();
    const grossQuantity = item.grossQuantity ?? 0;
    const cost = item.netAmount ?? 0;

    const id = makeId(
      "copilot-billing",
      date,
      rawModel ?? "",
      String(grossQuantity),
    );

    records.push({
      id,
      tool: "copilot",
      model,
      session_id: "",
      project: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: cost,
      timestamp,
      duration_ms: null,
      metadata: {
        raw_model: rawModel ?? "",
        source: "billing_api",
        gross_quantity: String(grossQuantity),
        price_per_unit: String(item.pricePerUnit ?? 0),
      },
    });
  }

  return records;
}

/**
 * Merge two sets of records, deduplicating by ID.
 * Records from `primary` take precedence over `secondary` on ID collision.
 */
function mergeDedup(
  primary: UsageRecord[],
  secondary: UsageRecord[],
): UsageRecord[] {
  const seen = new Set<string>();
  const result: UsageRecord[] = [];
  for (const r of [...primary, ...secondary]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      result.push(r);
    }
  }
  return result;
}

export const copilotCollector: Collector = {
  name: "copilot",

  async isAvailable(): Promise<boolean> {
    // Available if a PAT is stored or the local data directory exists on this platform.
    if (getToolKey("copilot") !== null) return true;
    const chatPath = COPILOT_CHAT_PATHS[process.platform];
    if (chatPath && fs.existsSync(chatPath)) return true;
    return false;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const scanned_paths: string[] = [];
    let localRecords: UsageRecord[] = [];
    let apiRecords: UsageRecord[] = [];

    // Strategy 1: Parse local session files.
    const chatPath = COPILOT_CHAT_PATHS[process.platform];
    if (chatPath) {
      const chatSessionsDir = path.join(chatPath, "chatSessions");
      localRecords = parseLocalSessions(
        chatSessionsDir,
        since,
        errors,
        scanned_paths,
      );
    }

    // Strategy 2: GitHub Billing API (only when a PAT is stored).
    const pat = getToolKey("copilot");
    if (pat) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        const login = await fetchGitHubLogin(pat, controller.signal);
        if (!login) {
          errors.push(
            "Could not resolve GitHub username from PAT -- skipping billing API.",
          );
        } else {
          // Fetch current month and previous month to catch data near month boundaries.
          const now = new Date();
          const months: Array<{ year: number; month: number }> = [
            { year: now.getFullYear(), month: now.getMonth() + 1 },
          ];
          // If since is defined and spans into a prior month, include that month too.
          if (since) {
            const sinceYear = since.getFullYear();
            const sinceMonth = since.getMonth() + 1;
            const lastEntry = months[months.length - 1];
            if (
              sinceYear < lastEntry.year ||
              (sinceYear === lastEntry.year && sinceMonth < lastEntry.month)
            ) {
              months.push({ year: sinceYear, month: sinceMonth });
            }
          }

          for (const { year, month } of months) {
            const monthRecords = await fetchBillingMonth(
              pat,
              login,
              year,
              month,
              controller.signal,
              errors,
            );
            // Filter billing records by since.
            for (const r of monthRecords) {
              if (since !== undefined) {
                try {
                  if (new Date(r.timestamp) < since) continue;
                } catch {
                  // Include on parse failure.
                }
              }
              apiRecords.push(r);
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Local records are preferred on ID collision (more granular data).
    const records = mergeDedup(localRecords, apiRecords);

    return {
      tool: "copilot",
      records,
      errors,
      scanned_paths,
    };
  },
};

import crypto from "crypto";
import type { AiModel, UsageRecord } from "../../types.js";
import { computeCost } from "../cost-calculator.js";
import { appendRecords } from "../local-store.js";

interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Map an AI SDK model ID (e.g. "claude-sonnet-4-20250514") to our canonical AiModel name.
 */
export function mapSdkModelToCanonical(sdkModelId: string): AiModel {
  const lower = sdkModelId.toLowerCase();
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("gpt-4.1-nano")) return "gpt-4.1-nano";
  if (lower.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (lower.includes("gpt-4.1")) return "gpt-4.1";
  if (lower.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  if (lower.includes("gpt-5-mini")) return "gpt-5-mini";
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("o4-mini")) return "o4-mini";
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("gemini") && lower.includes("flash"))
    return "gemini-flash";
  if (lower.includes("gemini") && lower.includes("pro")) return "gemini-pro";
  return "unknown";
}

/**
 * Record an AI SDK request as a UsageRecord in the local store.
 */
export function recordAiUsage(params: {
  modelId: string;
  usage: AiUsage;
  sessionId: string;
  project: string | null;
  durationMs: number;
}): UsageRecord {
  const canonicalModel = mapSdkModelToCanonical(params.modelId);
  const costUsd = computeCost(
    canonicalModel,
    params.usage.inputTokens,
    params.usage.outputTokens,
  );

  const record: UsageRecord = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    tool: "kova_orchestrator",
    model: canonicalModel,
    session_id: params.sessionId,
    project: params.project,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    cost_usd: costUsd,
    timestamp: new Date().toISOString(),
    duration_ms: params.durationMs,
    metadata: { sdk_model_id: params.modelId },
  };

  appendRecords([record]);
  return record;
}

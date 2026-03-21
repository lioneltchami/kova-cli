import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/local-store.js", () => ({
  appendRecords: vi.fn(),
}));

import { appendRecords } from "../../../src/lib/local-store.js";
import {
  mapSdkModelToCanonical,
  recordAiUsage,
} from "../../../src/lib/ai/cost-recorder.js";

// ---------------------------------------------------------------------------
// mapSdkModelToCanonical
// ---------------------------------------------------------------------------

describe("mapSdkModelToCanonical", () => {
  it('maps haiku model IDs to "haiku"', () => {
    expect(mapSdkModelToCanonical("claude-haiku-4-5-20251001")).toBe("haiku");
    expect(mapSdkModelToCanonical("claude-3-haiku-20240307")).toBe("haiku");
  });

  it('maps sonnet model IDs to "sonnet"', () => {
    expect(mapSdkModelToCanonical("claude-sonnet-4-20250514")).toBe("sonnet");
    expect(mapSdkModelToCanonical("claude-3-5-sonnet")).toBe("sonnet");
  });

  it('maps opus model IDs to "opus"', () => {
    expect(mapSdkModelToCanonical("claude-opus-4-20250115")).toBe("opus");
  });

  it('maps gpt-4o to "gpt-4o"', () => {
    expect(mapSdkModelToCanonical("gpt-4o-2024-08-06")).toBe("gpt-4o");
  });

  it('maps gpt-4o-mini to "gpt-4o-mini"', () => {
    expect(mapSdkModelToCanonical("gpt-4o-mini-2024-07-18")).toBe(
      "gpt-4o-mini",
    );
  });

  it('maps gpt-4.1 to "gpt-4.1"', () => {
    expect(mapSdkModelToCanonical("gpt-4.1-2025-04-14")).toBe("gpt-4.1");
  });

  it('maps gpt-4.1-nano to "gpt-4.1-nano"', () => {
    expect(mapSdkModelToCanonical("gpt-4.1-nano-2025-04-14")).toBe(
      "gpt-4.1-nano",
    );
  });

  it('maps gpt-4.1-mini to "gpt-4.1-mini"', () => {
    expect(mapSdkModelToCanonical("gpt-4.1-mini-2025-04-14")).toBe(
      "gpt-4.1-mini",
    );
  });

  it('maps o3 to "o3"', () => {
    expect(mapSdkModelToCanonical("o3-2025-04-16")).toBe("o3");
  });

  it('maps o1 to "o1"', () => {
    expect(mapSdkModelToCanonical("o1-2024-12-17")).toBe("o1");
  });

  it('maps o4-mini to "o4-mini"', () => {
    expect(mapSdkModelToCanonical("o4-mini-2025-04-16")).toBe("o4-mini");
  });

  it('maps gemini flash to "gemini-flash"', () => {
    expect(mapSdkModelToCanonical("gemini-2.0-flash-exp")).toBe("gemini-flash");
  });

  it('maps gemini pro to "gemini-pro"', () => {
    expect(mapSdkModelToCanonical("gemini-1.5-pro-latest")).toBe("gemini-pro");
  });

  it('returns "unknown" for unrecognized models', () => {
    expect(mapSdkModelToCanonical("llama-3-70b")).toBe("unknown");
    expect(mapSdkModelToCanonical("mistral-large")).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(mapSdkModelToCanonical("Claude-SONNET-4-20250514")).toBe("sonnet");
    expect(mapSdkModelToCanonical("GPT-4O")).toBe("gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// recordAiUsage
// ---------------------------------------------------------------------------

describe("recordAiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a UsageRecord with correct shape", () => {
    const record = recordAiUsage({
      modelId: "claude-sonnet-4-20250514",
      usage: { inputTokens: 1000, outputTokens: 500 },
      sessionId: "test-session",
      project: "test-project",
      durationMs: 2000,
    });

    expect(record).toMatchObject({
      tool: "kova_orchestrator",
      model: "sonnet",
      session_id: "test-session",
      project: "test-project",
      input_tokens: 1000,
      output_tokens: 500,
      duration_ms: 2000,
    });
    expect(record.id).toBeDefined();
    expect(record.id.length).toBe(16);
    expect(record.timestamp).toBeDefined();
    expect(record.metadata).toEqual({
      sdk_model_id: "claude-sonnet-4-20250514",
    });
  });

  it('has tool="kova_orchestrator"', () => {
    const record = recordAiUsage({
      modelId: "gpt-4o",
      usage: { inputTokens: 100, outputTokens: 50 },
      sessionId: "s1",
      project: null,
      durationMs: 500,
    });
    expect(record.tool).toBe("kova_orchestrator");
  });

  it("calculates cost correctly for known models", () => {
    // sonnet: input $3.0/1M, output $15.0/1M
    const record = recordAiUsage({
      modelId: "claude-sonnet-4-20250514",
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      sessionId: "s1",
      project: null,
      durationMs: 1000,
    });
    expect(record.cost_usd).toBeCloseTo(3.0 + 15.0, 2);
  });

  it("returns zero cost for unknown models", () => {
    const record = recordAiUsage({
      modelId: "llama-3-70b",
      usage: { inputTokens: 5000, outputTokens: 3000 },
      sessionId: "s1",
      project: null,
      durationMs: 100,
    });
    expect(record.cost_usd).toBe(0);
  });

  it("calls appendRecords with the record", () => {
    const record = recordAiUsage({
      modelId: "claude-haiku-4-5-20251001",
      usage: { inputTokens: 100, outputTokens: 50 },
      sessionId: "s1",
      project: "proj",
      durationMs: 200,
    });
    expect(appendRecords).toHaveBeenCalledWith([record]);
  });

  it("handles null project", () => {
    const record = recordAiUsage({
      modelId: "gpt-4o",
      usage: { inputTokens: 100, outputTokens: 50 },
      sessionId: "s1",
      project: null,
      durationMs: 500,
    });
    expect(record.project).toBeNull();
  });
});

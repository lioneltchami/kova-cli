import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/ai/provider-registry.js", () => ({
  createKovaRegistry: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
  stepCountIs: vi.fn().mockReturnValue(vi.fn()),
  tool: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../src/lib/ai/cost-recorder.js", () => ({
  recordAiUsage: vi.fn().mockReturnValue({
    cost_usd: 0.005,
    tool: "kova_orchestrator",
    model: "sonnet",
  }),
}));

vi.mock("../../src/lib/logger.js", () => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  table: vi.fn(),
  progress: vi.fn(),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-bench-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { streamText } from "ai";
import { benchCommand } from "../../src/commands/bench.js";
import { createKovaRegistry } from "../../src/lib/ai/provider-registry.js";
import * as loggerMod from "../../src/lib/logger.js";

describe("benchCommand", () => {
  it("errors when no providers are configured", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue(null);

    await benchCommand("test prompt", {});

    expect(loggerMod.error).toHaveBeenCalledWith(
      expect.stringContaining("No AI providers configured"),
    );
    expect(process.exitCode).toBe(1);

    // Reset
    process.exitCode = 0;
  });

  it("parses --models option correctly by splitting on comma", async () => {
    const mockRegistry = {
      languageModel: vi.fn(),
    };
    vi.mocked(createKovaRegistry).mockResolvedValue(mockRegistry as any);

    const mockStream = {
      textStream: (async function* () {
        yield "test response";
      })(),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
    };
    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await benchCommand("test prompt", {
      models: "anthropic:claude-sonnet-4-20250514,openai:gpt-4o",
    });

    // streamText should be called twice, once per model
    expect(streamText).toHaveBeenCalledTimes(2);
  });

  it("uses default routing models when no --models provided", async () => {
    const mockRegistry = {
      languageModel: vi.fn(),
    };
    vi.mocked(createKovaRegistry).mockResolvedValue(mockRegistry as any);

    const createMockStream = () => ({
      textStream: (async function* () {
        yield "response";
      })(),
      usage: Promise.resolve({ inputTokens: 50, outputTokens: 25 }),
    });

    vi.mocked(streamText)
      .mockReturnValueOnce(createMockStream() as any)
      .mockReturnValueOnce(createMockStream() as any)
      .mockReturnValueOnce(createMockStream() as any);

    await benchCommand("test prompt", {});

    // Default routing has 3 models: simple, moderate, complex
    expect(streamText).toHaveBeenCalledTimes(3);
  });

  it("handles model errors gracefully", async () => {
    const mockRegistry = {
      languageModel: vi.fn(),
    };
    vi.mocked(createKovaRegistry).mockResolvedValue(mockRegistry as any);

    vi.mocked(streamText).mockImplementation(() => {
      throw new Error("Model not available");
    });

    // Should not throw even when streamText throws
    await expect(
      benchCommand("test prompt", { models: "bad:model" }),
    ).resolves.not.toThrow();

    // Results table should still be displayed
    expect(loggerMod.table).toHaveBeenCalled();
  });

  it("shows results table after successful runs", async () => {
    const mockRegistry = {
      languageModel: vi.fn(),
    };
    vi.mocked(createKovaRegistry).mockResolvedValue(mockRegistry as any);

    const mockStream = {
      textStream: (async function* () {
        yield "bench response";
      })(),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
    };
    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await benchCommand("test prompt", {
      models: "anthropic:claude-sonnet-4-20250514",
    });

    expect(loggerMod.header).toHaveBeenCalledWith("Results");
    expect(loggerMod.table).toHaveBeenCalled();

    // Verify the table contains cost data
    const tableCall = vi.mocked(loggerMod.table).mock.calls[0];
    expect(tableCall).toBeDefined();
    const rows = tableCall[0] as [string, string][];
    expect(rows.length).toBe(1);
    // Should contain cost info (from mocked recordAiUsage returning 0.005)
    expect(rows[0][1]).toContain("$0.0050");
  });
});

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
}));

vi.mock("../../src/lib/ai/cost-recorder.js", () => ({
  recordAiUsage: vi.fn().mockReturnValue({
    cost_usd: 0.0123,
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-run-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { streamText } from "ai";
import { runCommand } from "../../src/commands/run.js";
import { createKovaRegistry } from "../../src/lib/ai/provider-registry.js";
import * as loggerMod from "../../src/lib/logger.js";

describe("runCommand", () => {
  it("outputs dry-run info without making API calls", async () => {
    // Even with no registry, dry-run should still work because it checks dryRun after registry check
    // Actually looking at the code: it checks registry first, then dryRun.
    // So we need a registry for dry-run to work.
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    const tableSpy = vi.mocked(loggerMod.table);

    await runCommand("fix typo in readme", { dryRun: true });

    expect(loggerMod.header).toHaveBeenCalledWith("Dry Run");
    expect(tableSpy).toHaveBeenCalled();
    const tableArgs = tableSpy.mock.calls[0]![0] as string[][];
    const promptRow = tableArgs.find((row) => row[0] === "Prompt");
    expect(promptRow).toBeDefined();
    expect(promptRow![1]).toBe("fix typo in readme");

    const modelRow = tableArgs.find((row) => row[0] === "Model");
    expect(modelRow).toBeDefined();

    const complexityRow = tableArgs.find((row) => row[0] === "Complexity");
    expect(complexityRow).toBeDefined();
    expect(complexityRow![1]).toBe("simple");
  });

  it("errors when no providers are configured", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue(null);

    await runCommand("do something", {});

    expect(loggerMod.error).toHaveBeenCalledWith(
      expect.stringContaining("No AI providers configured"),
    );
    expect(process.exitCode).toBe(1);

    // Reset
    process.exitCode = 0;
  });

  it("uses explicit model when --model is provided in dry-run", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn().mockReturnValue({}),
    } as any);

    await runCommand("hello", { model: "openai:gpt-4o", dryRun: true });

    const tableSpy = vi.mocked(loggerMod.table);
    expect(tableSpy).toHaveBeenCalled();
    const tableArgs = tableSpy.mock.calls[0]![0] as string[][];
    const modelRow = tableArgs.find((row) => row[0] === "Model");
    expect(modelRow).toBeDefined();
    expect(modelRow![1]).toBe("openai:gpt-4o");
  });

  it("uses tier to determine model when --tier is provided", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    await runCommand("hello", { tier: "cheap", dryRun: true });

    const tableSpy = vi.mocked(loggerMod.table);
    expect(tableSpy).toHaveBeenCalled();
  });
});

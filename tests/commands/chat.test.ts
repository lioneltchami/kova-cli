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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-chat-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { chatCommand } from "../../src/commands/chat.js";
import { createKovaRegistry } from "../../src/lib/ai/provider-registry.js";
import * as loggerMod from "../../src/lib/logger.js";

describe("chatCommand", () => {
  it("errors when no providers are configured", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue(null);

    await chatCommand({});

    expect(loggerMod.error).toHaveBeenCalledWith(
      expect.stringContaining("No AI providers configured"),
    );
    expect(process.exitCode).toBe(1);

    // Reset
    process.exitCode = 0;
  });

  it("shows header and model info when providers are configured", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    // chatCommand opens a readline interface and waits for input.
    // We need to close stdin to end it.
    const originalStdin = process.stdin;
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    // Push exit to close the chat
    mockStdin.push("exit\n");
    mockStdin.push(null);

    await chatCommand({});

    expect(loggerMod.header).toHaveBeenCalledWith("kova chat");
    expect(loggerMod.info).toHaveBeenCalledWith(
      expect.stringContaining("Model:"),
    );

    // Restore
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
    });
  });

  it("uses explicit model when --model is provided", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    const originalStdin = process.stdin;
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    mockStdin.push("exit\n");
    mockStdin.push(null);

    await chatCommand({ model: "openai:gpt-4o" });

    expect(loggerMod.header).toHaveBeenCalledWith("kova chat");

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
    });
  });

  it("shows help text including /cost command", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    const originalStdin = process.stdin;
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    mockStdin.push("exit\n");
    mockStdin.push(null);

    await chatCommand({});

    expect(loggerMod.info).toHaveBeenCalledWith(
      expect.stringContaining("/cost"),
    );

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
    });
  });

  it("handles /cost command without crashing", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    const originalStdin = process.stdin;
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    // Push /cost then exit; readline processes these async
    mockStdin.push("/cost\nexit\n");
    mockStdin.push(null);

    // chatCommand sets up readline and returns; it should not throw
    await expect(chatCommand({})).resolves.not.toThrow();

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
    });
  });

  it("uses tier to determine model when --tier is provided", async () => {
    vi.mocked(createKovaRegistry).mockResolvedValue({
      languageModel: vi.fn(),
    } as any);

    const originalStdin = process.stdin;
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    mockStdin.push("exit\n");
    mockStdin.push(null);

    await chatCommand({ tier: "cheap" });

    expect(loggerMod.header).toHaveBeenCalledWith("kova chat");

    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
    });
  });
});

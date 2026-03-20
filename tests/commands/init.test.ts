import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process so init's openBrowser does not open real windows
vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, cb: (err: Error | null) => void) => cb(null)),
}));

// Mock readline so the wizard doesn't hang waiting for user input
vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn(
      (_q: string, cb: (answer: string) => void) => cb("n"),
    ),
    close: vi.fn(),
  })),
}));

vi.mock("../../src/lib/logger.js", () => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  table: vi.fn(),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-init-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("initCommand", () => {
  it("runs without throwing even when no AI tools are detected", async () => {
    // Mock all collectors so none are available
    vi.doMock("../../src/lib/collectors/claude-code.js", () => ({
      claudeCodeCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cursor.js", () => ({
      cursorCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/copilot.js", () => ({
      copilotCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/windsurf.js", () => ({
      windsurfCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/devin.js", () => ({
      devinCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/aider.js", () => ({
      aiderCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/continue-dev.js", () => ({
      continueDevCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cline.js", () => ({
      clineCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/amazon-q.js", () => ({
      amazonQCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/bolt.js", () => ({
      boltCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/lovable.js", () => ({
      lovableCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));

    const { initCommand } = await import("../../src/commands/init.js");
    // Should complete without throwing
    await expect(initCommand()).resolves.toBeUndefined();
  });

  it("outputs no-tools-detected message to console when all collectors unavailable", async () => {
    vi.doMock("../../src/lib/collectors/claude-code.js", () => ({
      claudeCodeCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cursor.js", () => ({
      cursorCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/copilot.js", () => ({
      copilotCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/windsurf.js", () => ({
      windsurfCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/devin.js", () => ({
      devinCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/aider.js", () => ({
      aiderCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/continue-dev.js", () => ({
      continueDevCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cline.js", () => ({
      clineCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/amazon-q.js", () => ({
      amazonQCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/bolt.js", () => ({
      boltCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/lovable.js", () => ({
      lovableCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));

    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("No AI tools detected");
  });

  it("calls isAvailable on each collector during detection phase", async () => {
    const isAvailableMock = vi.fn().mockResolvedValue(false);

    vi.doMock("../../src/lib/collectors/claude-code.js", () => ({
      claudeCodeCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cursor.js", () => ({
      cursorCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/copilot.js", () => ({
      copilotCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/windsurf.js", () => ({
      windsurfCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/devin.js", () => ({
      devinCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/aider.js", () => ({
      aiderCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/continue-dev.js", () => ({
      continueDevCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cline.js", () => ({
      clineCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/amazon-q.js", () => ({
      amazonQCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/bolt.js", () => ({
      boltCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/lovable.js", () => ({
      lovableCollector: { isAvailable: isAvailableMock, collect: vi.fn() },
    }));

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand();

    // isAvailable should have been called once per tool (11 tools total)
    expect(isAvailableMock.mock.calls.length).toBeGreaterThanOrEqual(11);
  });

  it("collects records from available tools when user confirms scan", async () => {
    // Override readline to answer "y" for the scan prompt and "n" for sync
    vi.doMock("node:readline", () => ({
      createInterface: vi.fn()
        .mockReturnValueOnce({
          question: vi.fn((_q: string, cb: (a: string) => void) => cb("y")),
          close: vi.fn(),
        })
        .mockReturnValueOnce({
          question: vi.fn((_q: string, cb: (a: string) => void) => cb("n")),
          close: vi.fn(),
        }),
    }));

    const collectMock = vi.fn().mockResolvedValue({ records: [] });

    vi.doMock("../../src/lib/collectors/claude-code.js", () => ({
      claudeCodeCollector: { isAvailable: vi.fn().mockResolvedValue(true), collect: collectMock },
    }));
    vi.doMock("../../src/lib/collectors/cursor.js", () => ({
      cursorCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/copilot.js", () => ({
      copilotCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/windsurf.js", () => ({
      windsurfCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/devin.js", () => ({
      devinCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/aider.js", () => ({
      aiderCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/continue-dev.js", () => ({
      continueDevCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/cline.js", () => ({
      clineCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/amazon-q.js", () => ({
      amazonQCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/bolt.js", () => ({
      boltCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));
    vi.doMock("../../src/lib/collectors/lovable.js", () => ({
      lovableCollector: { isAvailable: vi.fn().mockResolvedValue(false), collect: vi.fn() },
    }));

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand();

    expect(collectMock).toHaveBeenCalledOnce();
  });
});

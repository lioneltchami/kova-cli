import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted - factory runs once; vi.clearAllMocks() in beforeEach clears
// the mock fn state but does NOT re-run the factory. So we must re-apply default
// return values in beforeEach after clearAllMocks.
vi.mock("../../src/lib/collectors/claude-code.js", () => ({
  claudeCodeCollector: {
    name: "claude_code",
    isAvailable: vi.fn().mockResolvedValue(true),
    collect: vi.fn().mockResolvedValue({
      tool: "claude_code",
      records: [],
      errors: [],
      scanned_paths: [],
    }),
  },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(
  id: string,
  timestamp = "2026-03-15T10:00:00.000Z",
  cost_usd = 0.05,
) {
  return {
    id,
    tool: "claude_code" as const,
    model: "sonnet" as const,
    session_id: "sess-1",
    project: "test-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd,
    timestamp,
    duration_ms: null,
    metadata: {},
  };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-track-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;

  // Reset module cache so local-store picks up fresh state
  vi.resetModules();

  // After clearAllMocks (or resetModules), the collector mock fns are reset.
  // Re-import the mock and re-apply default return values.
  const { claudeCodeCollector } =
    await import("../../src/lib/collectors/claude-code.js");
  vi.mocked(claudeCodeCollector.isAvailable).mockResolvedValue(true);
  vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
    tool: "claude_code",
    records: [],
    errors: [],
    scanned_paths: [],
  });
  // Clear call history (but leave return values intact)
  vi.mocked(claudeCodeCollector.isAvailable).mockClear();
  vi.mocked(claudeCodeCollector.collect).mockClear();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// trackCommand tests
// ---------------------------------------------------------------------------

describe("trackCommand", () => {
  it("calls collector.collect()", async () => {
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({});
    expect(claudeCodeCollector.collect).toHaveBeenCalledOnce();
  });

  it("appends records to local store", async () => {
    const mockRecords = [
      makeRecord("r1", "2026-03-15T10:00:00.000Z", 0.1),
      makeRecord("r2", "2026-03-15T11:00:00.000Z", 0.2),
    ];
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
      tool: "claude_code",
      records: mockRecords,
      errors: [],
      scanned_paths: ["file1.jsonl"],
    });

    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({});

    const { readUsageDatabase } = await import("../../src/lib/local-store.js");
    const db = readUsageDatabase();
    expect(db.records.length).toBeGreaterThanOrEqual(2);
  });

  it("updates last scan timestamp after scanning", async () => {
    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({});

    const { getLastScanTimestamp } =
      await import("../../src/lib/local-store.js");
    const ts = getLastScanTimestamp();
    expect(ts).not.toBeNull();
  });

  it("shows summary with scanned files count", async () => {
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
      tool: "claude_code",
      records: [makeRecord("r1")],
      errors: [],
      scanned_paths: ["file1.jsonl", "file2.jsonl"],
    });

    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({});

    const logger = await import("../../src/lib/logger.js");
    const successCalls = vi.mocked(logger.success).mock.calls;
    const allOutput = successCalls.flat().join(" ");
    expect(allOutput).toContain("2");
  });

  it("handles no records found gracefully", async () => {
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
      tool: "claude_code",
      records: [],
      errors: [],
      scanned_paths: [],
    });

    const { trackCommand } = await import("../../src/commands/track.js");
    await expect(trackCommand({})).resolves.not.toThrow();
  });

  it("passes --since date to collector", async () => {
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({ since: "2026-03-01" });

    expect(claudeCodeCollector.collect).toHaveBeenCalled();
    const callArg = vi.mocked(claudeCodeCollector.collect).mock.calls[0]?.[0];
    if (callArg !== undefined) {
      expect(callArg).toBeInstanceOf(Date);
      const dateStr = (callArg as Date).toISOString();
      expect(dateStr).toContain("2026-03-01");
    }
  });

  it("warns when --since is an invalid date", async () => {
    const { trackCommand } = await import("../../src/commands/track.js");
    await trackCommand({ since: "not-a-date" });

    const logger = await import("../../src/lib/logger.js");
    const warnCalls = vi.mocked(logger.warn).mock.calls;
    const allWarnOutput = warnCalls.flat().join(" ");
    expect(allWarnOutput).toContain("Invalid date");
  });

  it("handles collector errors gracefully without throwing", async () => {
    const { claudeCodeCollector } =
      await import("../../src/lib/collectors/claude-code.js");
    vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
      tool: "claude_code",
      records: [],
      errors: ["EACCES: permission denied"],
      scanned_paths: [],
    });

    const { trackCommand } = await import("../../src/commands/track.js");
    await expect(trackCommand({})).resolves.not.toThrow();
  });
});

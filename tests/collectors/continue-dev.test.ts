/**
 * continue-dev.test.ts
 *
 * Tests for the Continue.dev collector. Writes fixture session JSON files
 * to a temporary directory and verifies parsing behaviour.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let sessionsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-continue-test-"));
  sessionsDir = path.join(tmpDir, ".continue", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

async function importCollector() {
  const capturedSessionsDir = sessionsDir;
  vi.doMock("../../src/lib/constants.js", () => ({
    VERSION: "0.4.0",
    KOVA_DATA_DIR: path.join(tmpDir, ".kova"),
    USAGE_FILE: "usage.json",
    CONFIG_FILE: "config.json",
    DASHBOARD_API_URL: "https://kova.dev/api/v1",
    CLAUDE_CODE_DIR: path.join(tmpDir, ".claude"),
    CONTINUE_SESSIONS_DIR: capturedSessionsDir,
    AIDER_CHAT_HISTORY_NAMES: [],
    AIDER_REPORTS_DIR: ".aider/reports",
    CLINE_STORAGE_PATHS: {},
    COPILOT_CHAT_PATHS: {},
    CURSOR_STATE_DB_PATHS: {},
    CURSOR_POOL_RATES: {
      cache_read: 0.25,
      input: 1.25,
      output: 6.0,
      cache_write: 1.25,
    },
    DEVIN_ACU_COST_CORE: 2.25,
    DEVIN_ACU_COST_TEAMS: 2.0,
    WINDSURF_CREDIT_RATE_PRO: 0.02,
    WINDSURF_CREDIT_RATE_TEAMS: 0.04,
    AMAZON_Q_TOKEN_COSTS: { input: 3.0, output: 15.0 },
    TOKEN_COSTS: {
      haiku: { input: 0.25, output: 1.25 },
      sonnet: { input: 3.0, output: 15.0 },
      opus: { input: 15.0, output: 75.0 },
      "gpt-4o": { input: 2.5, output: 10.0 },
      unknown: { input: 0, output: 0 },
    },
    colors: {},
  }));

  const { continueDevCollector } =
    await import("../../src/lib/collectors/continue-dev.js");
  return continueDevCollector;
}

function writeSession(filename: string, data: object): void {
  fs.writeFileSync(
    path.join(sessionsDir, filename),
    JSON.stringify(data),
    "utf-8",
  );
}

function makeSession(overrides: {
  sessionId?: string;
  dateCreated?: string;
  workspaceDirectory?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}) {
  return {
    sessionId: overrides.sessionId ?? "sess-abc-123",
    title: "Test session",
    dateCreated: overrides.dateCreated ?? "2026-03-15T10:00:00.000Z",
    workspaceDirectory: overrides.workspaceDirectory ?? "/home/user/my-project",
    history: [
      {
        message: { role: "user", content: "Hello" },
        promptLogs: [
          {
            modelTitle: overrides.model ?? "claude-sonnet-4-20250514",
            completionOptions: {
              model: overrides.model ?? "claude-sonnet-4-20250514",
            },
            rawResponse: {
              usage: {
                prompt_tokens: overrides.inputTokens ?? 1000,
                completion_tokens: overrides.outputTokens ?? 500,
              },
            },
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("ContinueDevCollector - isAvailable", () => {
  it("returns true when sessions directory exists", async () => {
    const collector = await importCollector();
    expect(await collector.isAvailable()).toBe(true);
  });

  it("returns false when sessions directory does not exist", async () => {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    const collector = await importCollector();
    expect(await collector.isAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collect - parsing
// ---------------------------------------------------------------------------

describe("ContinueDevCollector - parsing session files", () => {
  it("parses token usage from rawResponse.usage.prompt_tokens", async () => {
    writeSession(
      "session1.json",
      makeSession({ inputTokens: 2000, outputTokens: 800 }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.tool).toBe("continue_dev");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.input_tokens).toBe(2000);
    expect(result.records[0]?.output_tokens).toBe(800);
  });

  it("maps model name correctly", async () => {
    writeSession("session1.json", makeSession({ model: "claude-haiku-3-5" }));

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records[0]?.model).toBe("haiku");
  });

  it("extracts project name from workspaceDirectory", async () => {
    writeSession(
      "session1.json",
      makeSession({ workspaceDirectory: "/home/user/my-awesome-app" }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records[0]?.project).toBe("my-awesome-app");
  });

  it("respects since parameter - skips sessions older than since date", async () => {
    writeSession(
      "old.json",
      makeSession({ dateCreated: "2026-01-01T00:00:00.000Z" }),
    );
    writeSession(
      "new.json",
      makeSession({
        sessionId: "sess-new",
        dateCreated: "2026-03-15T10:00:00.000Z",
      }),
    );

    const collector = await importCollector();
    const since = new Date("2026-02-01T00:00:00.000Z");
    const result = await collector.collect(since);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.session_id).toBe("sess-new");
  });

  it("handles corrupt JSON file - adds error and continues", async () => {
    fs.writeFileSync(
      path.join(sessionsDir, "corrupt.json"),
      "{not valid json}",
      "utf-8",
    );
    writeSession("valid.json", makeSession({}));

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toHaveLength(1);
  });

  it("skips entries with zero token counts", async () => {
    writeSession(
      "session1.json",
      makeSession({ inputTokens: 0, outputTokens: 0 }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records).toHaveLength(0);
  });

  it("computes cost from token counts using TOKEN_COSTS", async () => {
    writeSession(
      "session1.json",
      makeSession({
        model: "claude-sonnet-4-20250514",
        inputTokens: 1_000_000,
        outputTokens: 0,
      }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    // sonnet input rate = $3.00 per 1M tokens
    expect(result.records[0]?.cost_usd).toBeCloseTo(3.0, 4);
  });

  it("ID is 16 hex characters", async () => {
    writeSession("session1.json", makeSession({}));
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// collect - edge cases
// ---------------------------------------------------------------------------

describe("ContinueDevCollector - edge cases", () => {
  it("returns empty when sessions directory is empty", async () => {
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("collector name is 'continue_dev'", async () => {
    const collector = await importCollector();
    expect(collector.name).toBe("continue_dev");
  });
});

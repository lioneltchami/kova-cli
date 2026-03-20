/**
 * cline.test.ts
 *
 * Tests for the Cline collector. Creates fixture task JSON files in a
 * temporary VS Code globalStorage directory.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let storageDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-cline-test-"));
  storageDir = path.join(tmpDir, "saoudrizwan.claude-dev");
  fs.mkdirSync(storageDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

async function importCollector() {
  const capturedStorageDir = storageDir;
  vi.doMock("../../src/lib/constants.js", () => ({
    VERSION: "0.4.0",
    KOVA_DATA_DIR: path.join(tmpDir, ".kova"),
    USAGE_FILE: "usage.json",
    CONFIG_FILE: "config.json",
    DASHBOARD_API_URL: "https://kova.dev/api/v1",
    CLAUDE_CODE_DIR: path.join(tmpDir, ".claude"),
    CLINE_STORAGE_PATHS: {
      // Use the current test platform's path as our mock storage path.
      [process.platform]: capturedStorageDir,
    },
    CONTINUE_SESSIONS_DIR: path.join(tmpDir, ".continue", "sessions"),
    AIDER_CHAT_HISTORY_NAMES: [],
    AIDER_REPORTS_DIR: ".aider/reports",
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

  const { clineCollector } = await import("../../src/lib/collectors/cline.js");
  return clineCollector;
}

function writeTaskFile(filename: string, data: object): void {
  fs.writeFileSync(
    path.join(storageDir, filename),
    JSON.stringify(data),
    "utf-8",
  );
}

function makeTask(overrides: {
  id?: string;
  ts?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
}) {
  return {
    id: overrides.id ?? "task-001",
    ts: overrides.ts ?? new Date("2026-03-15T10:00:00.000Z").getTime(),
    task: "Write a function",
    model: overrides.model ?? "claude-sonnet-4-20250514",
    api_usage: {
      inputTokens: overrides.inputTokens ?? 1500,
      outputTokens: overrides.outputTokens ?? 600,
      totalCost: overrides.totalCost ?? 0.05,
    },
  };
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("ClineCollector - isAvailable", () => {
  it("returns true when storage directory exists", async () => {
    const collector = await importCollector();
    expect(await collector.isAvailable()).toBe(true);
  });

  it("returns false when storage directory does not exist", async () => {
    fs.rmSync(storageDir, { recursive: true, force: true });
    const collector = await importCollector();
    expect(await collector.isAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collect - parsing task files
// ---------------------------------------------------------------------------

describe("ClineCollector - parsing task files", () => {
  it("parses token usage from api_usage field", async () => {
    writeTaskFile(
      "task-001.json",
      makeTask({ inputTokens: 2000, outputTokens: 800 }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.tool).toBe("cline");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.input_tokens).toBe(2000);
    expect(result.records[0]?.output_tokens).toBe(800);
  });

  it("uses reported totalCost when available", async () => {
    writeTaskFile("task-001.json", makeTask({ totalCost: 0.123 }));

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records[0]?.cost_usd).toBeCloseTo(0.123, 4);
  });

  it("maps model name correctly", async () => {
    writeTaskFile(
      "task-001.json",
      makeTask({ model: "claude-haiku-3-5-20241022" }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records[0]?.model).toBe("haiku");
  });

  it("respects since parameter - skips tasks older than since date", async () => {
    writeTaskFile(
      "old.json",
      makeTask({
        id: "old-task",
        ts: new Date("2026-01-01T00:00:00.000Z").getTime(),
      }),
    );
    writeTaskFile(
      "new.json",
      makeTask({
        id: "new-task",
        ts: new Date("2026-03-15T10:00:00.000Z").getTime(),
      }),
    );

    const collector = await importCollector();
    const since = new Date("2026-02-01T00:00:00.000Z");
    const result = await collector.collect(since);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.session_id).toBe("new-task");
  });

  it("handles corrupt JSON file - adds error and continues", async () => {
    fs.writeFileSync(
      path.join(storageDir, "corrupt.json"),
      "{not valid json}",
      "utf-8",
    );
    writeTaskFile("valid.json", makeTask({}));

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toHaveLength(1);
  });

  it("skips tasks with zero input and output tokens", async () => {
    writeTaskFile(
      "zero.json",
      makeTask({ inputTokens: 0, outputTokens: 0, totalCost: 0 }),
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records).toHaveLength(0);
  });

  it("ID is 16 hex characters", async () => {
    writeTaskFile("task-001.json", makeTask({}));
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("parses tasks in subdirectory task.json structure", async () => {
    const tasksDir = path.join(storageDir, "tasks");
    const taskSubDir = path.join(tasksDir, "task-sub-001");
    fs.mkdirSync(taskSubDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskSubDir, "task.json"),
      JSON.stringify(makeTask({ id: "task-sub-001" })),
      "utf-8",
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.session_id).toBe("task-sub-001");
  });
});

// ---------------------------------------------------------------------------
// collect - edge cases
// ---------------------------------------------------------------------------

describe("ClineCollector - edge cases", () => {
  it("collector name is 'cline'", async () => {
    const collector = await importCollector();
    expect(collector.name).toBe("cline");
  });

  it("result tool field is 'cline'", async () => {
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.tool).toBe("cline");
  });

  it("returns empty when no task files exist", async () => {
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

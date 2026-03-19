/**
 * ClaudeCodeCollector tests.
 *
 * Strategy: use vi.doMock (not hoisted) to mock constants.js so CLAUDE_CODE_DIR
 * points to a temp directory we control, then write real JSONL files there.
 * This avoids the os.homedir() caching problem entirely.
 *
 * vi.doMock is NOT hoisted so it must be called before each dynamic import.
 * Combined with vi.resetModules() in beforeEach, each test gets a fresh module.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssistantEntry(overrides: {
  uuid?: string;
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  model?: string;
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens?: number;
}): string {
  return JSON.stringify({
    type: "assistant",
    uuid: overrides.uuid ?? "entry-uuid-001",
    sessionId: overrides.sessionId ?? "session-abc",
    timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
    cwd: overrides.cwd ?? "/home/user/my-project",
    message: {
      role: "assistant",
      model: overrides.model ?? "claude-sonnet-4-20250514",
      usage: {
        input_tokens: overrides.input_tokens ?? 1000,
        cache_creation_input_tokens: overrides.cache_creation_input_tokens ?? 0,
        output_tokens: overrides.output_tokens ?? 500,
      },
    },
  });
}

function makeUserEntry(): string {
  return JSON.stringify({
    type: "user",
    uuid: "user-uuid",
    sessionId: "session-abc",
    timestamp: "2026-03-15T09:00:00.000Z",
    message: { role: "user", content: "hello" },
  });
}

function makeSnapshotEntry(): string {
  return JSON.stringify({
    type: "file-history-snapshot",
    uuid: "snap-uuid",
    sessionId: "session-abc",
    timestamp: "2026-03-15T08:00:00.000Z",
  });
}

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let tmpDir: string;
let claudeDir: string;
let projectsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-collector-test-"));
  claudeDir = path.join(tmpDir, ".claude");
  projectsDir = path.join(claudeDir, "projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

/**
 * Set up the constants mock and import the collector fresh.
 * Must be called after vi.resetModules() (done in beforeEach).
 */
async function importCollector() {
  const capturedDir = claudeDir;
  vi.doMock("../../src/lib/constants.js", () => ({
    VERSION: "0.2.0",
    DASHBOARD_API_URL: "https://kova.dev/api/v1",
    KOVA_DATA_DIR: path.join(tmpDir, ".kova"),
    USAGE_FILE: "usage.json",
    CONFIG_FILE: "config.json",
    CLAUDE_CODE_DIR: capturedDir,
    TOKEN_COSTS: {
      haiku: { input: 0.25, output: 1.25 },
      sonnet: { input: 3.0, output: 15.0 },
      opus: { input: 15.0, output: 75.0 },
    },
    colors: {},
  }));
  const { claudeCodeCollector } =
    await import("../../src/lib/collectors/claude-code.js");
  return claudeCodeCollector;
}

/**
 * Write a JSONL file inside a project subdirectory, then run collect().
 */
async function collectWithContent(content: string, projectName = "test-proj") {
  const projDir = path.join(projectsDir, projectName);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, "session.jsonl"), content, "utf-8");
  const collector = await importCollector();
  return collector.collect();
}

// ---------------------------------------------------------------------------
// Model name mapping tests
// ---------------------------------------------------------------------------

describe("ClaudeCodeCollector - model name mapping", () => {
  it("maps claude-sonnet-4-* to sonnet", async () => {
    const result = await collectWithContent(
      makeAssistantEntry({ model: "claude-sonnet-4-20250514" }),
    );
    expect(result.records[0]?.model).toBe("sonnet");
  });

  it("maps claude-haiku-3-5 to haiku", async () => {
    const result = await collectWithContent(
      makeAssistantEntry({ model: "claude-haiku-3-5-20241022" }),
    );
    expect(result.records[0]?.model).toBe("haiku");
  });

  it("maps claude-opus-4 to opus", async () => {
    const result = await collectWithContent(
      makeAssistantEntry({ model: "claude-opus-4-6" }),
    );
    expect(result.records[0]?.model).toBe("opus");
  });

  it("maps unknown model string to 'unknown'", async () => {
    const result = await collectWithContent(
      makeAssistantEntry({ model: "gpt-4-turbo" }),
    );
    expect(result.records[0]?.model).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Record filtering / skipping behavior
// ---------------------------------------------------------------------------

describe("ClaudeCodeCollector - record filtering", () => {
  it("skips user-type entries", async () => {
    const content = [makeUserEntry(), makeAssistantEntry({})].join("\n");
    const result = await collectWithContent(content);
    expect(result.records).toHaveLength(1);
  });

  it("skips file-history-snapshot entries", async () => {
    const content = [makeSnapshotEntry(), makeAssistantEntry({})].join("\n");
    const result = await collectWithContent(content);
    expect(result.records).toHaveLength(1);
  });

  it("skips empty lines", async () => {
    const content = `\n\n${makeAssistantEntry({})}\n\n`;
    const result = await collectWithContent(content);
    expect(result.records).toHaveLength(1);
  });

  it("handles corrupted JSON lines - adds to errors and continues", async () => {
    const content = ["{not valid json}", makeAssistantEntry({})].join("\n");
    const result = await collectWithContent(content);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toHaveLength(1);
  });

  it("skips entries with zero input and output tokens", async () => {
    const zeroEntry = JSON.stringify({
      type: "assistant",
      uuid: "zero-uuid",
      sessionId: "sess",
      timestamp: "2026-03-15T10:00:00.000Z",
      message: {
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    });
    const result = await collectWithContent(zeroEntry);
    expect(result.records).toHaveLength(0);
  });

  it("handles assistant entry missing usage field gracefully", async () => {
    const noUsage = JSON.stringify({
      type: "assistant",
      uuid: "nu-uuid",
      sessionId: "sess",
      timestamp: "2026-03-15T10:00:00.000Z",
      message: { role: "assistant", model: "claude-sonnet-4-20250514" },
    });
    const result = await collectWithContent(noUsage);
    expect(result.records).toHaveLength(0);
  });

  it("respects since parameter - skips records older than since date", async () => {
    const old = makeAssistantEntry({ timestamp: "2026-01-01T00:00:00.000Z" });
    const recent = makeAssistantEntry({
      uuid: "new-uuid",
      timestamp: "2026-03-15T10:00:00.000Z",
    });
    const content = [old, recent].join("\n");

    const projDir = path.join(projectsDir, "test-proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "session.jsonl"), content, "utf-8");

    const collector = await importCollector();
    const since = new Date("2026-02-01T00:00:00.000Z");
    const result = await collector.collect(since);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.timestamp).toBe("2026-03-15T10:00:00.000Z");
  });

  it("extracts project name from cwd field", async () => {
    const content = makeAssistantEntry({
      cwd: "/home/user/my-awesome-project",
    });
    const result = await collectWithContent(content);
    expect(result.records[0]?.project).toBe("my-awesome-project");
  });

  it("includes cache_creation_input_tokens in input token count", async () => {
    const entry = JSON.stringify({
      type: "assistant",
      uuid: "cache-uuid",
      sessionId: "sess",
      timestamp: "2026-03-15T10:00:00.000Z",
      message: {
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        usage: {
          input_tokens: 800,
          cache_creation_input_tokens: 200,
          output_tokens: 100,
        },
      },
    });
    const result = await collectWithContent(entry);
    // 800 base + 200 cache creation = 1000 total input
    expect(result.records[0]?.input_tokens).toBe(1000);
  });

  it("computes cost using TOKEN_COSTS for sonnet", async () => {
    const content = makeAssistantEntry({
      model: "claude-sonnet-4-20250514",
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    const result = await collectWithContent(content);
    // sonnet input rate = $3.00 per 1M tokens
    expect(result.records[0]?.cost_usd).toBeCloseTo(3.0, 4);
  });

  it("generates deterministic IDs for same input", async () => {
    const entry = makeAssistantEntry({
      uuid: "fixed-uuid",
      sessionId: "fixed-session",
      timestamp: "2026-03-15T10:00:00.000Z",
    });

    const r1 = await collectWithContent(entry, "proj-a");

    // Reset and re-mock for second import
    vi.resetModules();
    const r2 = await collectWithContent(entry, "proj-b");

    expect(r1.records[0]?.id).toBeDefined();
    expect(r1.records[0]?.id).toBe(r2.records[0]?.id);
  });

  it("ID is 16 hex characters", async () => {
    const result = await collectWithContent(makeAssistantEntry({}));
    expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("ClaudeCodeCollector - isAvailable", () => {
  it("returns true when CLAUDE_CODE_DIR exists", async () => {
    // claudeDir already exists (created in beforeEach)
    const collector = await importCollector();
    const available = await collector.isAvailable();
    expect(available).toBe(true);
  });

  it("returns false when CLAUDE_CODE_DIR does not exist", async () => {
    // Remove the claude dir to simulate absence
    fs.rmSync(claudeDir, { recursive: true, force: true });
    const collector = await importCollector();
    const available = await collector.isAvailable();
    expect(available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collect() edge cases
// ---------------------------------------------------------------------------

describe("ClaudeCodeCollector - collect edge cases", () => {
  it("returns empty results when projects dir does not exist", async () => {
    // Remove the projects dir but keep claudeDir
    fs.rmSync(projectsDir, { recursive: true, force: true });
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles corrupted file contents - errors array is populated and collect continues", async () => {
    // Write a JSONL file that is entirely corrupted (all lines invalid JSON)
    const projDir = path.join(projectsDir, "corrupt-proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "session.jsonl"),
      "{bad json line 1}\n{bad json line 2}\n{bad json line 3}",
      "utf-8",
    );

    const collector = await importCollector();
    const result = await collector.collect();

    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    // The error messages should reference JSON parse errors
    expect(result.errors[0]).toContain("JSON parse error");
  });

  it("collector name is 'claude_code'", async () => {
    const collector = await importCollector();
    expect(collector.name).toBe("claude_code");
  });

  it("result tool field is 'claude_code'", async () => {
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.tool).toBe("claude_code");
  });

  it("scanned_paths includes processed jsonl files", async () => {
    const projDir = path.join(projectsDir, "test-proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "session.jsonl"),
      makeAssistantEntry({}),
      "utf-8",
    );
    const collector = await importCollector();
    const result = await collector.collect();
    expect(result.scanned_paths.length).toBeGreaterThan(0);
    expect(result.scanned_paths[0]).toMatch(/\.jsonl$/);
  });
});

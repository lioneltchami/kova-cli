import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsageRecord } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: overrides.id ?? "rec-001",
    tool: overrides.tool ?? "claude_code",
    model: overrides.model ?? "sonnet",
    session_id: overrides.session_id ?? "session-001",
    project: overrides.project ?? "test-project",
    input_tokens: overrides.input_tokens ?? 1000,
    output_tokens: overrides.output_tokens ?? 500,
    cost_usd: overrides.cost_usd ?? 0.0105,
    timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
    duration_ms: overrides.duration_ms ?? null,
    metadata: overrides.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Setup: each test gets a fresh temp dir AND fresh module instance
// so KOVA_DATA_DIR is recomputed with the current HOME each time.
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-store-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  // Force the module to re-evaluate so KOVA_DATA_DIR picks up the new HOME
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// readUsageDatabase
// ---------------------------------------------------------------------------

describe("readUsageDatabase", () => {
  it("returns empty database when file does not exist", async () => {
    const { readUsageDatabase } = await import("../src/lib/local-store.js");
    const db = readUsageDatabase();
    expect(db.version).toBe(1);
    expect(db.records).toEqual([]);
    expect(db.last_scan).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// writeUsageDatabase + readUsageDatabase
// ---------------------------------------------------------------------------

describe("writeUsageDatabase + readUsageDatabase", () => {
  it("roundtrip preserves data", async () => {
    const { readUsageDatabase, writeUsageDatabase } =
      await import("../src/lib/local-store.js");
    const record = makeRecord({ id: "abc-123" });
    writeUsageDatabase({ version: 1, last_scan: null, records: [record] });
    const db = readUsageDatabase();
    expect(db.records).toHaveLength(1);
    expect(db.records[0]?.id).toBe("abc-123");
  });

  it("creates the directory if it does not exist", async () => {
    const { writeUsageDatabase, getUsageDatabasePath } =
      await import("../src/lib/local-store.js");
    writeUsageDatabase({ version: 1, last_scan: null, records: [] });
    const dbPath = getUsageDatabasePath();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("preserves version field as 1", async () => {
    const { readUsageDatabase, writeUsageDatabase } =
      await import("../src/lib/local-store.js");
    writeUsageDatabase({ version: 1, last_scan: null, records: [] });
    const db = readUsageDatabase();
    expect(db.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// appendRecords
// ---------------------------------------------------------------------------

describe("appendRecords", () => {
  it("adds new records and returns count", async () => {
    const { appendRecords, readUsageDatabase } =
      await import("../src/lib/local-store.js");
    const records = [makeRecord({ id: "r1" }), makeRecord({ id: "r2" })];
    const added = appendRecords(records);
    expect(added).toBe(2);
    const db = readUsageDatabase();
    expect(db.records).toHaveLength(2);
  });

  it("deduplicates by ID - same ID not added twice", async () => {
    const { appendRecords, readUsageDatabase } =
      await import("../src/lib/local-store.js");
    const record = makeRecord({ id: "dup-id" });
    appendRecords([record]);
    const added = appendRecords([record]);
    expect(added).toBe(0);
    const db = readUsageDatabase();
    expect(db.records).toHaveLength(1);
  });

  it("returns 0 for empty input", async () => {
    const { appendRecords } = await import("../src/lib/local-store.js");
    const added = appendRecords([]);
    expect(added).toBe(0);
  });

  it("returns count of newly added records only", async () => {
    const { appendRecords } = await import("../src/lib/local-store.js");
    appendRecords([makeRecord({ id: "existing" })]);
    const added = appendRecords([
      makeRecord({ id: "existing" }),
      makeRecord({ id: "new-1" }),
      makeRecord({ id: "new-2" }),
    ]);
    expect(added).toBe(2);
  });

  it("accumulates records across multiple calls", async () => {
    const { appendRecords, readUsageDatabase } =
      await import("../src/lib/local-store.js");
    appendRecords([makeRecord({ id: "r1" })]);
    appendRecords([makeRecord({ id: "r2" })]);
    appendRecords([makeRecord({ id: "r3" })]);
    const db = readUsageDatabase();
    expect(db.records).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// queryRecords
// ---------------------------------------------------------------------------

describe("queryRecords", () => {
  it("with no filters returns all records", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "r1", tool: "claude_code" }),
      makeRecord({ id: "r2", tool: "cursor" }),
      makeRecord({ id: "r3", tool: "claude_code" }),
    ]);
    const results = queryRecords({});
    expect(results).toHaveLength(3);
  });

  it("filters by tool", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "r1", tool: "claude_code" }),
      makeRecord({ id: "r2", tool: "cursor" }),
    ]);
    const results = queryRecords({ tool: "cursor" });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("r2");
  });

  it("filters by since date", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "r1", timestamp: "2026-03-15T10:00:00.000Z" }),
      makeRecord({ id: "r2", timestamp: "2026-03-16T10:00:00.000Z" }),
      makeRecord({ id: "r3", timestamp: "2026-03-17T10:00:00.000Z" }),
    ]);
    const since = new Date("2026-03-16T00:00:00.000Z");
    const results = queryRecords({ since });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(new Date(r.timestamp).getTime()).toBeGreaterThanOrEqual(
        since.getTime(),
      );
    }
  });

  it("filters by until date", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "r1", timestamp: "2026-03-15T10:00:00.000Z" }),
      makeRecord({ id: "r2", timestamp: "2026-03-16T10:00:00.000Z" }),
      makeRecord({ id: "r3", timestamp: "2026-03-17T10:00:00.000Z" }),
    ]);
    const until = new Date("2026-03-15T23:59:59.999Z");
    const results = queryRecords({ until });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("r1");
  });

  it("filters by project", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "r1", project: "proj-a" }),
      makeRecord({ id: "r2", project: "proj-b" }),
      makeRecord({ id: "r3", project: "proj-a" }),
    ]);
    const results = queryRecords({ project: "proj-a" });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.project).toBe("proj-a");
    }
  });

  it("combines multiple filters", async () => {
    const { appendRecords, queryRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({
        id: "r1",
        tool: "claude_code",
        timestamp: "2026-03-15T10:00:00.000Z",
        project: "proj-a",
      }),
      makeRecord({
        id: "r2",
        tool: "cursor",
        timestamp: "2026-03-16T10:00:00.000Z",
        project: "proj-b",
      }),
      makeRecord({
        id: "r3",
        tool: "claude_code",
        timestamp: "2026-03-17T10:00:00.000Z",
        project: "proj-a",
      }),
    ]);
    const results = queryRecords({
      tool: "claude_code",
      project: "proj-a",
      since: new Date("2026-03-17T00:00:00.000Z"),
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("r3");
  });

  it("with no records returns empty array", async () => {
    const { queryRecords } = await import("../src/lib/local-store.js");
    const results = queryRecords({});
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLastScanTimestamp / updateLastScan
// ---------------------------------------------------------------------------

describe("getLastScanTimestamp", () => {
  it("returns null when no scan has been done", async () => {
    const { getLastScanTimestamp } = await import("../src/lib/local-store.js");
    const ts = getLastScanTimestamp();
    expect(ts).toBeNull();
  });
});

describe("updateLastScan", () => {
  it("sets the last scan timestamp", async () => {
    const { getLastScanTimestamp, updateLastScan } =
      await import("../src/lib/local-store.js");
    const before = Date.now();
    updateLastScan();
    const ts = getLastScanTimestamp();
    expect(ts).not.toBeNull();
    expect(ts!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("updates the timestamp on subsequent calls", async () => {
    const { getLastScanTimestamp, updateLastScan } =
      await import("../src/lib/local-store.js");
    updateLastScan();
    const ts1 = getLastScanTimestamp();
    await new Promise((r) => setTimeout(r, 10));
    updateLastScan();
    const ts2 = getLastScanTimestamp();
    expect(ts2!.getTime()).toBeGreaterThanOrEqual(ts1!.getTime());
  });
});

// ---------------------------------------------------------------------------
// pruneOldRecords
// ---------------------------------------------------------------------------

describe("pruneOldRecords", () => {
  it("removes records older than the cutoff date", async () => {
    const { appendRecords, pruneOldRecords, readUsageDatabase } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "old-1", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeRecord({ id: "old-2", timestamp: "2026-01-15T00:00:00.000Z" }),
      makeRecord({ id: "recent", timestamp: "2026-03-15T00:00:00.000Z" }),
    ]);

    const removed = pruneOldRecords(new Date("2026-02-01T00:00:00.000Z"));
    expect(removed).toBe(2);

    const db = readUsageDatabase();
    expect(db.records).toHaveLength(1);
    expect(db.records[0]?.id).toBe("recent");
  });

  it("returns 0 when no records qualify for pruning", async () => {
    const { appendRecords, pruneOldRecords } =
      await import("../src/lib/local-store.js");
    appendRecords([
      makeRecord({ id: "recent", timestamp: "2026-03-15T00:00:00.000Z" }),
    ]);

    const removed = pruneOldRecords(new Date("2026-01-01T00:00:00.000Z"));
    expect(removed).toBe(0);
  });

  it("handles empty database gracefully", async () => {
    const { pruneOldRecords } = await import("../src/lib/local-store.js");
    const removed = pruneOldRecords(new Date());
    expect(removed).toBe(0);
  });
});

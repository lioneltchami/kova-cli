import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sync-tracker-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("getSyncedIds", () => {
  it("returns empty Set when no synced-ids file exists", async () => {
    const { getSyncedIds } = await import("../../src/lib/sync-tracker.js");
    const ids = getSyncedIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });

  it("returns empty Set when synced-ids file contains malformed JSON", async () => {
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    fs.writeFileSync(path.join(kovaDir, "synced-ids.json"), "not-valid-json");

    const { getSyncedIds } = await import("../../src/lib/sync-tracker.js");
    const ids = getSyncedIds();
    expect(ids.size).toBe(0);
  });
});

describe("markAsSynced", () => {
  it("writes IDs to the synced-ids file", async () => {
    const { markAsSynced } = await import("../../src/lib/sync-tracker.js");
    markAsSynced(["id-1", "id-2", "id-3"]);

    const kovaDir = path.join(tmpDir, ".kova");
    const filePath = path.join(kovaDir, "synced-ids.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as string[];
    expect(parsed).toContain("id-1");
    expect(parsed).toContain("id-2");
    expect(parsed).toContain("id-3");
  });

  it("accumulates IDs across multiple calls", async () => {
    const { markAsSynced, getSyncedIds } = await import(
      "../../src/lib/sync-tracker.js"
    );
    markAsSynced(["id-a"]);
    markAsSynced(["id-b"]);

    const ids = getSyncedIds();
    expect(ids.has("id-a")).toBe(true);
    expect(ids.has("id-b")).toBe(true);
  });

  it("does not store duplicate IDs", async () => {
    const { markAsSynced, getSyncedIds } = await import(
      "../../src/lib/sync-tracker.js"
    );
    markAsSynced(["dup-id"]);
    markAsSynced(["dup-id"]);

    const ids = getSyncedIds();
    expect(ids.size).toBe(1);
    expect(ids.has("dup-id")).toBe(true);
  });
});

describe("getSyncedIds round-trip", () => {
  it("reads back the same IDs that were written", async () => {
    const { markAsSynced, getSyncedIds } = await import(
      "../../src/lib/sync-tracker.js"
    );
    const input = ["record-1", "record-2", "record-3"];
    markAsSynced(input);

    const result = getSyncedIds();
    for (const id of input) {
      expect(result.has(id)).toBe(true);
    }
    expect(result.size).toBe(3);
  });
});

describe("50k cap enforcement", () => {
  it("trims the oldest IDs when the cap is exceeded", async () => {
    const { markAsSynced, getSyncedIds } = await import(
      "../../src/lib/sync-tracker.js"
    );

    // Write 50001 unique IDs in one call
    const ids = Array.from({ length: 50_001 }, (_, i) => `cap-id-${i}`);
    markAsSynced(ids);

    const result = getSyncedIds();
    expect(result.size).toBe(50_000);
    // The first ID (index 0) should have been trimmed
    expect(result.has("cap-id-0")).toBe(false);
    // The last ID should be present
    expect(result.has("cap-id-50000")).toBe(true);
  });

  it("keeps exactly 50000 IDs when input is exactly 50000", async () => {
    const { markAsSynced, getSyncedIds } = await import(
      "../../src/lib/sync-tracker.js"
    );

    const ids = Array.from({ length: 50_000 }, (_, i) => `exact-${i}`);
    markAsSynced(ids);

    const result = getSyncedIds();
    expect(result.size).toBe(50_000);
  });
});

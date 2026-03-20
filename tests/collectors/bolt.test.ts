/**
 * bolt.test.ts
 *
 * Tests for the Bolt.new collector stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function importCollector(storedKey: string | null = null) {
  vi.doMock("../../src/lib/credential-manager.js", () => ({
    getToolKey: vi.fn((tool: string) => {
      if (tool === "bolt") return storedKey;
      return null;
    }),
    setToolKey: vi.fn(),
    removeToolKey: vi.fn(),
    listConfiguredTools: vi.fn(() => []),
  }));

  vi.doMock("../../src/lib/constants.js", () => ({
    VERSION: "0.4.0",
    KOVA_DATA_DIR: "/tmp/.kova",
    USAGE_FILE: "usage.json",
    CONFIG_FILE: "config.json",
    DASHBOARD_API_URL: "https://kova.dev/api/v1",
    TOKEN_COSTS: {},
    colors: {},
  }));

  return await import("../../src/lib/collectors/bolt.js");
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("BoltCollector - isAvailable", () => {
  it("returns false when no API key is configured", async () => {
    const { boltCollector } = await importCollector(null);
    expect(await boltCollector.isAvailable()).toBe(false);
  });

  it("returns true when an API key is stored", async () => {
    const { boltCollector } = await importCollector("bolt-api-key-123");
    expect(await boltCollector.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// collect
// ---------------------------------------------------------------------------

describe("BoltCollector - collect", () => {
  it("returns empty records and no errors when no key is configured", async () => {
    const { boltCollector } = await importCollector(null);
    const result = await boltCollector.collect();

    expect(result.tool).toBe("bolt");
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.scanned_paths).toHaveLength(0);
  });

  it("returns empty records with info error message when key is configured", async () => {
    const { boltCollector } = await importCollector("bolt-api-key-123");
    const result = await boltCollector.collect();

    expect(result.tool).toBe("bolt");
    expect(result.records).toHaveLength(0);
    // The stub should return an informational message in errors.
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Bolt");
  });

  it("collector name is 'bolt'", async () => {
    const { boltCollector } = await importCollector(null);
    expect(boltCollector.name).toBe("bolt");
  });

  it("result tool field is always 'bolt'", async () => {
    const { boltCollector } = await importCollector("bolt-api-key-123");
    const result = await boltCollector.collect();
    expect(result.tool).toBe("bolt");
  });
});

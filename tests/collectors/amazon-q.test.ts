/**
 * amazon-q.test.ts
 *
 * Tests for the Amazon Q collector. Mocks global.fetch and AWS credentials.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
  // Clear AWS env vars to avoid system credentials interfering with tests.
  delete process.env["AWS_ACCESS_KEY_ID"];
  delete process.env["AWS_SECRET_ACCESS_KEY"];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env["AWS_ACCESS_KEY_ID"];
  delete process.env["AWS_SECRET_ACCESS_KEY"];
});

async function importCollector(storedKey: string | null = null) {
  vi.doMock("../../src/lib/credential-manager.js", () => ({
    getToolKey: vi.fn((tool: string) => {
      if (tool === "amazon_q") return storedKey;
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
    CLAUDE_CODE_DIR: "/tmp/.claude",
    AMAZON_Q_TOKEN_COSTS: { input: 3.0, output: 15.0 },
    TOKEN_COSTS: {},
    CLINE_STORAGE_PATHS: {},
    CONTINUE_SESSIONS_DIR: "/tmp/.continue/sessions",
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
    colors: {},
  }));

  return await import("../../src/lib/collectors/amazon-q.js");
}

function mockCostExplorerSuccess(
  periods: Array<{ start: string; end: string; amount: string }>,
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      ResultsByTime: periods.map((p) => ({
        TimePeriod: { Start: p.start, End: p.end },
        Total: { AmortizedCost: { Amount: p.amount, Unit: "USD" } },
        Groups: [],
      })),
    }),
  });
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("AmazonQCollector - isAvailable", () => {
  it("returns false when no credentials are configured", async () => {
    const { amazonQCollector } = await importCollector(null);
    expect(await amazonQCollector.isAvailable()).toBe(false);
  });

  it("returns true when a stored key is present", async () => {
    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    expect(await amazonQCollector.isAvailable()).toBe(true);
  });

  it("returns true when AWS_ACCESS_KEY_ID env var is set", async () => {
    process.env["AWS_ACCESS_KEY_ID"] = "AKIAIOSFODNN7EXAMPLE";
    process.env["AWS_SECRET_ACCESS_KEY"] =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const { amazonQCollector } = await importCollector(null);
    expect(await amazonQCollector.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// collect - no credentials
// ---------------------------------------------------------------------------

describe("AmazonQCollector - no credentials", () => {
  it("returns empty result when no credentials are configured", async () => {
    const { amazonQCollector } = await importCollector(null);
    const result = await amazonQCollector.collect();

    expect(result.tool).toBe("amazon_q");
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// collect - API response parsing
// ---------------------------------------------------------------------------

describe("AmazonQCollector - API response parsing", () => {
  it("parses cost from ResultsByTime and creates one record per day", async () => {
    mockCostExplorerSuccess([
      { start: "2026-03-14", end: "2026-03-15", amount: "5.50" },
      { start: "2026-03-15", end: "2026-03-16", amount: "3.25" },
    ]);

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.tool).toBe("amazon_q");
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.cost_usd).toBeCloseTo(5.5, 4);
    expect(result.records[1]?.cost_usd).toBeCloseTo(3.25, 4);
  });

  it("skips periods with zero cost", async () => {
    mockCostExplorerSuccess([
      { start: "2026-03-14", end: "2026-03-15", amount: "0" },
      { start: "2026-03-15", end: "2026-03-16", amount: "2.00" },
    ]);

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.cost_usd).toBeCloseTo(2.0, 4);
  });

  it("sets model to 'unknown' since Cost Explorer does not expose per-model data", async () => {
    mockCostExplorerSuccess([
      { start: "2026-03-15", end: "2026-03-16", amount: "1.50" },
    ]);

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.records[0]?.model).toBe("unknown");
  });

  it("ID is 16 hex characters", async () => {
    mockCostExplorerSuccess([
      { start: "2026-03-15", end: "2026-03-16", amount: "1.50" },
    ]);

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// collect - error handling
// ---------------------------------------------------------------------------

describe("AmazonQCollector - error handling", () => {
  it("handles 403 response by adding error message without throwing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("403");
    expect(result.records).toHaveLength(0);
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const { amazonQCollector } = await importCollector(
      "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
    const result = await amazonQCollector.collect();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toHaveLength(0);
  });
});

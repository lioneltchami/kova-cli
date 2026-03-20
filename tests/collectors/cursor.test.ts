/**
 * cursor.test.ts
 *
 * Mocks credential-manager and global.fetch to test the Cursor collector
 * without making real HTTP calls.
 */
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/credential-manager.js", () => ({
  getToolKey: vi.fn(),
  setToolKey: vi.fn(),
  removeToolKey: vi.fn(),
  listConfiguredTools: vi.fn(() => []),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function importCollector() {
  vi.resetModules();
  vi.doMock("../../src/lib/credential-manager.js", () => ({
    getToolKey: vi.fn(),
    setToolKey: vi.fn(),
    removeToolKey: vi.fn(),
    listConfiguredTools: vi.fn(() => []),
  }));
  return await import("../../src/lib/collectors/cursor.js");
}

function makeEvent(
  overrides: {
    timestamp?: string;
    model?: string;
    kind?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalCents?: number;
  } = {},
) {
  return {
    timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
    model: overrides.model ?? "claude-sonnet-4-20250514",
    kind: overrides.kind ?? "composer",
    tokenUsage: {
      inputTokens: overrides.inputTokens ?? 1000,
      outputTokens: overrides.outputTokens ?? 500,
      ...(overrides.totalCents !== undefined
        ? { totalCents: overrides.totalCents }
        : {}),
    },
  };
}

function mockApiSuccess(events: unknown[], numPages = 1) {
  for (let i = 0; i < numPages; i++) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events }),
    });
  }
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("CursorCollector - isAvailable", () => {
  it("returns true when a key is stored", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("admin-api-key-1234");
    expect(await cursorCollector.isAvailable()).toBe(true);
  });

  it("returns false when no key is stored", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue(null);
    expect(await cursorCollector.isAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collect - Admin API key (non-user_ prefix)
// ---------------------------------------------------------------------------

describe("CursorCollector - collect with Admin API key", () => {
  it("calls Admin API with Basic auth header when key does not start with user_", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("admin-key-xyz");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    await cursorCollector.collect();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cursor.com/teams/filtered-usage-events");
    const authHeader = (init.headers as Record<string, string>)[
      "Authorization"
    ];
    expect(authHeader).toMatch(/^Basic /);
    // The Basic auth encodes "key:" in base64
    const expectedBase64 = Buffer.from("admin-key-xyz:").toString("base64");
    expect(authHeader).toBe(`Basic ${expectedBase64}`);
  });

  it("parses token usage events and produces records", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("admin-key-xyz");

    mockApiSuccess([makeEvent({ inputTokens: 2000, outputTokens: 800 })]);
    // Second page empty to stop pagination
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.tool).toBe("cursor");
    expect(result.records[0]?.input_tokens).toBe(2000);
    expect(result.records[0]?.output_tokens).toBe(800);
  });

  it("uses totalCents when available as cost_usd", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("admin-key-xyz");

    mockApiSuccess([makeEvent({ totalCents: 250 })]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records[0]?.cost_usd).toBeCloseTo(2.5, 4);
  });

  it("computes cost from tokens when totalCents is missing", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("admin-key-xyz");

    // 1M input tokens at CURSOR_POOL_RATES.input = 1.25, 0 output
    mockApiSuccess([makeEvent({ inputTokens: 1_000_000, outputTokens: 0 })]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records[0]?.cost_usd).toBeCloseTo(1.25, 4);
  });

  it("returns empty records when no key is configured", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue(null);

    const result = await cursorCollector.collect();
    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// collect - personal session token (user_ prefix)
// ---------------------------------------------------------------------------

describe("CursorCollector - collect with personal session token", () => {
  it("calls personal API with Cookie header when key starts with user_", async () => {
    const { cursorCollector } = await importCollector();
    const { getToolKey } = await import("../../src/lib/credential-manager.js");
    vi.mocked(getToolKey).mockReturnValue("user_abc123::somedata");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    await cursorCollector.collect();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://www.cursor.com/api/dashboard/get-filtered-usage-events",
    );
    const cookieHeader = (init.headers as Record<string, string>)["Cookie"];
    expect(cookieHeader).toContain(
      "WorkosCursorSessionToken=user_abc123::somedata",
    );
  });
});

// ---------------------------------------------------------------------------
// collect - model name mapping
// ---------------------------------------------------------------------------

describe("CursorCollector - model name mapping", () => {
  async function collectWithModel(modelName: string) {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("admin-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [makeEvent({ model: modelName })] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });
    return cursorCollector.collect();
  }

  it("maps claude-sonnet model to sonnet", async () => {
    const result = await collectWithModel("claude-sonnet-4-20250514");
    expect(result.records[0]?.model).toBe("sonnet");
  });

  it("maps claude-opus model to opus", async () => {
    const result = await collectWithModel("claude-opus-4-20250901");
    expect(result.records[0]?.model).toBe("opus");
  });

  it("maps gpt-4o to gpt-4o", async () => {
    const result = await collectWithModel("gpt-4o");
    expect(result.records[0]?.model).toBe("gpt-4o");
  });

  it("maps gpt-4.1 to gpt-4.1", async () => {
    const result = await collectWithModel("gpt-4.1");
    expect(result.records[0]?.model).toBe("gpt-4.1");
  });
});

// ---------------------------------------------------------------------------
// collect - deterministic IDs
// ---------------------------------------------------------------------------

describe("CursorCollector - deterministic IDs", () => {
  it("generates deterministic IDs (same input produces same ID)", async () => {
    const event = makeEvent({
      timestamp: "2026-03-15T10:00:00.000Z",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
    });

    const expectedId = crypto
      .createHash("sha256")
      .update(
        `cursor:2026-03-15T10:00:00.000Z:claude-sonnet-4-20250514:1000:500`,
      )
      .digest("hex")
      .slice(0, 16);

    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("admin-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [event] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records[0]?.id).toBe(expectedId);
  });

  it("ID is 16 hex characters", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("admin-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [makeEvent()] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("different outputTokens produces different IDs (collision prevention)", async () => {
    // Same timestamp/model/inputTokens but different outputTokens must yield distinct IDs
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("admin-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    const event1 = makeEvent({
      timestamp: "2026-03-15T10:00:00.000Z",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 100,
    });
    const event2 = makeEvent({
      timestamp: "2026-03-15T10:00:00.000Z",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [event1, event2] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
  });
});

// ---------------------------------------------------------------------------
// collect - since parameter
// ---------------------------------------------------------------------------

describe("CursorCollector - since parameter", () => {
  it("respects since parameter by filtering out older events", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("admin-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    const oldEvent = makeEvent({ timestamp: "2026-01-01T00:00:00.000Z" });
    const newEvent = makeEvent({ timestamp: "2026-03-15T10:00:00.000Z" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [oldEvent, newEvent] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const since = new Date("2026-02-01T00:00:00.000Z");
    const result = await cursorCollector.collect(since);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.timestamp).toBe("2026-03-15T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// collect - error handling
// ---------------------------------------------------------------------------

describe("CursorCollector - error handling", () => {
  it("handles 401 response by adding error message without throwing", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("bad-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const result = await cursorCollector.collect();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/401|invalid|expired/i);
    expect(result.records).toHaveLength(0);
  });

  it("handles network error by adding error message and returning partial results", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("some-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await cursorCollector.collect();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("network error");
    expect(result.records).toHaveLength(0);
  });

  it("result tool field is always 'cursor'", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/credential-manager.js", () => ({
      getToolKey: vi.fn().mockReturnValue("some-key"),
      setToolKey: vi.fn(),
      removeToolKey: vi.fn(),
      listConfiguredTools: vi.fn(() => []),
    }));
    const { cursorCollector } =
      await import("../../src/lib/collectors/cursor.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ events: [] }),
    });

    const result = await cursorCollector.collect();
    expect(result.tool).toBe("cursor");
  });
});

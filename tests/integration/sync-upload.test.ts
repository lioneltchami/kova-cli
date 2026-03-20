/**
 * Integration tests for sync upload: retry logic, idempotency tracker,
 * HTTPS enforcement, and duplicate response handling.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sync-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeRecord(id: string, overrides: { cost_usd?: number } = {}) {
  return {
    id,
    tool: "cursor" as const,
    model: "sonnet" as const,
    session_id: "sess-sync",
    project: "sync-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: overrides.cost_usd ?? 0.05,
    timestamp: "2026-03-15T10:00:00.000Z",
    duration_ms: null,
    metadata: {},
  };
}

function mockCredentials(
  overrides: { dashboardUrl?: string; apiKey?: string } = {},
) {
  const kovaDir = path.join(tmpDir, ".kova");
  fs.mkdirSync(kovaDir, { recursive: true });
  const creds = {
    apiKey: overrides.apiKey ?? "test-api-key",
    dashboardUrl: overrides.dashboardUrl ?? "https://kova.dev",
    userId: "",
    email: "test@example.com",
    plan: "pro",
    cachedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(kovaDir, "credentials.json"),
    JSON.stringify(creds),
    { mode: 0o600 },
  );
}

// ---------------------------------------------------------------------------
// Upload record format
// ---------------------------------------------------------------------------

describe("sync-upload: upload record format", () => {
  it("uploads records in the correct payload format", async () => {
    mockCredentials();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-1")]);

    expect(result.success).toBe(true);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(0);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/usage");
    expect(init.method).toBe("POST");

    const payload = JSON.parse(init.body as string) as {
      records: Array<{ id: string; tool: string; cli_version: string }>;
    };
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0]?.id).toBe("rec-1");
    expect(payload.records[0]?.tool).toBe("cursor");
    expect(payload.records[0]?.cli_version).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Retry on 500 errors
// ---------------------------------------------------------------------------

describe("sync-upload: retry logic", () => {
  it("retries up to 3 times on 500 server errors then fails", async () => {
    mockCredentials();

    // All 3 attempts return 500
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-retry")]);

    // Should have attempted 3 times
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.accepted).toBe(0);
  }, 60_000);

  it("succeeds after a 500 on the first attempt and 200 on the second", async () => {
    mockCredentials();

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accepted: 1, duplicates: 0 }),
      });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-retry-ok")]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.accepted).toBe(1);
  }, 60_000);

  it("does not retry on 401 auth error", async () => {
    mockCredentials();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-401")]);

    // Should only be called once -- no retry on 401
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it("does not retry on 413 payload too large", async () => {
    mockCredentials();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({}),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-413")]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: already-synced records are filtered out
// ---------------------------------------------------------------------------

describe("sync-upload: idempotency tracker", () => {
  it("skips records that were already synced in a previous upload", async () => {
    mockCredentials();

    // First upload -- succeeds and marks record as synced
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    await uploadUsage([makeRecord("already-synced")]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Reset mock call count but keep the synced-ids file intact
    mockFetch.mockReset();
    vi.resetModules();

    // Second upload with the same record -- should be filtered out
    const { uploadUsage: uploadUsage2 } =
      await import("../../src/lib/uploader.js");
    const result = await uploadUsage2([makeRecord("already-synced")]);

    // No fetch call because record was already synced
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.accepted).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it("uploads new records while skipping already-synced ones", async () => {
    mockCredentials();

    // First upload syncs rec-a
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    await uploadUsage([makeRecord("rec-a")]);

    mockFetch.mockReset();
    vi.resetModules();

    // Second upload has rec-a (synced) and rec-b (new)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage: uploadUsage2 } =
      await import("../../src/lib/uploader.js");
    const result = await uploadUsage2([
      makeRecord("rec-a"),
      makeRecord("rec-b"),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { records: Array<{ id: string }> };
    // Only rec-b should be uploaded
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0]?.id).toBe("rec-b");
    expect(result.accepted).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// HTTPS enforcement
// ---------------------------------------------------------------------------

describe("sync-upload: HTTPS enforcement", () => {
  it("aborts upload when dashboardUrl uses plain HTTP (non-localhost)", async () => {
    mockCredentials({ dashboardUrl: "http://kova.dev" });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-http")]);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.accepted).toBe(0);
  });

  it("allows http://localhost for local development", async () => {
    mockCredentials({ dashboardUrl: "http://localhost:3000" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-localhost")]);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it("allows https:// URLs", async () => {
    mockCredentials({ dashboardUrl: "https://kova.dev" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("rec-https")]);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate response handling
// ---------------------------------------------------------------------------

describe("sync-upload: duplicate response handling", () => {
  it("accumulates duplicates count from server response", async () => {
    mockCredentials();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 2, duplicates: 3 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([
      makeRecord("dup-1"),
      makeRecord("dup-2"),
      makeRecord("dup-3"),
      makeRecord("dup-4"),
      makeRecord("dup-5"),
    ]);

    expect(result.success).toBe(true);
    expect(result.accepted).toBe(2);
    expect(result.duplicates).toBe(3);
  });

  it("returns success with zero duplicates when server reports none", async () => {
    mockCredentials();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, duplicates: 0 }),
    });

    const { uploadUsage } = await import("../../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("fresh-rec")]);

    expect(result.success).toBe(true);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(0);
  });
});

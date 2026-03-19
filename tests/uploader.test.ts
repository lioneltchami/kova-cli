import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/logger.js", () => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  table: vi.fn(),
}));

let tmpDir: string;

function makeRecord(id: string, cost_usd = 0.05) {
  return {
    id,
    tool: "claude_code" as const,
    model: "sonnet" as const,
    session_id: "sess-1",
    project: "test-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd,
    timestamp: "2026-03-15T10:00:00.000Z",
    duration_ms: null,
    metadata: {},
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-uploader-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeSuccessResponse(accepted = 1, duplicates = 0) {
  return {
    ok: true,
    status: 201,
    json: vi.fn().mockResolvedValue({ accepted, duplicates, errors: 0 }),
  };
}

describe("uploadUsage", () => {
  it("returns { success: false } when not logged in (no credentials)", async () => {
    // No credentials stored
    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1")]);
    expect(result.success).toBe(false);
    expect(result.accepted).toBe(0);
    expect(result.duplicates).toBe(0);
  });

  it("sends correct payload shape with id, session_id, duration_ms, cli_version per record", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse());
    vi.stubGlobal("fetch", mockFetch);

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage([makeRecord("r1")]);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string) as {
      records: Array<{
        id: string;
        session_id: string;
        duration_ms: number | null;
        cli_version: string;
      }>;
    };

    expect(body).toHaveProperty("records");
    expect(body.records).toHaveLength(1);
    const record = body.records[0]!;
    expect(record).toHaveProperty("id", "r1");
    expect(record).toHaveProperty("session_id", "sess-1");
    expect(record).toHaveProperty("duration_ms", null);
    expect(record).toHaveProperty("cli_version");
    // Top-level envelope fields removed -- payload is just { records: [...] }
    expect(body).not.toHaveProperty("cli_version");
    expect(body).not.toHaveProperty("period");
    expect(body).not.toHaveProperty("os");
    expect(body).not.toHaveProperty("node_version");
  });

  it("sends Bearer auth header", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_secret_key",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse());
    vi.stubGlobal("fetch", mockFetch);

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage([makeRecord("r1")]);

    const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer kova_secret_key");
  });

  it("batches 501 records into 2 fetch calls", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse(500));
    vi.stubGlobal("fetch", mockFetch);

    const records = Array.from({ length: 501 }, (_, i) => makeRecord(`r${i}`));

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage(records);

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First batch should have 500 records
    const firstBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { records: unknown[] };
    expect(firstBody.records).toHaveLength(500);

    // Second batch should have the remaining 1 record
    const secondBody = JSON.parse(
      (mockFetch.mock.calls[1] as [string, RequestInit])[1].body as string,
    ) as { records: unknown[] };
    expect(secondBody.records).toHaveLength(1);
  });

  it("exactly 500 records makes only 1 fetch call", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse(500));
    vi.stubGlobal("fetch", mockFetch);

    const records = Array.from({ length: 500 }, (_, i) => makeRecord(`r${i}`));

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage(records);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns { success: true, accepted, duplicates } when all batches succeed", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeSuccessResponse(1, 1)),
    );

    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1"), makeRecord("r2")]);
    expect(result.success).toBe(true);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it("returns { success: false } when any batch fails (HTTP 500)", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1")]);
    expect(result.success).toBe(false);
  });

  it("returns { success: false } on network error", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1")]);
    expect(result.success).toBe(false);
  });

  it("logs duplicates at info level when server reports duplicates > 0", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeSuccessResponse(0, 3)),
    );

    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1")]);
    expect(result.success).toBe(true);
    expect(result.duplicates).toBe(3);
    expect(result.accepted).toBe(0);
  });
});

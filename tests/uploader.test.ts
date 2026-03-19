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

describe("uploadUsage", () => {
  it("returns false when not logged in (no credentials)", async () => {
    // No credentials stored
    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1")]);
    expect(result).toBe(false);
  });

  it("sends correct payload shape with cli_version, period, os, node_version", async () => {
    const { storeCredentials } = await import("../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage([makeRecord("r1")]);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string) as {
      cli_version: string;
      period: { from: string; to: string };
      os: string;
      node_version: string;
    };

    expect(body).toHaveProperty("cli_version");
    expect(body).toHaveProperty("period");
    expect(body.period).toHaveProperty("from");
    expect(body.period).toHaveProperty("to");
    expect(body).toHaveProperty("os");
    expect(body).toHaveProperty("node_version");
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

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
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

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
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

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const records = Array.from({ length: 500 }, (_, i) => makeRecord(`r${i}`));

    const { uploadUsage } = await import("../src/lib/uploader.js");
    await uploadUsage(records);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns true when all batches succeed (HTTP 200)", async () => {
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
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const { uploadUsage } = await import("../src/lib/uploader.js");
    const result = await uploadUsage([makeRecord("r1"), makeRecord("r2")]);
    expect(result).toBe(true);
  });

  it("returns false when any batch fails (HTTP 500)", async () => {
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
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
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
    expect(result).toBe(false);
  });
});

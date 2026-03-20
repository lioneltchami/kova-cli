import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-login-test-"));
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

describe("loginCommand", () => {
  it("shows instructions when no API key is provided", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");

    await loginCommand(undefined);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("kova.dev/dashboard/settings");
    expect(infoCalls).toContain("kova login");
  });

  it("shows 'Updating credentials...' when already logged in", async () => {
    const { storeCredentials } = await import("../../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_existing_key",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ plan: "pro", active: true }),
      }),
    );

    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_new_key");

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("Updating credentials");
  });

  it("stores credentials and validates via checkSubscription", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ plan: "pro", active: true }),
      }),
    );

    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_valid_key");

    // Should have called fetch for subscription validation
    expect(vi.mocked(global.fetch)).toHaveBeenCalled();

    // Should show success
    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("Logged in");
  });

  it("stores correct plan from subscription response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ plan: "team", active: true }),
      }),
    );

    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_team_key");

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("team");
  });

  it("stores credentials with warning when network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_offline_key");

    // Should warn about inability to validate
    const warnCalls = vi.mocked(logger.warn).mock.calls.flat().join(" ");
    expect(warnCalls).toContain("Could not validate");

    // Credentials should still be stored -- verify readable
    const { readCredentials } = await import("../../src/lib/dashboard.js");
    const creds = readCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.apiKey).toBe("kova_offline_key");
  });

  it("shows error and removes credentials when API returns 401 (invalid key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const logger = await import("../../src/lib/logger.js");
    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_invalid_key");

    // Should show an error about the invalid key (not a warning)
    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("invalid");
  });

  it("removes credentials when auth fails with 401 (not offline fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_bad_key");

    const { readCredentials } = await import("../../src/lib/dashboard.js");
    const creds = readCredentials();
    // Credentials should be removed since the key is definitively invalid (401)
    expect(creds).toBeNull();
  });

  it("sets dashboardUrl by stripping /api/v1 from DASHBOARD_API_URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ plan: "pro", active: true }),
      }),
    );

    const { loginCommand } = await import("../../src/commands/login.js");
    await loginCommand("kova_key_url_test");

    const { readCredentials } = await import("../../src/lib/dashboard.js");
    const creds = readCredentials();
    expect(creds).not.toBeNull();
    // dashboardUrl must NOT contain /api/v1
    expect(creds?.dashboardUrl).not.toContain("/api/v1");
    // Should be the base domain
    expect(creds?.dashboardUrl).toContain("kova.dev");
  });
});

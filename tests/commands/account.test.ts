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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-account-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("accountCommand", () => {
  it("shows free plan and upsell when not logged in", async () => {
    // No credentials stored
    const logger = await import("../../src/lib/logger.js");
    const { accountCommand } = await import("../../src/commands/account.js");
    await accountCommand();

    // Should show the Kova Account header
    expect(vi.mocked(logger.header)).toHaveBeenCalledWith("Kova Account");

    // Table should include free plan
    const tableCalls = vi
      .mocked(logger.table)
      .mock.calls.flat(2)
      .join(" ")
      .toLowerCase();
    expect(tableCalls).toContain("free");

    // Should mention upsell to Pro
    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("team cost dashboard and budget alerts");
  });

  it("shows plan, email and key prefix when logged in", async () => {
    const { storeCredentials } = await import("../../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey_abcdef1234",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "user@company.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const logger = await import("../../src/lib/logger.js");
    const { accountCommand } = await import("../../src/commands/account.js");
    await accountCommand();

    const tableCalls = vi.mocked(logger.table).mock.calls.flat(2).join(" ");
    expect(tableCalls).toContain("pro");
    expect(tableCalls).toContain("user@company.com");
  });

  it("masks API key showing first 12 chars followed by '...'", async () => {
    const { storeCredentials } = await import("../../src/lib/dashboard.js");
    const apiKey = "kova_abcdefgh1234567890";
    storeCredentials({
      apiKey,
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const logger = await import("../../src/lib/logger.js");
    const { accountCommand } = await import("../../src/commands/account.js");
    await accountCommand();

    const expectedPrefix = apiKey.slice(0, 12) + "...";
    const tableCalls = vi.mocked(logger.table).mock.calls.flat(2).join(" ");
    expect(tableCalls).toContain(expectedPrefix);
    // Full key must NOT appear
    expect(tableCalls).not.toContain(apiKey);
  });

  it("shows dashboard URL in table", async () => {
    const { storeCredentials } = await import("../../src/lib/dashboard.js");
    storeCredentials({
      apiKey: "kova_testkey",
      dashboardUrl: "https://kova.dev",
      userId: "user-1",
      email: "test@example.com",
      plan: "pro",
      cachedAt: new Date().toISOString(),
    });

    const logger = await import("../../src/lib/logger.js");
    const { accountCommand } = await import("../../src/commands/account.js");
    await accountCommand();

    const tableCalls = vi.mocked(logger.table).mock.calls.flat(2).join(" ");
    expect(tableCalls).toContain("kova.dev");
  });

  it("upsell mentions 'team cost dashboard and budget alerts'", async () => {
    // Not logged in -- triggers upsell path
    const logger = await import("../../src/lib/logger.js");
    const { accountCommand } = await import("../../src/commands/account.js");
    await accountCommand();

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("team cost dashboard and budget alerts");
  });
});

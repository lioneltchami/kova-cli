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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sso-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("ssoConfigureCommand", () => {
  it("saves issuer URL to config when a valid issuer is provided", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { ssoConfigureCommand } = await import("../../src/commands/sso.js");
    await ssoConfigureCommand({ issuer: "https://sso.mycompany.com" });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("sso.mycompany.com");

    // Verify persisted to config file
    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.sso?.enabled).toBe(true);
    expect(config.sso?.issuer).toBe("https://sso.mycompany.com");
  });

  it("shows error when no --issuer flag is provided", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { ssoConfigureCommand } = await import("../../src/commands/sso.js");
    await ssoConfigureCommand({});

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("issuer");
  });

  it("shows error when issuer URL is not a valid URL", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { ssoConfigureCommand } = await import("../../src/commands/sso.js");
    await ssoConfigureCommand({ issuer: "not-a-valid-url" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid issuer URL");
  });
});

describe("ssoStatusCommand", () => {
  it("shows not-configured status when no SSO config exists", async () => {
    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { ssoStatusCommand } = await import("../../src/commands/sso.js");
    await ssoStatusCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("not configured");
  });

  it("shows issuer URL in status output when SSO is configured", async () => {
    // Pre-write config with SSO enabled
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    const config = {
      budget: { monthly_usd: null, daily_usd: null, warn_at_percent: 80 },
      tracking: {
        tools: ["claude_code"],
        auto_sync: false,
        scan_interval_minutes: 60,
      },
      display: { currency: "usd", show_tokens: true, show_model_breakdown: true },
      sso: {
        enabled: true,
        issuer: "https://sso.example.com",
      },
    };
    fs.writeFileSync(
      path.join(kovaDir, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );

    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { ssoStatusCommand } = await import("../../src/commands/sso.js");
    await ssoStatusCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("sso.example.com");
    expect(combined).toContain("enabled");
  });

  it("shows token expiry information when token and expiry date are present", async () => {
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    const futureExpiry = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const config = {
      budget: { monthly_usd: null, daily_usd: null, warn_at_percent: 80 },
      tracking: {
        tools: ["claude_code"],
        auto_sync: false,
        scan_interval_minutes: 60,
      },
      display: { currency: "usd", show_tokens: true, show_model_breakdown: true },
      sso: {
        enabled: true,
        issuer: "https://sso.example.com",
        token: "eyJhbGciOiJSUzI1NiJ9.test",
        token_expires_at: futureExpiry,
      },
    };
    fs.writeFileSync(
      path.join(kovaDir, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );

    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { ssoStatusCommand } = await import("../../src/commands/sso.js");
    await ssoStatusCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("valid until");
  });

  it("shows expired label when token has passed its expiry date", async () => {
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    const pastExpiry = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const config = {
      budget: { monthly_usd: null, daily_usd: null, warn_at_percent: 80 },
      tracking: {
        tools: ["claude_code"],
        auto_sync: false,
        scan_interval_minutes: 60,
      },
      display: { currency: "usd", show_tokens: true, show_model_breakdown: true },
      sso: {
        enabled: true,
        issuer: "https://sso.example.com",
        token: "eyJhbGciOiJSUzI1NiJ9.old",
        token_expires_at: pastExpiry,
      },
    };
    fs.writeFileSync(
      path.join(kovaDir, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );

    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { ssoStatusCommand } = await import("../../src/commands/sso.js");
    await ssoStatusCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("expired");
  });
});

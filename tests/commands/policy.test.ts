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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-policy-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("policyListCommand", () => {
  it("prints enterprise upgrade message", async () => {
    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { policyListCommand } = await import("../../src/commands/policy.js");
    await policyListCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Enterprise");
  });

  it("shows upgrade URL in list output", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { policyListCommand } = await import("../../src/commands/policy.js");
    await policyListCommand();

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("kova.dev/pricing");
  });

  it("shows policy management header", async () => {
    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { policyListCommand } = await import("../../src/commands/policy.js");
    await policyListCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Policy Management");
  });
});

describe("policyEnforceCommand", () => {
  it("runs without throwing when no policies are configured", async () => {
    const { policyEnforceCommand } = await import(
      "../../src/commands/policy.js"
    );
    await expect(policyEnforceCommand()).resolves.toBeUndefined();
  });

  it("reports budget violation when no monthly budget is set", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { policyEnforceCommand } = await import(
      "../../src/commands/policy.js"
    );
    await policyEnforceCommand();

    // Default config has no monthly budget so a violation should be logged via warn
    const warnCalls = vi.mocked(logger.warn).mock.calls.flat().join(" ");
    expect(warnCalls).toContain("violation");
  });

  it("prints PASS for budget policy when monthly budget is configured", async () => {
    // Write a config with a monthly budget set
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    const config = {
      budget: { monthly_usd: 100, daily_usd: null, warn_at_percent: 80 },
      tracking: {
        tools: ["claude_code"],
        auto_sync: false,
        scan_interval_minutes: 60,
      },
      display: { currency: "usd", show_tokens: true, show_model_breakdown: true },
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

    const { policyEnforceCommand } = await import(
      "../../src/commands/policy.js"
    );
    await policyEnforceCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("PASS");
  });

  it("shows enforcement check header in output", async () => {
    const outputLines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputLines.push(args.join(" "));
    });

    const { policyEnforceCommand } = await import(
      "../../src/commands/policy.js"
    );
    await policyEnforceCommand();
    logSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Policy Enforcement");
  });
});

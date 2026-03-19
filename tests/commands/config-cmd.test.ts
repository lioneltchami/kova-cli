/**
 * config-cmd.test.ts
 *
 * Tests for the config command. Uses temp directories for config-store isolation.
 * Mocks credential-manager and logger to inspect behavior.
 */
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

vi.mock("../../src/lib/credential-manager.js", () => ({
  getToolKey: vi.fn(),
  setToolKey: vi.fn(),
  removeToolKey: vi.fn(),
  listConfiguredTools: vi.fn(() => []),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-config-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

async function importCommand() {
  return await import("../../src/commands/config-cmd.js");
}

async function importLogger() {
  return await import("../../src/lib/logger.js");
}

async function importCredManager() {
  return await import("../../src/lib/credential-manager.js");
}

// ---------------------------------------------------------------------------
// config (no action) - summary
// ---------------------------------------------------------------------------

describe("configCommand - no action (show summary)", () => {
  it("calls header with 'Kova Configuration' when no action given", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    await configCommand(undefined, []);

    const headerCalls = vi.mocked(logger.header).mock.calls.flat().join(" ");
    expect(headerCalls).toContain("Kova Configuration");
  });

  it("shows no-credentials message when no tools configured", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const logger = await importLogger();
    vi.mocked(credMgr.listConfiguredTools).mockReturnValue([]);

    await configCommand(undefined, []);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("set-key");
  });

  it("shows configured tool credentials when tools are configured", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const logger = await importLogger();
    vi.mocked(credMgr.listConfiguredTools).mockReturnValue(["cursor" as const]);
    vi.mocked(credMgr.getToolKey).mockReturnValue("admin-key-12345678");

    await configCommand(undefined, []);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("credentials");
  });
});

// ---------------------------------------------------------------------------
// config set-key
// ---------------------------------------------------------------------------

describe("configCommand - set-key", () => {
  it("calls setToolKey with the correct tool and key", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();

    await configCommand("set-key", ["cursor", "admin-key-xyz"]);

    expect(credMgr.setToolKey).toHaveBeenCalledWith("cursor", "admin-key-xyz");
  });

  it("shows masked key in success confirmation", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("set-key", ["cursor", "admin-key-12345678"]);

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    // Key should be masked: first 8 chars + "..."
    expect(successCalls).toContain("admin-ke...");
  });

  it("shows error when tool name is missing", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("set-key", []);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Usage");
  });

  it("rejects invalid tool name with error message", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    const credMgr = await importCredManager();

    await configCommand("set-key", ["invalid-tool-name", "some-key"]);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("invalid-tool-name");
    expect(credMgr.setToolKey).not.toHaveBeenCalled();
  });

  it("shows error when key argument is missing", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("set-key", ["cursor"]);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Usage");
  });

  it("shows tool-specific help hint after storing key", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("set-key", ["cursor", "admin-key-xyz"]);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("Cursor");
  });

  it("accepts all valid tool names", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const validTools = [
      "cursor",
      "copilot",
      "windsurf",
      "devin",
      "claude_code",
    ];

    for (const tool of validTools) {
      vi.mocked(credMgr.setToolKey).mockClear();
      await configCommand("set-key", [tool, "test-key-value"]);
      expect(credMgr.setToolKey).toHaveBeenCalledWith(tool, "test-key-value");
    }
  });
});

// ---------------------------------------------------------------------------
// config remove-key
// ---------------------------------------------------------------------------

describe("configCommand - remove-key", () => {
  it("calls removeToolKey with the correct tool name", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();

    await configCommand("remove-key", ["cursor"]);

    expect(credMgr.removeToolKey).toHaveBeenCalledWith("cursor");
  });

  it("shows success message after removing key", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("remove-key", ["cursor"]);

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("cursor");
  });

  it("shows error when tool name is missing", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();

    await configCommand("remove-key", []);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Usage");
  });

  it("rejects invalid tool name", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    const credMgr = await importCredManager();

    await configCommand("remove-key", ["badtool"]);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("badtool");
    expect(credMgr.removeToolKey).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// config show-keys
// ---------------------------------------------------------------------------

describe("configCommand - show-keys", () => {
  it("shows message when no keys are configured", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const logger = await importLogger();
    vi.mocked(credMgr.listConfiguredTools).mockReturnValue([]);

    await configCommand("show-keys", []);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("set-key");
  });

  it("shows header when credentials are configured", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const logger = await importLogger();
    vi.mocked(credMgr.listConfiguredTools).mockReturnValue(["cursor" as const]);
    vi.mocked(credMgr.getToolKey).mockReturnValue("admin-key-12345678");

    await configCommand("show-keys", []);

    const headerCalls = vi.mocked(logger.header).mock.calls.flat().join(" ");
    expect(headerCalls).toContain("Credentials");
  });

  it("shows masked keys (first 8 chars + ...) for configured tools", async () => {
    const { configCommand } = await importCommand();
    const credMgr = await importCredManager();
    const logger = await importLogger();
    vi.mocked(credMgr.listConfiguredTools).mockReturnValue([
      "copilot" as const,
    ]);
    vi.mocked(credMgr.getToolKey).mockReturnValue("ghp_abcdefghijklmno");

    await configCommand("show-keys", []);

    // logger.table is called with rows containing the masked key
    const tableCalls = vi.mocked(logger.table).mock.calls;
    expect(tableCalls.length).toBeGreaterThan(0);
    const allTableData = JSON.stringify(tableCalls);
    expect(allTableData).toContain("ghp_abcd...");
  });
});

// ---------------------------------------------------------------------------
// config set
// ---------------------------------------------------------------------------

describe("configCommand - set", () => {
  it("updates tracking.tools via updateConfig", async () => {
    const { configCommand } = await importCommand();
    await configCommand("set", ["tracking.tools", "claude_code,cursor"]);

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.tracking.tools).toContain("claude_code");
    expect(config.tracking.tools).toContain("cursor");
  });

  it("parses boolean values correctly for tracking.auto_sync", async () => {
    const { configCommand } = await importCommand();
    await configCommand("set", ["tracking.auto_sync", "false"]);

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.tracking.auto_sync).toBe(false);
  });

  it("parses number values correctly for budget.monthly_usd", async () => {
    const { configCommand } = await importCommand();
    await configCommand("set", ["budget.monthly_usd", "250"]);

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.budget.monthly_usd).toBe(250);
  });

  it("shows success message after updating config", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    await configCommand("set", ["tracking.auto_sync", "true"]);

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("tracking.auto_sync");
  });

  it("shows error for unknown config key", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    await configCommand("set", ["tracking.nonexistent", "value"]);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("tracking.nonexistent");
  });

  it("shows error when key or value is missing", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    await configCommand("set", []);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Usage");
  });
});

// ---------------------------------------------------------------------------
// config - unknown action
// ---------------------------------------------------------------------------

describe("configCommand - unknown action", () => {
  it("shows error for unknown action", async () => {
    const { configCommand } = await importCommand();
    const logger = await importLogger();
    await configCommand("unknown-action", []);

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("unknown-action");
  });
});

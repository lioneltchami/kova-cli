/**
 * credential-manager.test.ts
 *
 * Strategy: use a temp directory as KOVA_DATA_DIR by vi.doMock on constants.js.
 * Each test gets a fresh module via vi.resetModules() in beforeEach.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let kovaDataDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-cred-test-"));
  kovaDataDir = path.join(tmpDir, ".kova");
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

async function importManager() {
  const capturedDir = kovaDataDir;
  vi.doMock("../src/lib/constants.js", () => ({
    VERSION: "0.3.0",
    KOVA_DATA_DIR: capturedDir,
    USAGE_FILE: "usage.json",
    CONFIG_FILE: "config.json",
    DASHBOARD_API_URL: "https://kova.dev/api/v1",
    CLAUDE_CODE_DIR: path.join(tmpDir, ".claude"),
    TOKEN_COSTS: {},
    colors: {},
    CURSOR_STATE_DB_PATHS: {},
    COPILOT_CHAT_PATHS: {},
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
  }));
  return await import("../src/lib/credential-manager.js");
}

describe("readToolCredentials", () => {
  it("returns empty object when credentials file does not exist", async () => {
    const mgr = await importManager();
    const result = mgr.readToolCredentials();
    expect(result).toEqual({});
  });

  it("returns empty object when credentials file contains invalid JSON", async () => {
    const mgr = await importManager();
    fs.mkdirSync(kovaDataDir, { recursive: true });
    fs.writeFileSync(
      path.join(kovaDataDir, "tool-credentials.json"),
      "{invalid json",
      "utf-8",
    );
    const result = mgr.readToolCredentials();
    expect(result).toEqual({});
  });

  it("returns empty object when credentials file contains non-object JSON", async () => {
    const mgr = await importManager();
    fs.mkdirSync(kovaDataDir, { recursive: true });
    fs.writeFileSync(
      path.join(kovaDataDir, "tool-credentials.json"),
      "null",
      "utf-8",
    );
    const result = mgr.readToolCredentials();
    expect(result).toEqual({});
  });
});

describe("writeToolCredentials", () => {
  it("creates the credentials file with the given data", async () => {
    const mgr = await importManager();
    mgr.writeToolCredentials({ cursor: "test-key-abc" });
    const filePath = path.join(kovaDataDir, "tool-credentials.json");
    expect(fs.existsSync(filePath)).toBe(true);
    const contents = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(contents.cursor).toBe("test-key-abc");
  });

  it("creates parent directory if it does not exist", async () => {
    const mgr = await importManager();
    expect(fs.existsSync(kovaDataDir)).toBe(false);
    mgr.writeToolCredentials({ devin: "cog_testkey" });
    expect(fs.existsSync(kovaDataDir)).toBe(true);
  });
});

describe("write then read round-trip", () => {
  it("preserves all credential data through write and read", async () => {
    const mgr = await importManager();
    const creds = {
      cursor: "cursor-api-key-1234",
      copilot: "ghp_testtoken",
      windsurf: "ws-service-key",
      devin: "cog_devin_key",
    };
    mgr.writeToolCredentials(creds);
    const result = mgr.readToolCredentials();
    expect(result.cursor).toBe("cursor-api-key-1234");
    expect(result.copilot).toBe("ghp_testtoken");
    expect(result.windsurf).toBe("ws-service-key");
    expect(result.devin).toBe("cog_devin_key");
  });
});

describe("getToolKey", () => {
  it("returns null for an unconfigured tool", async () => {
    const mgr = await importManager();
    expect(mgr.getToolKey("cursor")).toBeNull();
  });

  it("returns null when credentials file does not exist", async () => {
    const mgr = await importManager();
    expect(mgr.getToolKey("copilot")).toBeNull();
  });
});

describe("setToolKey", () => {
  it("stores the key and retrieves it via getToolKey", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "my-cursor-api-key");
    expect(mgr.getToolKey("cursor")).toBe("my-cursor-api-key");
  });

  it("overwrites an existing key with a new value", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "old-key");
    mgr.setToolKey("cursor", "new-key");
    expect(mgr.getToolKey("cursor")).toBe("new-key");
  });

  it("stores multiple tools simultaneously without conflict", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "key-cursor");
    mgr.setToolKey("copilot", "key-copilot");
    mgr.setToolKey("devin", "key-devin");
    expect(mgr.getToolKey("cursor")).toBe("key-cursor");
    expect(mgr.getToolKey("copilot")).toBe("key-copilot");
    expect(mgr.getToolKey("devin")).toBe("key-devin");
  });
});

describe("removeToolKey", () => {
  it("removes the key so getToolKey returns null after removal", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "some-key");
    mgr.removeToolKey("cursor");
    expect(mgr.getToolKey("cursor")).toBeNull();
  });

  it("does not throw when removing a key that was never set", async () => {
    const mgr = await importManager();
    expect(() => mgr.removeToolKey("windsurf")).not.toThrow();
  });

  it("does not affect other tools when one key is removed", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "key-cursor");
    mgr.setToolKey("copilot", "key-copilot");
    mgr.removeToolKey("cursor");
    expect(mgr.getToolKey("cursor")).toBeNull();
    expect(mgr.getToolKey("copilot")).toBe("key-copilot");
  });
});

describe("listConfiguredTools", () => {
  it("returns empty array when no tools are configured", async () => {
    const mgr = await importManager();
    expect(mgr.listConfiguredTools()).toEqual([]);
  });

  it("returns the correct list of configured tools", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "key-a");
    mgr.setToolKey("devin", "key-b");
    const list = mgr.listConfiguredTools();
    expect(list).toContain("cursor");
    expect(list).toContain("devin");
    expect(list).toHaveLength(2);
  });

  it("does not include tools that have been removed", async () => {
    const mgr = await importManager();
    mgr.setToolKey("cursor", "key-cursor");
    mgr.setToolKey("copilot", "key-copilot");
    mgr.removeToolKey("cursor");
    const list = mgr.listConfiguredTools();
    expect(list).not.toContain("cursor");
    expect(list).toContain("copilot");
  });
});

describe("credentials file structure", () => {
  it("creates file as a valid JSON object with correct keys", async () => {
    const mgr = await importManager();
    mgr.setToolKey("windsurf", "ws-key-xyz");
    const filePath = path.join(kovaDataDir, "tool-credentials.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
    expect(parsed.windsurf).toBe("ws-key-xyz");
  });
});

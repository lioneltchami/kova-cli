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
  progress: vi.fn(),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-hook-test-"));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { hookCommand } from "../../src/commands/hook.js";
import * as loggerMod from "../../src/lib/logger.js";

describe("hookCommand", () => {
  it("shows usage info when no action given", async () => {
    await hookCommand();

    expect(loggerMod.header).toHaveBeenCalledWith("Kova Hook");
    expect(loggerMod.info).toHaveBeenCalledWith("Usage: kova hook install");
  });

  it("creates .claude/settings.json when it does not exist", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    await hookCommand("install");

    const settingsPath = path.join(tmpDir, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(loggerMod.success).toHaveBeenCalledWith("Kova hook installed!");
  });

  it("merges hook into existing settings.json", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    // Create existing settings with some pre-existing config
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ permissions: { allow: ["read"] } }, null, 2),
      "utf-8",
    );

    await hookCommand("install");

    const settings = JSON.parse(
      fs.readFileSync(path.join(claudeDir, "settings.json"), "utf-8"),
    );
    // Existing config should be preserved
    expect(settings.permissions).toEqual({ allow: ["read"] });
    // Hook should be added
    expect(settings.hooks.Stop).toHaveLength(1);
  });

  it("detects already-installed hook and shows info message", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    // Install once
    await hookCommand("install");
    vi.clearAllMocks();

    // Install again
    await hookCommand("install");

    expect(loggerMod.info).toHaveBeenCalledWith(
      "Kova hook is already installed in this project.",
    );
    // success should NOT be called for a duplicate install
    expect(loggerMod.success).not.toHaveBeenCalled();
  });

  it("hook config has correct structure containing kova track", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    await hookCommand("install");

    const settingsPath = path.join(tmpDir, ".claude", "settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

    const hookEntry = settings.hooks.Stop[0];
    expect(hookEntry.matcher).toBe("");
    expect(hookEntry.hooks).toHaveLength(1);
    expect(hookEntry.hooks[0].type).toBe("command");
    expect(hookEntry.hooks[0].command).toContain("kova track");
  });
});

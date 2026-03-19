import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Setup: redirect HOME to a temp directory so config is isolated
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-config-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// getDefaultConfig
// ---------------------------------------------------------------------------

describe("getDefaultConfig", () => {
  it("returns expected budget defaults", async () => {
    const { getDefaultConfig } = await import("../src/lib/config-store.js");
    const config = getDefaultConfig();
    expect(config.budget.monthly_usd).toBeNull();
    expect(config.budget.daily_usd).toBeNull();
    expect(config.budget.warn_at_percent).toBe(80);
  });

  it("returns expected tracking defaults", async () => {
    const { getDefaultConfig } = await import("../src/lib/config-store.js");
    const config = getDefaultConfig();
    expect(config.tracking.tools).toContain("claude_code");
    expect(config.tracking.auto_sync).toBe(false);
    expect(config.tracking.scan_interval_minutes).toBe(60);
  });

  it("returns expected display defaults", async () => {
    const { getDefaultConfig } = await import("../src/lib/config-store.js");
    const config = getDefaultConfig();
    expect(config.display.currency).toBe("usd");
    expect(config.display.show_tokens).toBe(true);
    expect(config.display.show_model_breakdown).toBe(true);
  });

  it("budget.warn_at_percent is 80", async () => {
    const { getDefaultConfig } = await import("../src/lib/config-store.js");
    expect(getDefaultConfig().budget.warn_at_percent).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// readConfig
// ---------------------------------------------------------------------------

describe("readConfig", () => {
  it("returns default config when file does not exist", async () => {
    const { readConfig, getDefaultConfig } =
      await import("../src/lib/config-store.js");
    const config = readConfig();
    const defaults = getDefaultConfig();
    expect(config.budget.warn_at_percent).toBe(defaults.budget.warn_at_percent);
    expect(config.tracking.tools).toEqual(defaults.tracking.tools);
  });

  it("handles corrupted config file by returning defaults", async () => {
    const { readConfig, getConfigPath, getDefaultConfig } =
      await import("../src/lib/config-store.js");
    const configPath = getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{not valid json}", "utf-8");
    const config = readConfig();
    const defaults = getDefaultConfig();
    expect(config.budget.warn_at_percent).toBe(defaults.budget.warn_at_percent);
  });
});

// ---------------------------------------------------------------------------
// writeConfig + readConfig roundtrip
// ---------------------------------------------------------------------------

describe("writeConfig + readConfig", () => {
  it("roundtrip preserves all fields", async () => {
    const { readConfig, writeConfig, getDefaultConfig } =
      await import("../src/lib/config-store.js");
    const config = getDefaultConfig();
    config.budget.monthly_usd = 100;
    config.budget.daily_usd = 10;
    config.budget.warn_at_percent = 75;
    config.tracking.auto_sync = true;
    config.tracking.scan_interval_minutes = 30;

    writeConfig(config);
    const read = readConfig();

    expect(read.budget.monthly_usd).toBe(100);
    expect(read.budget.daily_usd).toBe(10);
    expect(read.budget.warn_at_percent).toBe(75);
    expect(read.tracking.auto_sync).toBe(true);
    expect(read.tracking.scan_interval_minutes).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------

describe("updateConfig", () => {
  it("merges partial budget changes without affecting other fields", async () => {
    const { readConfig, updateConfig } =
      await import("../src/lib/config-store.js");
    updateConfig({
      budget: { monthly_usd: 200, daily_usd: null, warn_at_percent: 80 },
    });
    const config = readConfig();
    expect(config.budget.monthly_usd).toBe(200);
    // tracking defaults should be preserved
    expect(config.tracking.tools).toContain("claude_code");
  });

  it("merges partial tracking changes", async () => {
    const { readConfig, updateConfig } =
      await import("../src/lib/config-store.js");
    updateConfig({
      tracking: {
        tools: ["claude_code"],
        auto_sync: true,
        scan_interval_minutes: 15,
      },
    });
    const config = readConfig();
    expect(config.tracking.auto_sync).toBe(true);
    expect(config.tracking.scan_interval_minutes).toBe(15);
    // budget defaults preserved
    expect(config.budget.monthly_usd).toBeNull();
  });

  it("preserves unmodified fields when updating budget", async () => {
    const { readConfig, writeConfig, updateConfig, getDefaultConfig } =
      await import("../src/lib/config-store.js");
    const base = getDefaultConfig();
    base.tracking.auto_sync = true;
    writeConfig(base);

    updateConfig({
      budget: { monthly_usd: 50, daily_usd: null, warn_at_percent: 80 },
    });
    const config = readConfig();
    // tracking.auto_sync was set before and should be preserved
    expect(config.tracking.auto_sync).toBe(true);
    expect(config.budget.monthly_usd).toBe(50);
  });

  it("can clear budget by setting nulls", async () => {
    const { readConfig, writeConfig, updateConfig, getDefaultConfig } =
      await import("../src/lib/config-store.js");
    const base = getDefaultConfig();
    base.budget.monthly_usd = 100;
    writeConfig(base);

    updateConfig({
      budget: { monthly_usd: null, daily_usd: null, warn_at_percent: 80 },
    });
    const config = readConfig();
    expect(config.budget.monthly_usd).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  generateConfig,
  saveConfig,
  loadConfig,
  setConfigValue,
  addRule,
  addBoundary,
} from "../src/lib/config.js";
import { DEFAULT_CONFIG } from "../src/lib/constants.js";
import type { DetectedProject } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const fullyDetected: DetectedProject = {
  language: "TypeScript",
  framework: "Next.js",
  packageManager: "pnpm",
  database: "Supabase",
  auth: "BetterAuth",
  payments: "Stripe",
  commands: {
    test: "vitest run",
    lint: "eslint .",
    build: "tsc",
    typecheck: "tsc --noEmit",
    dev: "next dev",
  },
};

const emptyDetected: DetectedProject = {
  language: null,
  framework: null,
  packageManager: null,
  database: null,
  auth: null,
  payments: null,
  commands: {
    test: null,
    lint: null,
    build: null,
    typecheck: null,
    dev: null,
  },
};

describe("config", () => {
  describe("generateConfig", () => {
    it("creates config with detected values", () => {
      const config = generateConfig(fullyDetected);
      expect(config.project.language).toBe("TypeScript");
      expect(config.project.framework).toBe("Next.js");
      expect(config.project.package_manager).toBe("pnpm");
      expect(config.quality.test).toBe("vitest run");
      expect(config.quality.lint).toBe("eslint .");
      expect(config.quality.build).toBe("tsc");
      expect(config.quality.typecheck).toBe("tsc --noEmit");
    });

    it("uses defaults for null detected values", () => {
      const config = generateConfig(emptyDetected);
      // Falls back to DEFAULT_CONFIG values
      expect(config.project.language).toBe(DEFAULT_CONFIG.project.language);
      expect(config.project.framework).toBe(DEFAULT_CONFIG.project.framework);
      expect(config.project.package_manager).toBe(
        DEFAULT_CONFIG.project.package_manager,
      );
      expect(config.quality.test).toBeNull();
      expect(config.quality.lint).toBeNull();
    });
  });

  describe("saveConfig and loadConfig", () => {
    it("roundtrips config through save and load", async () => {
      const config = generateConfig(fullyDetected);
      config.project.name = "roundtrip-test";
      await saveConfig(tmpDir, config);
      const loaded = await loadConfig(tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.project.name).toBe("roundtrip-test");
      expect(loaded!.project.language).toBe("TypeScript");
      expect(loaded!.project.framework).toBe("Next.js");
      expect(loaded!.project.package_manager).toBe("pnpm");
      expect(loaded!.quality.test).toBe("vitest run");
    });

    it("returns null when no config file exists", async () => {
      const result = await loadConfig(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe("setConfigValue", () => {
    it("sets a nested value with dot notation", async () => {
      const config = generateConfig(fullyDetected);
      config.project.name = "set-value-test";
      await saveConfig(tmpDir, config);

      await setConfigValue(tmpDir, "project.name", "new-name");

      const loaded = await loadConfig(tmpDir);
      expect(loaded!.project.name).toBe("new-name");
    });

    it("converts 'true'/'false' strings to booleans", async () => {
      const config = generateConfig(fullyDetected);
      await saveConfig(tmpDir, config);

      await setConfigValue(tmpDir, "models.auto", "false");
      const loaded = await loadConfig(tmpDir);
      expect(loaded!.models.auto).toBe(false);

      await setConfigValue(tmpDir, "models.auto", "true");
      const loaded2 = await loadConfig(tmpDir);
      expect(loaded2!.models.auto).toBe(true);
    });

    it("converts numeric strings to numbers", async () => {
      const config = generateConfig(fullyDetected);
      await saveConfig(tmpDir, config);

      await setConfigValue(tmpDir, "execution.max_parallel_agents", "8");
      const loaded = await loadConfig(tmpDir);
      expect(loaded!.execution.max_parallel_agents).toBe(8);
    });
  });

  describe("addRule", () => {
    it("appends a rule to the rules array", async () => {
      const config = generateConfig(fullyDetected);
      config.rules = [];
      await saveConfig(tmpDir, config);

      await addRule(tmpDir, "Never modify migration files directly");
      const loaded = await loadConfig(tmpDir);
      expect(loaded!.rules).toContain("Never modify migration files directly");
      expect(loaded!.rules.length).toBe(1);

      await addRule(tmpDir, "Always write tests first");
      const loaded2 = await loadConfig(tmpDir);
      expect(loaded2!.rules.length).toBe(2);
      expect(loaded2!.rules).toContain("Always write tests first");
    });
  });

  describe("addBoundary", () => {
    it("appends a boundary to never_touch array", async () => {
      const config = generateConfig(fullyDetected);
      config.boundaries.never_touch = [];
      await saveConfig(tmpDir, config);

      await addBoundary(tmpDir, "secrets/**");
      const loaded = await loadConfig(tmpDir);
      expect(loaded!.boundaries.never_touch).toContain("secrets/**");
      expect(loaded!.boundaries.never_touch.length).toBe(1);

      await addBoundary(tmpDir, ".env.production");
      const loaded2 = await loadConfig(tmpDir);
      expect(loaded2!.boundaries.never_touch.length).toBe(2);
      expect(loaded2!.boundaries.never_touch).toContain(".env.production");
    });
  });
});

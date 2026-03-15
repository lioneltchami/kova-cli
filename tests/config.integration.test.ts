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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-config-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const detected: DetectedProject = {
  language: "TypeScript",
  framework: "Next.js",
  packageManager: "pnpm",
  database: "Supabase",
  auth: "NextAuth",
  payments: "Stripe",
  commands: {
    test: "vitest run",
    lint: "eslint .",
    build: "next build",
    typecheck: "tsc --noEmit",
    dev: "next dev",
  },
};

describe("config integration", () => {
  it("reads and displays config from kova.yaml", async () => {
    // Save a config and read it back
    const config = generateConfig(detected);
    config.project.name = "integration-test-project";
    await saveConfig(tmpDir, config);

    const loaded = await loadConfig(tmpDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.project.name).toBe("integration-test-project");
    expect(loaded!.project.language).toBe("TypeScript");
    expect(loaded!.project.framework).toBe("Next.js");
    expect(loaded!.project.package_manager).toBe("pnpm");
    expect(loaded!.models.auto).toBe(DEFAULT_CONFIG.models.auto);
    expect(loaded!.models.trivial).toBe(DEFAULT_CONFIG.models.trivial);
    expect(loaded!.models.moderate).toBe(DEFAULT_CONFIG.models.moderate);
    expect(loaded!.models.complex).toBe(DEFAULT_CONFIG.models.complex);
    expect(loaded!.quality.test).toBe("vitest run");
    expect(loaded!.quality.lint).toBe("eslint .");
    expect(loaded!.quality.build).toBe("next build");
    expect(loaded!.quality.typecheck).toBe("tsc --noEmit");
    expect(loaded!.execution.max_parallel_agents).toBe(
      DEFAULT_CONFIG.execution.max_parallel_agents,
    );
  });

  it("sets a nested value via dot notation", async () => {
    const config = generateConfig(detected);
    await saveConfig(tmpDir, config);

    // Change models.trivial to sonnet via dot notation
    await setConfigValue(tmpDir, "models.trivial", "sonnet");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.models.trivial).toBe("sonnet");

    // Change a deeply nested boolean
    await setConfigValue(tmpDir, "quality.validate_after_each_task", "true");
    const loaded2 = await loadConfig(tmpDir);
    expect(loaded2!.quality.validate_after_each_task).toBe(true);
  });

  it("sets a numeric value via dot notation", async () => {
    const config = generateConfig(detected);
    await saveConfig(tmpDir, config);

    await setConfigValue(tmpDir, "execution.max_parallel_agents", "8");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.execution.max_parallel_agents).toBe(8);
  });

  it("adds a rule to config", async () => {
    const config = generateConfig(detected);
    config.rules = [];
    await saveConfig(tmpDir, config);

    await addRule(tmpDir, "use strict");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.rules).toContain("use strict");
    expect(loaded!.rules.length).toBe(1);
  });

  it("adds multiple rules cumulatively", async () => {
    const config = generateConfig(detected);
    config.rules = [];
    await saveConfig(tmpDir, config);

    await addRule(tmpDir, "use strict");
    await addRule(tmpDir, "no-any types");
    await addRule(tmpDir, "always write tests first");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.rules).toContain("use strict");
    expect(loaded!.rules).toContain("no-any types");
    expect(loaded!.rules).toContain("always write tests first");
    expect(loaded!.rules.length).toBe(3);
  });

  it("adds a boundary to config", async () => {
    const config = generateConfig(detected);
    config.boundaries.never_touch = [];
    await saveConfig(tmpDir, config);

    await addBoundary(tmpDir, "*.lock");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.boundaries.never_touch).toContain("*.lock");
    expect(loaded!.boundaries.never_touch.length).toBe(1);
  });

  it("adds multiple boundaries cumulatively", async () => {
    const config = generateConfig(detected);
    config.boundaries.never_touch = [];
    await saveConfig(tmpDir, config);

    await addBoundary(tmpDir, "*.lock");
    await addBoundary(tmpDir, ".env*");
    await addBoundary(tmpDir, "secrets/**");

    const loaded = await loadConfig(tmpDir);
    expect(loaded!.boundaries.never_touch).toContain("*.lock");
    expect(loaded!.boundaries.never_touch).toContain(".env*");
    expect(loaded!.boundaries.never_touch).toContain("secrets/**");
    expect(loaded!.boundaries.never_touch.length).toBe(3);
  });

  it("returns null for a directory with no kova.yaml", async () => {
    const loaded = await loadConfig(tmpDir);
    expect(loaded).toBeNull();
  });

  it("preserves unrelated config sections when setting a value", async () => {
    const config = generateConfig(detected);
    config.rules = ["pre-existing rule"];
    config.boundaries.never_touch = ["*.lock"];
    await saveConfig(tmpDir, config);

    // Change one value
    await setConfigValue(tmpDir, "models.auto", "false");

    const loaded = await loadConfig(tmpDir);
    // The changed value is updated
    expect(loaded!.models.auto).toBe(false);
    // Unrelated sections are preserved
    expect(loaded!.rules).toContain("pre-existing rule");
    expect(loaded!.boundaries.never_touch).toContain("*.lock");
    expect(loaded!.project.language).toBe("TypeScript");
  });
});

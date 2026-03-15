import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/lib/constants.js";
import { selectModel } from "../src/lib/model-selector.js";
import type { KovaConfig, PlanTask } from "../src/types.js";

function makeTask(overrides: Partial<PlanTask> = {}): PlanTask {
  return {
    id: "task-1",
    name: "Test Task",
    depends_on: [],
    assigned_to: "frontend-specialist",
    agent_type: "frontend-specialist",
    parallel: false,
    description: "A generic task",
    files: [],
    model: null,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<KovaConfig["models"]> = {}): KovaConfig {
  return {
    ...DEFAULT_CONFIG,
    models: {
      ...DEFAULT_CONFIG.models,
      ...overrides,
    },
  };
}

describe("selectModel", () => {
  it("returns task.model when explicitly set", () => {
    const task = makeTask({ model: "haiku" });
    const result = selectModel(task, makeConfig());
    expect(result).toBe("haiku");
  });

  it("returns task.model of opus when explicitly set", () => {
    const task = makeTask({ model: "opus" });
    const result = selectModel(task, makeConfig());
    expect(result).toBe("opus");
  });

  it("returns config.models.moderate when auto is false", () => {
    const task = makeTask({
      model: null,
      description: "A complex architectural overhaul refactor",
      files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"],
    });
    const config = makeConfig({ auto: false, moderate: "sonnet" });
    const result = selectModel(task, config);
    expect(result).toBe("sonnet");
  });

  it("returns haiku for simple single-file tasks", () => {
    const task = makeTask({
      model: null,
      description: "Fix a typo in the config",
      files: ["config.ts"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("haiku");
  });

  it("returns sonnet for moderate tasks", () => {
    const task = makeTask({
      model: null,
      description: "Add a new API endpoint for user profile",
      files: ["api.ts", "types.ts"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("sonnet");
  });

  it("returns opus for architectural tasks", () => {
    const task = makeTask({
      model: null,
      description: "Refactor the entire authentication module",
      files: ["auth.ts"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("opus");
  });

  it("returns opus for security tasks with 3+ files", () => {
    const task = makeTask({
      model: null,
      description: "Update auth session token validation logic",
      files: ["auth.ts", "session.ts", "token.ts"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("opus");
  });

  it("returns opus for tasks with 5+ files", () => {
    const task = makeTask({
      model: null,
      description: "Update multiple components for new design system",
      files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("opus");
  });

  it("returns sonnet as default for unmatched tasks", () => {
    const task = makeTask({
      model: null,
      description: "Build a new button component",
      files: ["Button.tsx", "Button.test.tsx"],
    });
    const result = selectModel(task, makeConfig({ auto: true }));
    expect(result).toBe("sonnet");
  });
});

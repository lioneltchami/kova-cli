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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-tag-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("tagCommand", () => {
  it("lists empty cost centers when none configured", async () => {
    const output: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.join(" "));
    });

    const { tagCommand } = await import("../../src/commands/tag.js");
    await tagCommand(undefined, {});
    logSpy.mockRestore();

    const combined = output.join("\n");
    expect(combined).toContain("No cost centers configured");
  });

  it("creates a new cost center and maps a project to it", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { tagCommand } = await import("../../src/commands/tag.js");

    await tagCommand("my-project", { costCenter: "Engineering" });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("Engineering");
    expect(successCalls).toContain("my-project");

    // Verify it was persisted
    const { readCostCenters } = await import("../../src/lib/config-store.js");
    const centers = readCostCenters();
    expect(centers).toHaveLength(1);
    expect(centers[0]?.name).toBe("Engineering");
    expect(centers[0]?.projects).toContain("my-project");
  });

  it("adds project to an existing cost center", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { tagCommand } = await import("../../src/commands/tag.js");

    // Create cost center with first project
    await tagCommand("project-a", { costCenter: "Engineering" });
    vi.clearAllMocks();

    // Add second project to same cost center
    await tagCommand("project-b", { costCenter: "Engineering" });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("project-b");

    const { readCostCenters } = await import("../../src/lib/config-store.js");
    const centers = readCostCenters();
    expect(centers).toHaveLength(1);
    expect(centers[0]?.projects).toContain("project-a");
    expect(centers[0]?.projects).toContain("project-b");
  });

  it("shows error when no --cost-center flag provided", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { tagCommand } = await import("../../src/commands/tag.js");

    await tagCommand("my-project", {});

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("--cost-center");
  });

  it("lists all cost centers with their projects", async () => {
    const { tagCommand } = await import("../../src/commands/tag.js");

    // Create two cost centers
    await tagCommand("frontend-app", { costCenter: "Frontend" });
    await tagCommand("api-service", { costCenter: "Backend" });

    vi.resetModules();

    const output: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.join(" "));
    });

    const { tagCommand: tagCommand2 } =
      await import("../../src/commands/tag.js");
    await tagCommand2(undefined, {});
    logSpy.mockRestore();

    const combined = output.join("\n");
    expect(combined).toContain("Cost Center Mappings");
    expect(combined).toContain("Frontend");
    expect(combined).toContain("Backend");
  });

  it("skips duplicate project mapping within same cost center", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { tagCommand } = await import("../../src/commands/tag.js");

    await tagCommand("my-project", { costCenter: "Engineering" });
    vi.clearAllMocks();

    // Attempt to add the same project again
    await tagCommand("my-project", { costCenter: "Engineering" });

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("already mapped");

    // Should still be only 1 entry for the project
    const { readCostCenters } = await import("../../src/lib/config-store.js");
    const centers = readCostCenters();
    expect(centers[0]?.projects.filter((p) => p === "my-project")).toHaveLength(
      1,
    );
  });
});

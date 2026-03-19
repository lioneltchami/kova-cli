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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-budget-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("budgetCommand", () => {
  it("with no action displays current budget status", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand(undefined);

    // Should call header with "Budget Status"
    const headerCalls = vi.mocked(logger.header).mock.calls.flat().join(" ");
    expect(headerCalls).toContain("Budget");
  });

  it("shows 'No budget configured' when none is set", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand(undefined);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("No budget");
  });

  it("set --monthly updates monthly budget in config", async () => {
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { monthly: "150" });

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.budget.monthly_usd).toBe(150);
  });

  it("set --daily updates daily budget in config", async () => {
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { daily: "25" });

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.budget.daily_usd).toBe(25);
  });

  it("set --warn-at updates warn threshold", async () => {
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { warnAt: "70" });

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.budget.warn_at_percent).toBe(70);
  });

  it("clear resets both budgets to null", async () => {
    // First set a budget
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { monthly: "100", daily: "10" });
    await budgetCommand("clear");

    const { readConfig } = await import("../../src/lib/config-store.js");
    const config = readConfig();
    expect(config.budget.monthly_usd).toBeNull();
    expect(config.budget.daily_usd).toBeNull();
  });

  it("validates that monthly amount must be non-negative", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { monthly: "-10" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid");
  });

  it("validates that non-numeric monthly value is rejected", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { monthly: "abc" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid");
  });

  it("shows success message after setting budget", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { monthly: "200" });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("updated");
  });

  it("shows success message after clearing budget", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("clear");

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("cleared");
  });

  it("errors on unknown action", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("unknown-action");

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Unknown");
  });

  it("warns when set is called without any options", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", {});

    const warnCalls = vi.mocked(logger.warn).mock.calls.flat().join(" ");
    expect(warnCalls).toContain("No budget values");
  });

  it("validates that warn-at must be between 0-100", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { budgetCommand } = await import("../../src/commands/budget.js");
    await budgetCommand("set", { warnAt: "150" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid");
  });
});

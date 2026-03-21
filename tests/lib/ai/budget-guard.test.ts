import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBudgetGuard } from "../../../src/lib/ai/budget-guard.js";

vi.mock("../../../src/lib/logger.js", () => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  table: vi.fn(),
}));

// ---------------------------------------------------------------------------
// createBudgetGuard
// ---------------------------------------------------------------------------

describe("createBudgetGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for undefined budget", () => {
    expect(createBudgetGuard(undefined)).toBeNull();
  });

  it("returns null for zero budget", () => {
    expect(createBudgetGuard(0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recordSpend
// ---------------------------------------------------------------------------

describe("recordSpend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when within budget", () => {
    const guard = createBudgetGuard(1.0)!;
    expect(guard.recordSpend(0.1)).toBe(true);
  });

  it("returns false when budget exceeded (>= 100%)", () => {
    const guard = createBudgetGuard(1.0)!;
    // Spend exactly the full budget
    expect(guard.recordSpend(1.0)).toBe(false);
  });

  it("warns at 80% threshold", async () => {
    const logger = await import("../../../src/lib/logger.js");
    const guard = createBudgetGuard(1.0)!;

    guard.recordSpend(0.85);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Approaching budget"),
    );
  });

  it("warns only once (not on subsequent spends past threshold)", async () => {
    const logger = await import("../../../src/lib/logger.js");
    const guard = createBudgetGuard(1.0)!;

    guard.recordSpend(0.85); // triggers warning
    guard.recordSpend(0.05); // still above 80%, should not warn again

    // One warn for the 80% threshold; the second spend does not re-warn
    const warnCalls = vi
      .mocked(logger.warn)
      .mock.calls.filter((call) =>
        String(call[0]).includes("Approaching budget"),
      );
    expect(warnCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

describe("check", () => {
  it("returns correct BudgetStatus", () => {
    const guard = createBudgetGuard(2.0)!;
    guard.recordSpend(0.5);

    const status = guard.check();

    expect(status.spent).toBe(0.5);
    expect(status.budget).toBe(2.0);
    expect(status.percent).toBe(25);
    expect(status.warning).toBe(false);
    expect(status.exceeded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// spent
// ---------------------------------------------------------------------------

describe("spent", () => {
  it("returns cumulative total after multiple spends", () => {
    const guard = createBudgetGuard(10.0)!;
    guard.recordSpend(1.5);
    guard.recordSpend(2.3);
    guard.recordSpend(0.7);

    expect(guard.spent()).toBeCloseTo(4.5);
  });
});

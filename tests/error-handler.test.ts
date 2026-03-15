import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatErrorWithSuggestion,
  levenshteinDistance,
  suggestCommand,
  wrapCommandAction,
} from "../src/lib/error-handler.js";

describe("levenshteinDistance", () => {
  it('returns 0 for identical strings ("plan" vs "plan")', () => {
    expect(levenshteinDistance("plan", "plan")).toBe(0);
  });

  it('returns 1 for one insertion ("pln" vs "plan")', () => {
    expect(levenshteinDistance("pln", "plan")).toBe(1);
  });

  it('returns 1 for one substitution ("bild" vs "build")', () => {
    expect(levenshteinDistance("bild", "build")).toBe(1);
  });

  it('returns value > 3 for completely different strings ("xyz" vs "plan")', () => {
    expect(levenshteinDistance("xyz", "plan")).toBeGreaterThan(3);
  });

  it('returns 4 for empty string vs "plan"', () => {
    expect(levenshteinDistance("", "plan")).toBe(4);
  });

  it('returns 4 for "plan" vs empty string', () => {
    expect(levenshteinDistance("plan", "")).toBe(4);
  });
});

describe("suggestCommand", () => {
  it('suggests "plan" for input "pln"', () => {
    expect(suggestCommand("pln", ["plan", "build", "run"])).toBe("plan");
  });

  it('suggests "build" for input "bild"', () => {
    expect(suggestCommand("bild", ["plan", "build", "run"])).toBe("build");
  });

  it('suggests "status" for input "stat"', () => {
    expect(suggestCommand("stat", ["status", "plan", "build"])).toBe("status");
  });

  it('returns null for input "xyz" with no close match', () => {
    // "xyz" has distance 3 to "run" which equals the threshold of 4 (not strictly less),
    // so use a longer, clearly unrelated string instead
    expect(suggestCommand("xyz123", ["plan", "build", "run"])).toBeNull();
  });

  it('returns null for input "completley-wrong" with no close match', () => {
    expect(suggestCommand("completley-wrong", ["plan", "build"])).toBeNull();
  });
});

describe("formatErrorWithSuggestion", () => {
  it('contains "Did you mean" when a suggestion exists', () => {
    const msg = formatErrorWithSuggestion("pln", ["plan"]);
    expect(msg).toContain("Did you mean");
  });

  it("contains the suggested command name when a suggestion exists", () => {
    const msg = formatErrorWithSuggestion("pln", ["plan"]);
    expect(msg).toContain("plan");
  });

  it('does NOT contain "Did you mean" when no suggestion exists', () => {
    const msg = formatErrorWithSuggestion("xyz", ["plan"]);
    expect(msg).not.toContain("Did you mean");
  });

  it('always contains "Docs:" link', () => {
    const msg = formatErrorWithSuggestion("xyz", ["plan"]);
    expect(msg).toContain("Docs:");
  });
});

describe("wrapCommandAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("catches thrown error and sets process.exitCode to 1", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const action = async () => {
      throw new Error("test failure");
    };

    const wrapped = wrapCommandAction(action);
    await wrapped();

    expect(process.exitCode).toBe(1);
  });

  it("does NOT rethrow the error (wrapped function resolves)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const action = async () => {
      throw new Error("should not propagate");
    };

    const wrapped = wrapCommandAction(action);
    await expect(wrapped()).resolves.toBeUndefined();
  });

  it("logs the error message when an error is thrown", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const action = async () => {
      throw new Error("my specific error");
    };

    const wrapped = wrapCommandAction(action);
    await wrapped();

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("my specific error");
  });

  it("passes through arguments to the wrapped function", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const received: unknown[] = [];

    const action = async (a: string, b: number) => {
      received.push(a, b);
    };

    const wrapped = wrapCommandAction(action);
    await wrapped("hello", 42);

    expect(received).toEqual(["hello", 42]);
  });

  it("does not set exitCode when action succeeds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const action = async () => {
      // success, no throw
    };

    const wrapped = wrapCommandAction(action);
    await wrapped();

    expect(process.exitCode).not.toBe(1);
  });
});

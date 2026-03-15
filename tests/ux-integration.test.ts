import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateBashCompletion,
  generateFishCompletion,
  generateZshCompletion,
} from "../src/lib/completions.js";
import { suggestCommand, wrapCommandAction } from "../src/lib/error-handler.js";
import { updateBanner } from "../src/lib/logger.js";
import { isCacheValid } from "../src/lib/update-checker.js";

describe("Shell completion integration", () => {
  it("bash completion output contains function definition and COMPREPLY", () => {
    const output = generateBashCompletion();
    expect(output).toContain("_kova_completions");
    expect(output).toContain("COMPREPLY");
  });

  it("zsh completion output contains compdef and _arguments", () => {
    const output = generateZshCompletion();
    expect(output).toContain("#compdef kova");
    expect(output).toContain("_arguments");
  });

  it("fish completion output contains complete -c kova and __fish_use_subcommand", () => {
    const output = generateFishCompletion();
    expect(output).toContain("complete -c kova");
    expect(output).toContain("__fish_use_subcommand");
  });
});

describe("Error suggestion integration", () => {
  const allCommands = [
    "init",
    "plan",
    "run",
    "build",
    "team-build",
    "status",
    "config",
    "update",
    "completions",
  ];

  it('suggests "plan" for typo "pln"', () => {
    expect(suggestCommand("pln", allCommands)).toBe("plan");
  });

  it('suggests "build" for typo "biuld"', () => {
    expect(suggestCommand("biuld", allCommands)).toBe("build");
  });

  it('suggests "run" for typo "rnnn"', () => {
    expect(suggestCommand("rnnn", allCommands)).toBe("run");
  });

  it('suggests "status" for typo "staus"', () => {
    expect(suggestCommand("staus", allCommands)).toBe("status");
  });

  it('returns null for "completley-wrong" (too far from any command)', () => {
    expect(suggestCommand("completley-wrong", allCommands)).toBeNull();
  });
});

describe("Cache validity integration", () => {
  it("isCacheValid returns true for a fresh cache (lastCheck = now)", () => {
    const cache = {
      lastCheck: new Date().toISOString(),
      latestVersion: "0.2.0",
    };
    expect(isCacheValid(cache)).toBe(true);
  });

  it("isCacheValid returns false for an expired cache (lastCheck = 25 hours ago)", () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const cache = {
      lastCheck: stale.toISOString(),
      latestVersion: "0.2.0",
    };
    expect(isCacheValid(cache)).toBe(false);
  });
});

describe("wrapCommandAction error logging integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("logs error message when wrapped action throws", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const action = async () => {
      throw new Error("integration test error");
    };

    const wrapped = wrapCommandAction(action);
    await wrapped();

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("integration test error");
  });
});

describe("logger.updateBanner integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs both current and latest version strings", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    updateBanner("0.1.0", "0.2.0");

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("0.1.0");
    expect(allOutput).toContain("0.2.0");
  });

  it("outputs the update available message", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    updateBanner("0.1.0", "0.2.0");

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("Update available");
  });

  it("outputs the npm install instruction", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    updateBanner("0.1.0", "0.2.0");

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("npm install");
  });
});

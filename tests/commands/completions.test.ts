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

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completionsCommand", () => {
  it("outputs bash completion script when shell=bash", async () => {
    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { completionsCommand } = await import(
      "../../src/commands/completions.js"
    );
    await completionsCommand("bash");
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    expect(combined).toContain("_kova_completions");
    expect(combined).toContain("COMPREPLY");
    expect(combined).toContain("complete -F _kova_completions kova");
  });

  it("outputs zsh completion script when shell=zsh", async () => {
    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { completionsCommand } = await import(
      "../../src/commands/completions.js"
    );
    await completionsCommand("zsh");
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    expect(combined).toContain("#compdef kova");
    expect(combined).toContain("_kova");
    expect(combined).toContain("_arguments");
  });

  it("outputs fish completion script when shell=fish", async () => {
    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { completionsCommand } = await import(
      "../../src/commands/completions.js"
    );
    await completionsCommand("fish");
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    expect(combined).toContain("complete -c kova");
    expect(combined).toContain("__fish_use_subcommand");
  });

  it("shows usage instructions when no shell argument provided", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { completionsCommand } = await import(
      "../../src/commands/completions.js"
    );
    await completionsCommand(undefined);

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("Usage");
    expect(infoCalls).toContain("bash");
    expect(infoCalls).toContain("zsh");
  });

  it("shows error and sets exit code for invalid shell argument", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { completionsCommand } = await import(
      "../../src/commands/completions.js"
    );
    const originalExitCode = process.exitCode;
    await completionsCommand("powershell");

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Unsupported shell");
    expect(errorCalls).toContain("powershell");
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });
});

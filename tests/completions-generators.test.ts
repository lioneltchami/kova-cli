import { describe, expect, it } from "vitest";
import {
  generateBashCompletion,
  generateFishCompletion,
  generateZshCompletion,
  getCommandRegistry,
} from "../src/lib/completions.js";

describe("generateBashCompletion", () => {
  it("includes all command names", () => {
    const script = generateBashCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      expect(script).toContain(cmd.name);
    }
  });

  it("includes _kova function definition", () => {
    const script = generateBashCompletion();
    expect(script).toContain("_kova");
  });

  it("includes flags for commands that have options", () => {
    const script = generateBashCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      for (const flag of cmd.options) {
        expect(script).toContain(flag);
      }
    }
  });

  it("includes complete -F directive to register completions", () => {
    const script = generateBashCompletion();
    expect(script).toContain("complete -F _kova_completions kova");
  });
});

describe("generateZshCompletion", () => {
  it("includes #compdef header", () => {
    const script = generateZshCompletion();
    expect(script).toContain("#compdef kova");
  });

  it("includes all command names", () => {
    const script = generateZshCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      expect(script).toContain(cmd.name);
    }
  });

  it("includes flags for commands that have options", () => {
    const script = generateZshCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      for (const flag of cmd.options) {
        expect(script).toContain(flag);
      }
    }
  });
});

describe("generateFishCompletion", () => {
  it("includes all command names", () => {
    const script = generateFishCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      expect(script).toContain(cmd.name);
    }
  });

  it("uses 'complete -c kova' format", () => {
    const script = generateFishCompletion();
    expect(script).toContain("complete -c kova");
  });

  it("includes flags for commands that have options", () => {
    const script = generateFishCompletion();
    const commands = getCommandRegistry();
    for (const cmd of commands) {
      for (const flag of cmd.options) {
        // Fish completions strip leading -- and use -l flag-name
        const flagName = flag.replace(/^--/, "");
        expect(script).toContain(`-l "${flagName}"`);
      }
    }
  });

  it("disables file completions with complete -c kova -f", () => {
    const script = generateFishCompletion();
    expect(script).toContain("complete -c kova -f");
  });
});

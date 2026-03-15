import { afterEach, describe, expect, it } from "vitest";
import { isInteractiveMode } from "../src/lib/interactive.js";

// Helper to set process.stdin.isTTY
function setTTY(value: boolean | undefined): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("isInteractiveMode", () => {
  afterEach(() => {
    // Restore isTTY to undefined (default non-TTY) after each test
    setTTY(undefined);
  });

  it("returns true when isTTY=true and no flags are set", () => {
    setTTY(true);
    expect(isInteractiveMode({})).toBe(true);
  });

  it("returns false when isTTY=false (piped or CI environment)", () => {
    setTTY(false);
    expect(isInteractiveMode({})).toBe(false);
  });

  it("returns false when isTTY=undefined", () => {
    setTTY(undefined);
    expect(isInteractiveMode({})).toBe(false);
  });

  it("returns false when force=true even if TTY", () => {
    setTTY(true);
    expect(isInteractiveMode({ force: true })).toBe(false);
  });

  it("returns false when merge=true even if TTY", () => {
    setTTY(true);
    expect(isInteractiveMode({ merge: true })).toBe(false);
  });

  it("returns false when dryRun=true even if TTY", () => {
    setTTY(true);
    expect(isInteractiveMode({ dryRun: true })).toBe(false);
  });

  it("returns false when noDetect=true even if TTY", () => {
    setTTY(true);
    expect(isInteractiveMode({ noDetect: true })).toBe(false);
  });

  it("returns false when preset is set even if TTY", () => {
    setTTY(true);
    expect(isInteractiveMode({ preset: "nextjs" })).toBe(false);
  });

  it("returns false when multiple flags are set", () => {
    setTTY(true);
    expect(isInteractiveMode({ force: true, merge: true })).toBe(false);
  });

  it("returns true when all flags are false/undefined and TTY is true", () => {
    setTTY(true);
    expect(
      isInteractiveMode({
        force: false,
        merge: false,
        dryRun: false,
        noDetect: false,
        preset: undefined,
      }),
    ).toBe(true);
  });
});

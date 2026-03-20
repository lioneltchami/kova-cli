import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSinceDate } from "../../src/lib/date-parser.js";

// Fix "now" to a known date so relative calculations are deterministic.
// 2026-03-19T12:00:00.000Z (noon UTC)
const FIXED_NOW = new Date("2026-03-19T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseSinceDate", () => {
  it("returns null for empty string", () => {
    expect(parseSinceDate("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(parseSinceDate("   ")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseSinceDate("invalid")).toBeNull();
  });

  it("returns null for garbage date string", () => {
    expect(parseSinceDate("not-a-date")).toBeNull();
  });

  it("parses '7d' as 7 days ago at midnight", () => {
    const result = parseSinceDate("7d");
    expect(result).not.toBeNull();
    const expected = new Date(FIXED_NOW);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - 7);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it("parses '30d' as 30 days ago at midnight", () => {
    const result = parseSinceDate("30d");
    expect(result).not.toBeNull();
    const expected = new Date(FIXED_NOW);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - 30);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it("parses '2w' as 14 days ago at midnight", () => {
    const result = parseSinceDate("2w");
    expect(result).not.toBeNull();
    const expected = new Date(FIXED_NOW);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - 14);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it("parses '1m' as 1 month ago at midnight", () => {
    const result = parseSinceDate("1m");
    expect(result).not.toBeNull();
    const expected = new Date(FIXED_NOW);
    expected.setHours(0, 0, 0, 0);
    expected.setMonth(expected.getMonth() - 1);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it("parses '1y' as 1 year ago at midnight", () => {
    const result = parseSinceDate("1y");
    expect(result).not.toBeNull();
    const expected = new Date(FIXED_NOW);
    expected.setHours(0, 0, 0, 0);
    expected.setFullYear(expected.getFullYear() - 1);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it("parses ISO date string '2026-01-15' correctly", () => {
    const result = parseSinceDate("2026-01-15");
    expect(result).not.toBeNull();
    expect(result!.toISOString().startsWith("2026-01-15")).toBe(true);
  });

  it("parses ISO datetime string '2026-01-15T14:30:00Z' correctly", () => {
    const result = parseSinceDate("2026-01-15T14:30:00Z");
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2026-01-15T14:30:00.000Z");
  });

  it("is case-insensitive for unit suffix ('7D' and '7d' are equivalent)", () => {
    const lower = parseSinceDate("7d");
    const upper = parseSinceDate("7D");
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(lower!.getTime()).toBe(upper!.getTime());
  });

  it("sets time to midnight (00:00:00.000) for relative inputs", () => {
    const result = parseSinceDate("3d");
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(0);
    expect(result!.getMinutes()).toBe(0);
    expect(result!.getSeconds()).toBe(0);
    expect(result!.getMilliseconds()).toBe(0);
  });
});

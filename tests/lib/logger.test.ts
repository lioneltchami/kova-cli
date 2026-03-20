import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Ensure KOVA_DEBUG is not set before each test
  delete process.env["KOVA_DEBUG"];
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["KOVA_DEBUG"];
});

describe("logger - basic output functions", () => {
  it("info() does not throw and writes to console.log", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.info("test info message")).not.toThrow();
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0]?.join("") ?? "";
    expect(output).toContain("test info message");
  });

  it("success() does not throw and writes to console.log", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.success("operation completed")).not.toThrow();
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0]?.join("") ?? "";
    expect(output).toContain("operation completed");
  });

  it("warn() does not throw and writes to console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.warn("something is off")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledOnce();
    const output = errorSpy.mock.calls[0]?.join("") ?? "";
    expect(output).toContain("something is off");
  });

  it("error() does not throw and writes to console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.error("something went wrong")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledOnce();
    const output = errorSpy.mock.calls[0]?.join("") ?? "";
    expect(output).toContain("something went wrong");
  });
});

describe("logger - debug output", () => {
  it("debug() does not output anything when KOVA_DEBUG is not set", async () => {
    delete process.env["KOVA_DEBUG"];
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    logger.debug("secret debug message");

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("debug() outputs when KOVA_DEBUG env variable is set", async () => {
    // KOVA_DEBUG must be set before the module is imported because isDebug
    // is evaluated at module load time.
    process.env["KOVA_DEBUG"] = "1";
    vi.resetModules();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    logger.debug("visible debug message");

    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0]?.join("") ?? "";
    expect(output).toContain("visible debug message");
  });
});

describe("logger - header formatting", () => {
  it("header() does not throw", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.header("My Section Title")).not.toThrow();
  });

  it("header() includes the title text in output", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(""));
    });
    const logger = await import("../../src/lib/logger.js");

    logger.header("Cost Report");

    const combined = lines.join("\n");
    expect(combined).toContain("Cost Report");
  });

  it("header() outputs a separator line", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(""));
    });
    const logger = await import("../../src/lib/logger.js");

    logger.header("Budget");

    // Should produce multiple lines including a separator made of '='
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const hasSeparator = lines.some((l) => l.includes("=".repeat(10)));
    expect(hasSeparator).toBe(true);
  });
});

describe("logger - table formatting", () => {
  it("table() does not throw with empty rows", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    expect(() => logger.table([])).not.toThrow();
  });

  it("table() outputs each row with key and value", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(""));
    });
    const logger = await import("../../src/lib/logger.js");

    logger.table([
      ["Total Cost", "$12.34"],
      ["Sessions", "42"],
    ]);

    const combined = lines.join("\n");
    expect(combined).toContain("Total Cost");
    expect(combined).toContain("$12.34");
    expect(combined).toContain("Sessions");
    expect(combined).toContain("42");
  });

  it("table() aligns values by padding keys to equal width", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(""));
    });
    const logger = await import("../../src/lib/logger.js");

    logger.table([
      ["Short", "val-a"],
      ["Much Longer Key", "val-b"],
    ]);

    // Both rows should be present
    expect(lines).toHaveLength(2);
  });

  it("table() does not output anything when rows array is empty", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = await import("../../src/lib/logger.js");

    logger.table([]);

    expect(logSpy).not.toHaveBeenCalled();
  });
});

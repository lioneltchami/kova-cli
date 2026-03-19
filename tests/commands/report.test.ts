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

function makeRecord(id: string, timestamp = "2026-03-15T10:00:00.000Z") {
  return {
    id,
    tool: "claude_code" as const,
    model: "sonnet" as const,
    session_id: "sess-1",
    project: "test-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.05,
    timestamp,
    duration_ms: null,
    metadata: {},
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-report-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function seedRecords(records: ReturnType<typeof makeRecord>[]) {
  const { appendRecords } = await import("../../src/lib/local-store.js");
  appendRecords(records);
}

describe("reportCommand", () => {
  it("shows 'no data found' message when no records", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({});

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("No usage data");
  });

  it("generates text report by default (no --format)", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({});
    writeSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Kova Cost Summary");
  });

  it("--format csv generates valid CSV output", async () => {
    await seedRecords([makeRecord("r1"), makeRecord("r2")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ format: "csv" });
    writeSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("date,tool,model,project");
    // CSV rows
    expect(combined).toContain("claude_code");
    expect(combined).toContain("sonnet");
  });

  it("--format json generates valid JSON", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ format: "json" });
    writeSpy.mockRestore();

    const combined = outputLines.join("\n");
    const parsed = JSON.parse(combined) as Record<string, unknown>;
    expect(parsed).toHaveProperty("total_cost_usd");
    expect(parsed).toHaveProperty("period");
  });

  it("--output writes report to file", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputFile = path.join(tmpDir, "report.txt");
    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ output: outputFile });

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, "utf-8");
    expect(content).toContain("Kova Cost Summary");
  });

  it("--output with csv writes CSV file", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputFile = path.join(tmpDir, "report.csv");
    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ format: "csv", output: outputFile });

    const content = fs.readFileSync(outputFile, "utf-8");
    expect(content).toContain("date,tool,model,project");
  });

  it("--month filters to specific month", async () => {
    await seedRecords([
      makeRecord("r1", "2026-01-15T10:00:00.000Z"),
      makeRecord("r2", "2026-03-15T10:00:00.000Z"),
    ]);

    const outputFile = path.join(tmpDir, "report-jan.json");
    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({
      format: "json",
      month: "2026-01",
      output: outputFile,
    });

    const content = fs.readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(content) as { total_cost_usd: number };
    // Only January record should be included (1 record at $0.05)
    expect(parsed.total_cost_usd).toBeCloseTo(0.05, 5);
  });

  it("shows error for invalid month format", async () => {
    await seedRecords([makeRecord("r1")]);

    const logger = await import("../../src/lib/logger.js");
    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ month: "March-2026" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid month");
  });

  it("shows success message when writing to file", async () => {
    await seedRecords([makeRecord("r1")]);
    const outputFile = path.join(tmpDir, "report.txt");
    const logger = await import("../../src/lib/logger.js");

    const { reportCommand } = await import("../../src/commands/report.js");
    await reportCommand({ output: outputFile });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("written");
  });
});

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
    session_id: `sess-${id}`,
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-audit-test-"));
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

describe("auditExportCommand", () => {
  it("exports local records as JSON to stdout when not logged in", async () => {
    await seedRecords([makeRecord("r1"), makeRecord("r2")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { auditExportCommand } = await import("../../src/commands/audit.js");
    await auditExportCommand({ format: "json" });
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    const parsed = JSON.parse(combined) as Array<{ id: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0]).toHaveProperty("id");
  });

  it("exports local records as CSV to stdout", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { auditExportCommand } = await import("../../src/commands/audit.js");
    await auditExportCommand({ format: "csv" });
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    // Should have CSV header
    expect(combined).toContain(
      "id,tool,model,session_id,project,input_tokens,output_tokens,cost_usd,timestamp,duration_ms",
    );
    // Should have data row with claude_code
    expect(combined).toContain("claude_code");
    expect(combined).toContain("sonnet");
  });

  it("writes JSON output to file when --output is specified", async () => {
    await seedRecords([makeRecord("r1"), makeRecord("r2")]);

    const outputFile = path.join(tmpDir, "audit-export.json");
    const logger = await import("../../src/lib/logger.js");

    const { auditExportCommand } = await import("../../src/commands/audit.js");
    await auditExportCommand({ format: "json", output: outputFile });

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(content) as Array<{ id: string }>;
    expect(parsed.length).toBe(2);

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("audit-export.json");
  });

  it("filters records by --since month", async () => {
    await seedRecords([
      makeRecord("r1", "2026-01-15T10:00:00.000Z"),
      makeRecord("r2", "2026-03-15T10:00:00.000Z"),
    ]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { auditExportCommand } = await import("../../src/commands/audit.js");
    // Only export from March 2026 onwards
    await auditExportCommand({ format: "json", since: "2026-03" });
    writeSpy.mockRestore();

    const parsed = JSON.parse(outputLines.join("")) as Array<{ id: string }>;
    expect(parsed.length).toBe(1);
    expect(parsed[0]?.id).toBe("r2");
  });

  it("shows error for invalid --since format", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { auditExportCommand } = await import("../../src/commands/audit.js");

    await auditExportCommand({ format: "json", since: "March-2026" });

    const errorCalls = vi.mocked(logger.error).mock.calls.flat().join(" ");
    expect(errorCalls).toContain("Invalid --since format");
  });

  it("shows 'no records found' message when database is empty", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { auditExportCommand } = await import("../../src/commands/audit.js");

    await auditExportCommand({ format: "json" });

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("No records found");
  });

  it("uses --local flag to bypass login and read local data", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { auditExportCommand } = await import("../../src/commands/audit.js");
    await auditExportCommand({ format: "json", local: true });
    writeSpy.mockRestore();

    const parsed = JSON.parse(outputLines.join("")) as Array<{ id: string }>;
    expect(parsed.length).toBe(1);
  });
});

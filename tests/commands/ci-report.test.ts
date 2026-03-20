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

function makeRecord(
  id: string,
  overrides: {
    timestamp?: string;
    tool?: "claude_code" | "cursor" | "copilot";
    model?: "sonnet" | "haiku" | "opus";
    session_id?: string;
    cost_usd?: number;
    input_tokens?: number;
    output_tokens?: number;
  } = {},
) {
  return {
    id,
    tool: overrides.tool ?? ("claude_code" as const),
    model: overrides.model ?? ("sonnet" as const),
    session_id: overrides.session_id ?? `sess-${id}`,
    project: "test-proj",
    input_tokens: overrides.input_tokens ?? 1000,
    output_tokens: overrides.output_tokens ?? 500,
    cost_usd: overrides.cost_usd ?? 0.05,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    duration_ms: null,
    metadata: {},
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-ci-report-test-"));
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

describe("ciReportCommand", () => {
  it("outputs valid JSON with required fields for --format json", async () => {
    await seedRecords([
      makeRecord("r1", { cost_usd: 10.0, session_id: "s1" }),
      makeRecord("r2", { cost_usd: 5.0, session_id: "s2", tool: "cursor" }),
    ]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "json", period: "7d" });
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    const parsed = JSON.parse(combined) as {
      period_cost_usd: number;
      by_tool: Array<{ tool: string; cost_usd: number; sessions: number }>;
      by_model: Array<{ model: string; cost_usd: number; requests: number }>;
      sessions: number;
      report_url: string;
    };

    expect(parsed).toHaveProperty("period_cost_usd");
    expect(parsed).toHaveProperty("by_tool");
    expect(parsed).toHaveProperty("by_model");
    expect(parsed).toHaveProperty("sessions");
    expect(parsed).toHaveProperty("report_url");
    expect(parsed.period_cost_usd).toBeCloseTo(15.0, 2);
    expect(parsed.sessions).toBe(2);
    expect(parsed.by_tool.length).toBe(2);
    expect(parsed.report_url).toBe("https://kova.dev/dashboard");
  });

  it("outputs table format with period cost and tool breakdown", async () => {
    await seedRecords([
      makeRecord("r1", {
        cost_usd: 7.5,
        session_id: "s1",
        tool: "claude_code",
      }),
      makeRecord("r2", { cost_usd: 2.5, session_id: "s2", tool: "copilot" }),
    ]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "table", period: "7d" });
    writeSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Kova CI Cost Report");
    expect(combined).toContain("$10.00");
    expect(combined).toContain("claude_code");
    expect(combined).toContain("copilot");
    expect(combined).toContain("kova.dev/dashboard");
  });

  it("returns empty/zero report when no data exists", async () => {
    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "json", period: "7d" });
    writeSpy.mockRestore();

    const combined = outputLines.join("");
    const parsed = JSON.parse(combined) as {
      period_cost_usd: number;
      sessions: number;
    };
    expect(parsed.period_cost_usd).toBe(0);
    expect(parsed.sessions).toBe(0);
  });

  it("aggregates sessions correctly across multiple records in same session", async () => {
    // 3 records in 2 sessions
    await seedRecords([
      makeRecord("r1", { cost_usd: 3.0, session_id: "sess-A" }),
      makeRecord("r2", { cost_usd: 3.0, session_id: "sess-A" }),
      makeRecord("r3", { cost_usd: 4.0, session_id: "sess-B" }),
    ]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "json" });
    writeSpy.mockRestore();

    const parsed = JSON.parse(outputLines.join("")) as {
      period_cost_usd: number;
      sessions: number;
    };
    expect(parsed.sessions).toBe(2);
    expect(parsed.period_cost_usd).toBeCloseTo(10.0, 2);
  });

  it("only includes records within the period", async () => {
    const recent = new Date().toISOString();
    const old = new Date();
    old.setDate(old.getDate() - 60);

    await seedRecords([
      makeRecord("r1", { cost_usd: 5.0, timestamp: recent, session_id: "s1" }),
      makeRecord("r2", {
        cost_usd: 999.0,
        timestamp: old.toISOString(),
        session_id: "s2",
      }),
    ]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "json", period: "7d" });
    writeSpy.mockRestore();

    const parsed = JSON.parse(outputLines.join("")) as {
      period_cost_usd: number;
    };
    // Should only include the recent record
    expect(parsed.period_cost_usd).toBeCloseTo(5.0, 2);
  });

  it("uses 30d period label in table output when period is 30d", async () => {
    await seedRecords([makeRecord("r1", { cost_usd: 1.0 })]);

    const outputLines: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((data) => {
        outputLines.push(String(data));
        return true;
      });

    const { ciReportCommand } = await import("../../src/commands/ci-report.js");
    await ciReportCommand({ format: "table", period: "30d" });
    writeSpy.mockRestore();

    const combined = outputLines.join("\n");
    expect(combined).toContain("Last 30 Days");
  });
});

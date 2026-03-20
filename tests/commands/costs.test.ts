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
    tool?: "claude_code" | "cursor";
    project?: string;
    cost_usd?: number;
  } = {},
) {
  return {
    id,
    tool: overrides.tool ?? ("claude_code" as const),
    model: "sonnet" as const,
    session_id: "sess-1",
    project: overrides.project ?? "test-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: overrides.cost_usd ?? 0.05,
    timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
    duration_ms: null,
    metadata: {},
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-costs-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// Seed the local store with test records
async function seedRecords(records: ReturnType<typeof makeRecord>[]) {
  const { appendRecords } = await import("../../src/lib/local-store.js");
  appendRecords(records);
}

// Capture console.log output
function captureConsoleLog(): { output: string[]; restore: () => void } {
  const output: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
    output.push(args.join(" "));
  });
  const writespy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((data) => {
      output.push(String(data));
      return true;
    });
  return {
    output,
    restore: () => {
      spy.mockRestore();
      writespy.mockRestore();
    },
  };
}

describe("costsCommand", () => {
  it("shows helpful message when no data found", async () => {
    // No records seeded
    const logger = await import("../../src/lib/logger.js");
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({});

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("kova track");
  });

  it("outputs JSON when --json flag is set", async () => {
    await seedRecords([
      makeRecord("r1", { timestamp: "2026-03-15T10:00:00.000Z" }),
    ]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({ json: true });
    cap.restore();

    const combined = cap.output.join("\n");
    // Should be valid JSON
    const parsed = JSON.parse(combined) as Record<string, unknown>;
    expect(parsed).toHaveProperty("total_cost_usd");
  });

  it("shows summary for all records by default (no date filter)", async () => {
    await seedRecords([
      makeRecord("r1", {
        cost_usd: 1.0,
        timestamp: "2026-01-01T10:00:00.000Z",
      }),
      makeRecord("r2", {
        cost_usd: 2.0,
        timestamp: "2026-03-15T10:00:00.000Z",
      }),
    ]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({});
    cap.restore();

    const combined = cap.output.join("\n");
    expect(combined).toContain("$3.00");
  });

  it("--today filters to today's records only", async () => {
    // Build today's timestamp using local date at local noon to avoid timezone
    // boundary issues (toISOString() gives UTC date which may differ from local date).
    const now = new Date();
    const localNoon = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
      0,
    );
    await seedRecords([
      makeRecord("r1", {
        cost_usd: 5.0,
        timestamp: "2026-01-01T10:00:00.000Z",
      }),
      makeRecord("r2", { cost_usd: 0.25, timestamp: localNoon.toISOString() }),
    ]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({ today: true });
    cap.restore();

    const combined = cap.output.join("\n");
    expect(combined).toContain("$0.25");
    // $5.00 should NOT appear - it's a different day
    expect(combined).not.toContain("$5.00");
  });

  it("--month with YYYY-MM value filters to specific month", async () => {
    await seedRecords([
      makeRecord("r1", {
        cost_usd: 10.0,
        timestamp: "2026-01-15T10:00:00.000Z",
      }),
      makeRecord("r2", {
        cost_usd: 5.0,
        timestamp: "2026-03-15T10:00:00.000Z",
      }),
    ]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({ month: "2026-01" });
    cap.restore();

    const combined = cap.output.join("\n");
    expect(combined).toContain("$10.00");
  });

  it("--json outputs valid JSON with total_cost_usd field", async () => {
    await seedRecords([makeRecord("r1", { cost_usd: 3.14 })]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({ json: true });
    cap.restore();

    const parsed = JSON.parse(cap.output.join("\n")) as Record<string, unknown>;
    expect(typeof parsed["total_cost_usd"]).toBe("number");
  });

  it("--tool filters to specific tool", async () => {
    await seedRecords([
      makeRecord("r1", { tool: "claude_code" }),
      makeRecord("r2", { tool: "cursor" }),
    ]);

    const { costsCommand } = await import("../../src/commands/costs.js");
    const cap = captureConsoleLog();
    await costsCommand({ tool: "cursor", json: true });
    cap.restore();

    const parsed = JSON.parse(cap.output.join("\n")) as {
      by_tool: Record<string, unknown>;
    };
    expect(parsed.by_tool).toHaveProperty("cursor");
    expect(parsed.by_tool).not.toHaveProperty("claude_code");
  });

  it("--project filters by project", async () => {
    await seedRecords([
      makeRecord("r1", { project: "proj-a", cost_usd: 10.0 }),
      makeRecord("r2", { project: "proj-b", cost_usd: 5.0 }),
    ]);

    const { costsCommand } = await import("../../src/commands/costs.js");
    const cap = captureConsoleLog();
    await costsCommand({ project: "proj-a", json: true });
    cap.restore();

    const parsed = JSON.parse(cap.output.join("\n")) as {
      total_cost_usd: number;
    };
    expect(parsed.total_cost_usd).toBeCloseTo(10.0, 5);
  });

  it("--detailed outputs additional comparison tables", async () => {
    await seedRecords([makeRecord("r1", { cost_usd: 1.0 })]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({ detailed: true });
    cap.restore();

    // detailed mode should include tool comparison output
    const combined = cap.output.join("\n");
    expect(combined.length).toBeGreaterThan(0);
  });

  it("shows budget status when budget is configured", async () => {
    // Set up a budget
    const { writeConfig, getDefaultConfig } =
      await import("../../src/lib/config-store.js");
    const config = getDefaultConfig();
    config.budget.monthly_usd = 100;
    writeConfig(config);

    await seedRecords([makeRecord("r1", { cost_usd: 25.0 })]);

    const cap = captureConsoleLog();
    const { costsCommand } = await import("../../src/commands/costs.js");
    await costsCommand({});
    cap.restore();

    // costsCommand should have produced output (cost summary + budget status)
    const combined = cap.output.join("\n");
    expect(combined.length).toBeGreaterThan(0);
  });

  it("--week filters to last 7 days", async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);
    const old = new Date();
    old.setDate(old.getDate() - 30);

    await seedRecords([
      makeRecord("r1", {
        cost_usd: 2.0,
        timestamp: recent.toISOString(),
      }),
      makeRecord("r2", {
        cost_usd: 100.0,
        timestamp: old.toISOString(),
      }),
    ]);

    const { costsCommand } = await import("../../src/commands/costs.js");
    const cap = captureConsoleLog();
    await costsCommand({ week: true, json: true });
    cap.restore();

    const parsed = JSON.parse(cap.output.join("\n")) as {
      total_cost_usd: number;
    };
    expect(parsed.total_cost_usd).toBeCloseTo(2.0, 5);
  });
});

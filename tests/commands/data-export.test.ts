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

function makeRecord(id: string) {
  return {
    id,
    tool: "claude_code" as const,
    model: "sonnet" as const,
    session_id: `sess-${id}`,
    project: "test-proj",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.05,
    timestamp: new Date().toISOString(),
    duration_ms: null,
    metadata: {},
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-dataexport-test-"));
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

describe("dataExportCommand", () => {
  it("exports JSON to specified output path", async () => {
    await seedRecords([makeRecord("r1"), makeRecord("r2")]);

    const outputFile = path.join(tmpDir, "my-export.json");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    expect(fs.existsSync(outputFile)).toBe(true);
    const raw = fs.readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    expect(parsed).toBeTruthy();
  });

  it("output JSON contains export_metadata and usage_records fields", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputFile = path.join(tmpDir, "export-fields.json");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    const raw = fs.readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(raw) as {
      export_metadata: { record_count: number; cli_version: string };
      usage_records: Array<{ id: string }>;
    };
    expect(parsed).toHaveProperty("export_metadata");
    expect(parsed).toHaveProperty("usage_records");
    expect(parsed.export_metadata).toHaveProperty("record_count", 1);
    expect(parsed.export_metadata).toHaveProperty("cli_version");
    expect(Array.isArray(parsed.usage_records)).toBe(true);
    expect(parsed.usage_records[0]).toHaveProperty("id", "r1");
  });

  it("produces empty usage_records array when database has no records", async () => {
    const outputFile = path.join(tmpDir, "empty-export.json");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    const raw = fs.readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(raw) as {
      usage_records: unknown[];
      export_metadata: { record_count: number };
    };
    expect(parsed.usage_records).toHaveLength(0);
    expect(parsed.export_metadata.record_count).toBe(0);
  });

  it("does not include api_key or credential fields in exported records", async () => {
    // Seed a record that has sensitive metadata
    const record = {
      ...makeRecord("r-sensitive"),
      metadata: {
        api_key: "sk-secret-12345",
        project_name: "my-project",
        token: "bearer-xyz",
      } as Record<string, string>,
    };
    await seedRecords([record]);

    const outputFile = path.join(tmpDir, "safe-export.json");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    const raw = fs.readFileSync(outputFile, "utf-8");
    // Verify raw JSON does not contain sensitive values
    expect(raw).not.toContain("sk-secret-12345");
    expect(raw).not.toContain("bearer-xyz");
    // Safe metadata should still be present
    expect(raw).toContain("project_name");
  });

  it("logs success message containing the output filename", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputFile = path.join(tmpDir, "success-export.json");
    const logger = await import("../../src/lib/logger.js");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
    expect(successCalls).toContain("success-export.json");
  });

  it("logs info message confirming no API keys are in the export", async () => {
    await seedRecords([makeRecord("r1")]);

    const outputFile = path.join(tmpDir, "nokey-export.json");
    const logger = await import("../../src/lib/logger.js");
    const { dataExportCommand } = await import(
      "../../src/commands/data-export.js"
    );
    await dataExportCommand({ output: outputFile });

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("no API keys");
  });
});

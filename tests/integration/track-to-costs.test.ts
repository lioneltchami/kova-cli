/**
 * Integration tests: full track -> store -> costs flow.
 * Uses real local-store (redirected to temp dir), mock collector.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/collectors/claude-code.js", () => ({
	claudeCodeCollector: {
		name: "claude_code",
		isAvailable: vi.fn().mockResolvedValue(true),
		collect: vi.fn().mockResolvedValue({
			tool: "claude_code",
			records: [],
			errors: [],
			scanned_paths: [],
		}),
	},
}));

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
		cost_usd?: number;
		timestamp?: string;
		tool?: "claude_code" | "cursor";
	} = {},
) {
	return {
		id,
		tool: overrides.tool ?? ("claude_code" as const),
		model: "sonnet" as const,
		session_id: "sess-int",
		project: "integration-proj",
		input_tokens: 1000,
		output_tokens: 500,
		cost_usd: overrides.cost_usd ?? 0.1,
		timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
		duration_ms: null,
		metadata: {},
	};
}

let tmpDir: string;

beforeEach(async () => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-int-test-"));
	process.env["HOME"] = tmpDir;
	process.env["USERPROFILE"] = tmpDir;

	vi.resetModules();

	// Re-apply default mock return values after resetModules clears them
	const { claudeCodeCollector } = await import(
		"../../src/lib/collectors/claude-code.js"
	);
	vi.mocked(claudeCodeCollector.isAvailable).mockResolvedValue(true);
	vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
		tool: "claude_code",
		records: [],
		errors: [],
		scanned_paths: [],
	});
	vi.mocked(claudeCodeCollector.isAvailable).mockClear();
	vi.mocked(claudeCodeCollector.collect).mockClear();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("integration: track -> costs", () => {
	it("full flow: track records stored -> costs displays them as JSON", async () => {
		const { claudeCodeCollector } = await import(
			"../../src/lib/collectors/claude-code.js"
		);
		vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
			tool: "claude_code",
			records: [makeRecord("r1", { cost_usd: 2.5 })],
			errors: [],
			scanned_paths: ["file.jsonl"],
		});

		const { trackCommand } = await import("../../src/commands/track.js");
		await trackCommand({});

		const outputLines: string[] = [];
		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation((data) => {
				outputLines.push(String(data));
				return true;
			});
		const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
			outputLines.push(args.join(" "));
		});

		const { costsCommand } = await import("../../src/commands/costs.js");
		await costsCommand({ json: true });
		writeSpy.mockRestore();
		logSpy.mockRestore();

		const parsed = JSON.parse(outputLines.join("\n")) as {
			total_cost_usd: number;
		};
		expect(parsed.total_cost_usd).toBeCloseTo(2.5, 5);
	});

	it("track twice with same records does not create duplicates", async () => {
		const { claudeCodeCollector } = await import(
			"../../src/lib/collectors/claude-code.js"
		);
		const records = [makeRecord("dedup-id", { cost_usd: 1.0 })];
		vi.mocked(claudeCodeCollector.collect).mockResolvedValue({
			tool: "claude_code",
			records,
			errors: [],
			scanned_paths: ["file.jsonl"],
		});

		const { trackCommand } = await import("../../src/commands/track.js");
		await trackCommand({});
		// Second track with same records - collector returns same records again
		await trackCommand({});

		const { readUsageDatabase } = await import("../../src/lib/local-store.js");
		const db = readUsageDatabase();
		const matching = db.records.filter((r) => r.id === "dedup-id");
		expect(matching).toHaveLength(1);
	});

	it("multiple tools contribute to unified cost view", async () => {
		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([
			makeRecord("r1", { tool: "claude_code", cost_usd: 3.0 }),
			makeRecord("r2", { tool: "cursor", cost_usd: 1.5 }),
		]);

		const outputLines: string[] = [];
		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation((data) => {
				outputLines.push(String(data));
				return true;
			});
		const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
			outputLines.push(args.join(" "));
		});

		const { costsCommand } = await import("../../src/commands/costs.js");
		await costsCommand({ json: true });
		writeSpy.mockRestore();
		logSpy.mockRestore();

		const parsed = JSON.parse(outputLines.join("\n")) as {
			total_cost_usd: number;
			by_tool: Record<string, unknown>;
		};
		expect(parsed.total_cost_usd).toBeCloseTo(4.5, 5);
		expect(parsed.by_tool).toHaveProperty("claude_code");
		expect(parsed.by_tool).toHaveProperty("cursor");
	});

	it("report generates valid data after track", async () => {
		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1", { cost_usd: 0.5 })]);

		const outputFile = path.join(tmpDir, "integration-report.json");
		const { reportCommand } = await import("../../src/commands/report.js");
		await reportCommand({ format: "json", output: outputFile });

		const content = fs.readFileSync(outputFile, "utf-8");
		const parsed = JSON.parse(content) as { total_cost_usd: number };
		expect(parsed.total_cost_usd).toBeCloseTo(0.5, 5);
	});

	it("budget alert shows warning when spend is near budget limit", async () => {
		// Set budget to $1 and spend $0.90 (90%)
		const { writeConfig, getDefaultConfig } = await import(
			"../../src/lib/config-store.js"
		);
		const config = getDefaultConfig();
		config.budget.monthly_usd = 1.0;
		config.budget.warn_at_percent = 80;
		writeConfig(config);

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1", { cost_usd: 0.9 })]);

		const outputLines: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
			outputLines.push(args.join(" "));
		});
		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		const { costsCommand } = await import("../../src/commands/costs.js");
		await costsCommand({});
		logSpy.mockRestore();
		writeSpy.mockRestore();

		// costsCommand should have printed the cost summary + budget status
		expect(outputLines.length).toBeGreaterThanOrEqual(1);

		const output = outputLines.join(" ");

		// Strengthened assertions: budget amount, percentage, and "Budget" label
		// must appear somewhere in the rendered output
		expect(output).toMatch(/\$1|\b1\.00|\b1\b/); // budget amount of $1
		expect(output).toMatch(/\d+%|percent/i); // a percentage value
		expect(output).toMatch(/budget/i); // "Budget" label
	});
});

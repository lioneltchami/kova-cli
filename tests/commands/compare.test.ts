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
		tool?: "claude_code" | "cursor" | "copilot" | "windsurf" | "devin";
		model?: "sonnet" | "haiku" | "opus" | "gpt-4o";
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
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-compare-test-"));
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

function captureConsoleLog(): { output: string[]; restore: () => void } {
	const output: string[] = [];
	const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
		output.push(args.join(" "));
	});
	return {
		output,
		restore: () => spy.mockRestore(),
	};
}

describe("compareCommand", () => {
	it("shows no data message when no records exist", async () => {
		const logger = await import("../../src/lib/logger.js");
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({});

		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("kova track");
	});

	it("groups by tool by default and sorts by cost descending", async () => {
		const now = new Date().toISOString();
		await seedRecords([
			makeRecord("r1", { tool: "claude_code", cost_usd: 45.0, timestamp: now }),
			makeRecord("r2", { tool: "cursor", cost_usd: 23.0, timestamp: now }),
			makeRecord("r3", { tool: "copilot", cost_usd: 10.0, timestamp: now }),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({});
		cap.restore();

		const combined = cap.output.join("\n");
		// Should show tool comparison header
		expect(combined).toContain("Tool Cost Comparison");
		// Should show all three tools
		expect(combined).toContain("claude_code");
		expect(combined).toContain("cursor");
		expect(combined).toContain("copilot");
		// Total cost should appear
		expect(combined).toContain("$78.00");
	});

	it("groups by model when --models flag is set", async () => {
		const now = new Date().toISOString();
		await seedRecords([
			makeRecord("r1", {
				model: "sonnet",
				cost_usd: 30.0,
				input_tokens: 5000,
				output_tokens: 2000,
				timestamp: now,
			}),
			makeRecord("r2", {
				model: "haiku",
				cost_usd: 5.0,
				input_tokens: 10000,
				output_tokens: 4000,
				timestamp: now,
			}),
			makeRecord("r3", {
				model: "opus",
				cost_usd: 60.0,
				input_tokens: 2000,
				output_tokens: 1000,
				timestamp: now,
			}),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({ models: true });
		cap.restore();

		const combined = cap.output.join("\n");
		// Should show model comparison header
		expect(combined).toContain("Model Cost Comparison");
		// Should show model names
		expect(combined).toContain("sonnet");
		expect(combined).toContain("haiku");
		expect(combined).toContain("opus");
	});

	it("filters by period - only includes records within the period", async () => {
		const recent = new Date().toISOString();
		const old = new Date();
		old.setDate(old.getDate() - 60);

		await seedRecords([
			makeRecord("r1", { cost_usd: 10.0, timestamp: recent }),
			makeRecord("r2", { cost_usd: 999.0, timestamp: old.toISOString() }),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		// Only look at last 30 days - the 60-day-old record should be excluded
		await compareCommand({ period: "30d" });
		cap.restore();

		const combined = cap.output.join("\n");
		// Should show $10.00 total but not $999.00
		expect(combined).toContain("$10.00");
		expect(combined).not.toContain("$999.00");
	});

	it("highlights most efficient tool in summary when multiple tools present", async () => {
		const now = new Date().toISOString();
		await seedRecords([
			// Claude: high cost, moderate tokens
			makeRecord("r1", {
				tool: "claude_code",
				cost_usd: 50.0,
				input_tokens: 100000,
				output_tokens: 50000,
				timestamp: now,
			}),
			// Copilot: low cost, many tokens -> most efficient
			makeRecord("r2", {
				tool: "copilot",
				cost_usd: 5.0,
				input_tokens: 500000,
				output_tokens: 200000,
				timestamp: now,
			}),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({});
		cap.restore();

		const combined = cap.output.join("\n");
		// Should mention most efficient in summary
		expect(combined).toContain("Most efficient");
		expect(combined).toContain("copilot");
	});

	it("calculates cost-per-session correctly for multiple sessions per tool", async () => {
		const now = new Date().toISOString();
		// Two different sessions for cursor, each costing $10
		await seedRecords([
			makeRecord("r1", {
				tool: "cursor",
				session_id: "sess-A",
				cost_usd: 10.0,
				timestamp: now,
			}),
			makeRecord("r2", {
				tool: "cursor",
				session_id: "sess-B",
				cost_usd: 10.0,
				timestamp: now,
			}),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({});
		cap.restore();

		const combined = cap.output.join("\n");
		// Total cost: $20 across 2 sessions = $10.00/session
		expect(combined).toContain("$20.00");
		expect(combined).toContain("$10.00"); // cost per session
	});

	it("shows correct total sessions count across all groups", async () => {
		const now = new Date().toISOString();
		await seedRecords([
			makeRecord("r1", {
				tool: "claude_code",
				session_id: "s1",
				cost_usd: 5.0,
				timestamp: now,
			}),
			makeRecord("r2", {
				tool: "cursor",
				session_id: "s2",
				cost_usd: 3.0,
				timestamp: now,
			}),
			makeRecord("r3", {
				tool: "copilot",
				session_id: "s3",
				cost_usd: 2.0,
				timestamp: now,
			}),
		]);

		const cap = captureConsoleLog();
		const { compareCommand } = await import("../../src/commands/compare.js");
		await compareCommand({});
		cap.restore();

		const combined = cap.output.join("\n");
		// 3 total sessions, total cost $10.00
		expect(combined).toContain("3 sessions");
		expect(combined).toContain("$10.00");
	});
});

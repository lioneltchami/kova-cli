/**
 * aider.test.ts
 *
 * Tests for the Aider collector. Uses temporary directories and mocks the
 * AIDER_SEARCH_ROOTS constant so the collector searches only our temp dir.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-aider-test-"));
	vi.resetModules();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
	vi.restoreAllMocks();
	vi.resetModules();
});

/**
 * Import the collector after mocking constants so AIDER_SEARCH_ROOTS
 * points exclusively to the temp directory.
 */
async function importCollector() {
	const capturedTmpDir = tmpDir;
	vi.doMock("../../src/lib/constants.js", () => ({
		VERSION: "0.4.0",
		KOVA_DATA_DIR: path.join(capturedTmpDir, ".kova"),
		USAGE_FILE: "usage.json",
		CONFIG_FILE: "config.json",
		DASHBOARD_API_URL: "https://kova.dev/api/v1",
		CLAUDE_CODE_DIR: path.join(capturedTmpDir, ".claude"),
		// Search roots point only to our temp dir to avoid picking up real system files.
		AIDER_SEARCH_ROOTS: [capturedTmpDir],
		AIDER_CHAT_HISTORY_NAMES: [".aider.chat.history.md"],
		AIDER_REPORTS_DIR: ".aider/reports",
		CONTINUE_SESSIONS_DIR: path.join(capturedTmpDir, ".continue", "sessions"),
		CLINE_STORAGE_PATHS: {},
		COPILOT_CHAT_PATHS: {},
		CURSOR_STATE_DB_PATHS: {},
		CURSOR_POOL_RATES: {
			cache_read: 0.25,
			input: 1.25,
			output: 6.0,
			cache_write: 1.25,
		},
		DEVIN_ACU_COST_CORE: 2.25,
		DEVIN_ACU_COST_TEAMS: 2.0,
		WINDSURF_CREDIT_RATE_PRO: 0.02,
		WINDSURF_CREDIT_RATE_TEAMS: 0.04,
		AMAZON_Q_TOKEN_COSTS: { input: 3.0, output: 15.0 },
		TOKEN_COSTS: {
			haiku: { input: 0.25, output: 1.25 },
			sonnet: { input: 3.0, output: 15.0 },
			opus: { input: 15.0, output: 75.0 },
			"gpt-4o": { input: 2.5, output: 10.0 },
			unknown: { input: 0, output: 0 },
		},
		colors: {},
	}));

	const { aiderCollector } = await import("../../src/lib/collectors/aider.js");
	return aiderCollector;
}

function writeReportFile(relPath: string, content: object | object[]): void {
	const full = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, JSON.stringify(content), "utf-8");
}

function writeChatHistory(content: string): void {
	const full = path.join(tmpDir, ".aider.chat.history.md");
	fs.writeFileSync(full, content, "utf-8");
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("AiderCollector - isAvailable", () => {
	it("returns false when no aider files exist", async () => {
		const collector = await importCollector();
		expect(await collector.isAvailable()).toBe(false);
	});

	it("returns true when chat history file exists in search root", async () => {
		writeChatHistory("#### USER: hello\nassistant: hi");
		const collector = await importCollector();
		expect(await collector.isAvailable()).toBe(true);
	});

	it("returns true when reports directory exists", async () => {
		fs.mkdirSync(path.join(tmpDir, ".aider", "reports"), { recursive: true });
		const collector = await importCollector();
		expect(await collector.isAvailable()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// collect - report file parsing
// ---------------------------------------------------------------------------

describe("AiderCollector - report file parsing", () => {
	it("parses a structured report JSON file with cost field", async () => {
		writeReportFile(".aider/reports/session1.json", {
			timestamp: "2026-03-15T10:00:00.000Z",
			model: "claude-sonnet-4-20250514",
			cost: 0.05,
			tokens: { input: 5000, output: 1000 },
		});

		const collector = await importCollector();
		const result = await collector.collect();

		expect(result.tool).toBe("aider");
		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.cost_usd).toBeCloseTo(0.05, 4);
		expect(result.records[0]?.model).toBe("sonnet");
		expect(result.records[0]?.input_tokens).toBe(5000);
		expect(result.records[0]?.output_tokens).toBe(1000);
	});

	it("parses an array of entries from a single report file", async () => {
		writeReportFile(".aider/reports/multi.json", [
			{
				timestamp: "2026-03-14T10:00:00.000Z",
				model: "claude-haiku-3-5",
				cost: 0.01,
				tokens: { input: 1000, output: 200 },
			},
			{
				timestamp: "2026-03-15T10:00:00.000Z",
				model: "gpt-4o",
				cost: 0.02,
				tokens: { input: 2000, output: 400 },
			},
		]);

		const collector = await importCollector();
		const result = await collector.collect();

		expect(result.records).toHaveLength(2);
		expect(result.records[0]?.model).toBe("haiku");
		expect(result.records[1]?.model).toBe("gpt-4o");
	});

	it("respects since parameter - skips older report entries", async () => {
		writeReportFile(".aider/reports/session.json", [
			{
				timestamp: "2026-01-01T00:00:00.000Z",
				model: "claude-sonnet-4-20250514",
				cost: 0.05,
				tokens: { input: 1000, output: 200 },
			},
			{
				timestamp: "2026-03-15T10:00:00.000Z",
				model: "claude-sonnet-4-20250514",
				cost: 0.08,
				tokens: { input: 2000, output: 400 },
			},
		]);

		const collector = await importCollector();
		const since = new Date("2026-02-01T00:00:00.000Z");
		const result = await collector.collect(since);

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.timestamp).toBe("2026-03-15T10:00:00.000Z");
	});

	it("handles corrupt report JSON gracefully - adds to errors", async () => {
		const reportDir = path.join(tmpDir, ".aider", "reports");
		fs.mkdirSync(reportDir, { recursive: true });
		fs.writeFileSync(
			path.join(reportDir, "bad.json"),
			"{not valid json}",
			"utf-8",
		);

		const collector = await importCollector();
		const result = await collector.collect();

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.records).toHaveLength(0);
	});

	it("ID is 16 hex characters", async () => {
		writeReportFile(".aider/reports/session.json", {
			timestamp: "2026-03-15T10:00:00.000Z",
			model: "claude-sonnet-4-20250514",
			cost: 0.05,
			tokens: { input: 1000, output: 200 },
		});

		const collector = await importCollector();
		const result = await collector.collect();

		expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
	});
});

// ---------------------------------------------------------------------------
// collect - chat history estimation fallback
// ---------------------------------------------------------------------------

describe("AiderCollector - chat history estimation", () => {
	it("estimates usage from chat history when no report files exist", async () => {
		writeChatHistory(
			"#### USER: Write me a function\nassistant: here you go\n" +
				"#### USER: Now add tests\nassistant: done\n",
		);

		const collector = await importCollector();
		const result = await collector.collect();

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.tool).toBe("aider");
		expect(result.records[0]?.input_tokens).toBeGreaterThan(0);
		expect(result.records[0]?.metadata?.["source"]).toBe(
			"chat_history_estimate",
		);
	});

	it("returns empty when chat history has no USER markers", async () => {
		writeChatHistory("just some text with no markers");
		const collector = await importCollector();
		const result = await collector.collect();
		expect(result.records).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// collect - result structure
// ---------------------------------------------------------------------------

describe("AiderCollector - result structure", () => {
	it("collector name is 'aider'", async () => {
		const collector = await importCollector();
		expect(collector.name).toBe("aider");
	});

	it("result tool field is 'aider'", async () => {
		const collector = await importCollector();
		const result = await collector.collect();
		expect(result.tool).toBe("aider");
	});

	it("returns empty results when no files exist", async () => {
		const collector = await importCollector();
		const result = await collector.collect();
		expect(result.records).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(result.scanned_paths).toHaveLength(0);
	});
});

/**
 * copilot.test.ts
 *
 * Tests for the Copilot collector. Mocks credential-manager, fs (for local
 * session file detection), and global.fetch for billing API calls.
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

let tmpDir: string;
let chatDir: string;
let chatSessionsDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-copilot-test-"));
	chatDir = path.join(tmpDir, "github.copilot-chat");
	chatSessionsDir = path.join(chatDir, "chatSessions");
	vi.clearAllMocks();
	mockFetch.mockReset();
	vi.resetModules();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
	vi.restoreAllMocks();
	vi.resetModules();
});

async function importCollector(
	pat: string | null = null,
	chatPathExists = false,
) {
	const capturedChatDir = chatPathExists
		? chatDir
		: path.join(tmpDir, "nonexistent");
	vi.doMock("../../src/lib/credential-manager.js", () => ({
		getToolKey: vi.fn((tool: string) => {
			if (tool === "copilot") return pat;
			return null;
		}),
		setToolKey: vi.fn(),
		removeToolKey: vi.fn(),
		listConfiguredTools: vi.fn(() => []),
	}));
	vi.doMock("../../src/lib/constants.js", () => ({
		VERSION: "0.3.0",
		KOVA_DATA_DIR: path.join(tmpDir, ".kova"),
		USAGE_FILE: "usage.json",
		CONFIG_FILE: "config.json",
		DASHBOARD_API_URL: "https://kova.dev/api/v1",
		CLAUDE_CODE_DIR: path.join(tmpDir, ".claude"),
		TOKEN_COSTS: {
			"gpt-4o": { input: 2.5, output: 10.0 },
			"gpt-4o-mini": { input: 0.15, output: 0.6 },
			"gpt-4.1": { input: 2.0, output: 8.0 },
			"gpt-5": { input: 1.25, output: 10.0 },
			o1: { input: 15.0, output: 60.0 },
			o3: { input: 10.0, output: 40.0 },
			sonnet: { input: 3.0, output: 15.0 },
			opus: { input: 15.0, output: 75.0 },
			haiku: { input: 0.25, output: 1.25 },
			unknown: { input: 0, output: 0 },
		},
		colors: {},
		CURSOR_STATE_DB_PATHS: {},
		COPILOT_CHAT_PATHS: {
			darwin: capturedChatDir,
			win32: capturedChatDir,
			linux: capturedChatDir,
		},
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
	}));
	return await import("../../src/lib/collectors/copilot.js");
}

function makeSession(overrides: {
	conversationId?: string;
	requests?: unknown[];
}) {
	return {
		conversationId: overrides.conversationId ?? "conv-abc-123",
		requests: overrides.requests ?? [],
	};
}

function makeRequest(
	overrides: {
		id?: string;
		model?: string;
		timestamp?: string | number;
		promptTokens?: number;
		completionTokens?: number;
		responseModel?: string;
	} = {},
) {
	return {
		id: overrides.id ?? "req-001",
		timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
		model: overrides.model ?? "gpt-4o",
		response: {
			model: overrides.responseModel ?? overrides.model ?? "gpt-4o",
			timestamp: overrides.timestamp ?? "2026-03-15T10:00:00.000Z",
			usage: {
				prompt_tokens: overrides.promptTokens ?? 500,
				completion_tokens: overrides.completionTokens ?? 200,
				total_tokens:
					(overrides.promptTokens ?? 500) + (overrides.completionTokens ?? 200),
			},
		},
	};
}

function writeSessionFile(sessionData: unknown, filename = "session-001.json") {
	fs.mkdirSync(chatSessionsDir, { recursive: true });
	fs.writeFileSync(
		path.join(chatSessionsDir, filename),
		JSON.stringify(sessionData),
		"utf-8",
	);
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("CopilotCollector - isAvailable", () => {
	it("returns true when a GitHub PAT is stored", async () => {
		const { copilotCollector } = await importCollector("ghp_testtoken");
		expect(await copilotCollector.isAvailable()).toBe(true);
	});

	it("returns true when local chat directory exists (no PAT)", async () => {
		fs.mkdirSync(chatDir, { recursive: true });
		const { copilotCollector } = await importCollector(null, true);
		expect(await copilotCollector.isAvailable()).toBe(true);
	});

	it("returns false when no PAT and no local directory", async () => {
		const { copilotCollector } = await importCollector(null, false);
		expect(await copilotCollector.isAvailable()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// collect - local session files
// ---------------------------------------------------------------------------

describe("CopilotCollector - local session parsing", () => {
	it("parses local session JSON files with usage data", async () => {
		const session = makeSession({
			requests: [makeRequest({ promptTokens: 300, completionTokens: 150 })],
		});
		writeSessionFile(session);

		const { copilotCollector } = await importCollector(null, true);
		const result = await copilotCollector.collect();

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.tool).toBe("copilot");
		expect(result.records[0]?.input_tokens).toBe(300);
		expect(result.records[0]?.output_tokens).toBe(150);
	});

	it("extracts prompt_tokens and completion_tokens correctly", async () => {
		const session = makeSession({
			requests: [makeRequest({ promptTokens: 1000, completionTokens: 400 })],
		});
		writeSessionFile(session);

		const { copilotCollector } = await importCollector(null, true);
		const result = await copilotCollector.collect();

		expect(result.records[0]?.input_tokens).toBe(1000);
		expect(result.records[0]?.output_tokens).toBe(400);
	});

	it("handles missing usage field in sessions by skipping gracefully", async () => {
		const session = makeSession({
			requests: [
				{
					id: "req-no-usage",
					model: "gpt-4o",
					response: { model: "gpt-4o" }, // no usage field
				},
			],
		});
		writeSessionFile(session);

		const { copilotCollector } = await importCollector(null, true);
		const result = await copilotCollector.collect();

		expect(result.records).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	it("handles invalid JSON in session files by adding an error and skipping file", async () => {
		fs.mkdirSync(chatSessionsDir, { recursive: true });
		fs.writeFileSync(
			path.join(chatSessionsDir, "bad-session.json"),
			"{invalid json content",
			"utf-8",
		);

		const { copilotCollector } = await importCollector(null, true);
		const result = await copilotCollector.collect();

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("JSON parse error");
	});

	it("generates deterministic IDs for same session data", async () => {
		const session = makeSession({
			conversationId: "fixed-conv-id",
			requests: [
				makeRequest({
					id: "fixed-req-id",
					timestamp: "2026-03-15T10:00:00.000Z",
				}),
			],
		});
		writeSessionFile(session);

		const timestamp = "2026-03-15T10:00:00.000Z";
		const expectedId = crypto
			.createHash("sha256")
			.update(`copilot:fixed-conv-id:fixed-req-id:${timestamp}`)
			.digest("hex")
			.slice(0, 16);

		const { copilotCollector } = await importCollector(null, true);
		const result = await copilotCollector.collect();

		expect(result.records[0]?.id).toBe(expectedId);
	});

	it("respects since parameter by filtering old sessions", async () => {
		const oldReq = makeRequest({ timestamp: "2026-01-01T00:00:00.000Z" });
		const newReq = makeRequest({
			id: "req-new",
			timestamp: "2026-03-15T10:00:00.000Z",
		});
		const session = makeSession({ requests: [oldReq, newReq] });
		writeSessionFile(session);

		const { copilotCollector } = await importCollector(null, true);
		const since = new Date("2026-02-01T00:00:00.000Z");
		const result = await copilotCollector.collect(since);

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.timestamp).toBe("2026-03-15T10:00:00.000Z");
	});
});

// ---------------------------------------------------------------------------
// collect - model name mapping
// ---------------------------------------------------------------------------

describe("CopilotCollector - model name mapping", () => {
	async function collectWithModel(modelName: string) {
		vi.resetModules();
		const session = makeSession({
			requests: [makeRequest({ model: modelName, responseModel: modelName })],
		});
		writeSessionFile(session);
		const { copilotCollector } = await importCollector(null, true);
		return copilotCollector.collect();
	}

	it("maps 'default' model to gpt-4o", async () => {
		const result = await collectWithModel("default");
		expect(result.records[0]?.model).toBe("gpt-4o");
	});

	it("maps gpt-4o-mini to gpt-4o-mini", async () => {
		const result = await collectWithModel("gpt-4o-mini");
		expect(result.records[0]?.model).toBe("gpt-4o-mini");
	});

	it("maps o1 to o1", async () => {
		const result = await collectWithModel("o1");
		expect(result.records[0]?.model).toBe("o1");
	});

	it("maps o3 to o3", async () => {
		const result = await collectWithModel("o3");
		expect(result.records[0]?.model).toBe("o3");
	});
});

// ---------------------------------------------------------------------------
// collect - billing API
// ---------------------------------------------------------------------------

describe("CopilotCollector - billing API", () => {
	it("calls billing API when PAT is available", async () => {
		// Mock /user endpoint to return login
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ login: "testuser" }),
		});
		// Mock billing endpoint
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ usageItems: [] }),
		});

		const { copilotCollector } = await importCollector("ghp_testtoken");
		await copilotCollector.collect();

		expect(mockFetch).toHaveBeenCalledTimes(2);
		const billingCall = mockFetch.mock.calls[1];
		expect(billingCall?.[0]).toContain("testuser");
		expect(billingCall?.[0]).toContain("billing/premium_request/usage");
	});

	it("handles billing API 403 by adding error about scope", async () => {
		// Mock /user endpoint
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ login: "testuser" }),
		});
		// Mock billing 403
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 403,
		});

		const { copilotCollector } = await importCollector("ghp_testtoken");
		const result = await copilotCollector.collect();

		expect(result.errors.length).toBeGreaterThan(0);
		const errMsg = result.errors.join(" ");
		expect(errMsg).toMatch(/403|scope|billing/i);
	});

	it("parses billing API usageItems into records", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ login: "testuser" }),
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				usageItems: [
					{
						model: "gpt-4o",
						pricePerUnit: 0.04,
						grossQuantity: 5,
						netAmount: 0.2,
						date: "2026-03-15",
					},
				],
			}),
		});

		const { copilotCollector } = await importCollector("ghp_testtoken");
		const result = await copilotCollector.collect();

		const billingRecord = result.records.find(
			(r) => r.metadata?.source === "billing_api",
		);
		expect(billingRecord).toBeDefined();
		expect(billingRecord?.cost_usd).toBeCloseTo(0.2, 4);
		expect(billingRecord?.model).toBe("gpt-4o");
	});
});

describe("CopilotCollector - result structure", () => {
	it("result tool field is always 'copilot'", async () => {
		const { copilotCollector } = await importCollector(null, false);
		const result = await copilotCollector.collect();
		expect(result.tool).toBe("copilot");
	});
});

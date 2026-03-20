/**
 * windsurf.test.ts
 *
 * Tests for the Windsurf collector. Mocks credential-manager and global.fetch.
 */
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
	vi.clearAllMocks();
	mockFetch.mockReset();
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

async function importCollector(serviceKey: string | null = null) {
	vi.doMock("../../src/lib/credential-manager.js", () => ({
		getToolKey: vi.fn((tool: string) => {
			if (tool === "windsurf") return serviceKey;
			return null;
		}),
		setToolKey: vi.fn(),
		removeToolKey: vi.fn(),
		listConfiguredTools: vi.fn(() => []),
	}));
	vi.doMock("../../src/lib/constants.js", () => ({
		VERSION: "0.3.0",
		KOVA_DATA_DIR: "/tmp/.kova",
		USAGE_FILE: "usage.json",
		CONFIG_FILE: "config.json",
		DASHBOARD_API_URL: "https://kova.dev/api/v1",
		CLAUDE_CODE_DIR: "/tmp/.claude",
		TOKEN_COSTS: {},
		colors: {},
		CURSOR_STATE_DB_PATHS: {},
		COPILOT_CHAT_PATHS: {},
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
	return await import("../../src/lib/collectors/windsurf.js");
}

function makeCascadeRun(
	overrides: {
		day?: string;
		model?: string;
		mode?: string;
		messagesSent?: number;
		promptsUsed?: number;
	} = {},
) {
	return {
		day: overrides.day ?? "2026-03-15",
		model: overrides.model ?? "swe-1.5",
		mode: overrides.mode ?? "agent",
		messagesSent: overrides.messagesSent ?? 10,
		promptsUsed: overrides.promptsUsed ?? 200, // 200 cents = 2 credits
	};
}

function mockWindsurfSuccess(runs: unknown[]) {
	mockFetch.mockResolvedValueOnce({
		ok: true,
		status: 200,
		json: async () => ({
			queryResults: [{ cascadeRuns: runs }],
		}),
	});
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("WindsurfCollector - isAvailable", () => {
	it("returns false when no service key is stored", async () => {
		const { windsurfCollector } = await importCollector(null);
		expect(await windsurfCollector.isAvailable()).toBe(false);
	});

	it("returns true when service key is stored", async () => {
		const { windsurfCollector } = await importCollector("ws-service-key-xyz");
		expect(await windsurfCollector.isAvailable()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// collect - API request
// ---------------------------------------------------------------------------

describe("WindsurfCollector - API request", () => {
	it("posts to CascadeAnalytics endpoint with correct body", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ queryResults: [{ cascadeRuns: [] }] }),
		});

		const { windsurfCollector } = await importCollector("ws-service-key");
		await windsurfCollector.collect();

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://server.codeium.com/api/v1/CascadeAnalytics");
		expect(init.method).toBe("POST");

		const body = JSON.parse(init.body as string);
		expect(body.service_key).toBe("ws-service-key");
		expect(body.query_requests).toEqual([{ cascade_runs: {} }]);
		expect(body.start_timestamp).toBeDefined();
		expect(body.end_timestamp).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// collect - parsing cascade runs
// ---------------------------------------------------------------------------

describe("WindsurfCollector - parsing cascade runs", () => {
	it("parses cascade runs and produces records", async () => {
		mockWindsurfSuccess([makeCascadeRun()]);

		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.tool).toBe("windsurf");
		expect(result.records[0]?.input_tokens).toBe(0);
		expect(result.records[0]?.output_tokens).toBe(0);
	});

	it("converts promptsUsed cents to credits to USD correctly", async () => {
		// promptsUsed = 400 cents = 4 credits, * WINDSURF_CREDIT_RATE_TEAMS (0.04) = $0.16
		mockWindsurfSuccess([makeCascadeRun({ promptsUsed: 400 })]);

		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();

		expect(result.records[0]?.cost_usd).toBeCloseTo(0.16, 4);
	});

	it("sets input and output tokens to 0 (credit-based model)", async () => {
		mockWindsurfSuccess([makeCascadeRun()]);

		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();

		expect(result.records[0]?.input_tokens).toBe(0);
		expect(result.records[0]?.output_tokens).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// collect - model name mapping
// ---------------------------------------------------------------------------

describe("WindsurfCollector - model name mapping", () => {
	async function collectWithModel(modelName: string) {
		vi.resetModules();
		mockWindsurfSuccess([makeCascadeRun({ model: modelName })]);
		const { windsurfCollector } = await importCollector("ws-service-key");
		return windsurfCollector.collect();
	}

	it("maps swe-1 model to swe-1.5", async () => {
		const result = await collectWithModel("swe-1.5");
		expect(result.records[0]?.model).toBe("swe-1.5");
	});

	it("maps sonnet model to sonnet", async () => {
		const result = await collectWithModel("claude-sonnet-3.7");
		expect(result.records[0]?.model).toBe("sonnet");
	});

	it("maps gemini-flash to gemini-flash", async () => {
		const result = await collectWithModel("gemini-flash");
		expect(result.records[0]?.model).toBe("gemini-flash");
	});
});

// ---------------------------------------------------------------------------
// collect - deterministic IDs
// ---------------------------------------------------------------------------

describe("WindsurfCollector - deterministic IDs", () => {
	it("generates deterministic IDs (same input produces same ID)", async () => {
		const run = makeCascadeRun({
			day: "2026-03-15",
			model: "swe-1.5",
			mode: "agent",
			messagesSent: 10,
			promptsUsed: 200,
		});

		const expectedId = crypto
			.createHash("sha256")
			.update(`windsurf:2026-03-15:swe-1.5:agent:10:200`)
			.digest("hex")
			.slice(0, 16);

		mockWindsurfSuccess([run]);
		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();

		expect(result.records[0]?.id).toBe(expectedId);
	});

	it("ID is 16 hex characters", async () => {
		mockWindsurfSuccess([makeCascadeRun()]);
		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();
		expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
	});

	it("different promptsUsed produces different IDs (collision prevention)", async () => {
		// Same day/model/mode/messagesSent but different promptsUsed must yield distinct IDs
		const run1 = makeCascadeRun({
			day: "2026-03-15",
			model: "swe-1.5",
			mode: "agent",
			messagesSent: 10,
			promptsUsed: 100,
		});
		const run2 = makeCascadeRun({
			day: "2026-03-15",
			model: "swe-1.5",
			mode: "agent",
			messagesSent: 10,
			promptsUsed: 200,
		});

		mockWindsurfSuccess([run1, run2]);
		const { windsurfCollector } = await importCollector("ws-service-key");
		const result = await windsurfCollector.collect();

		expect(result.records).toHaveLength(2);
		expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
	});
});

// ---------------------------------------------------------------------------
// collect - error handling
// ---------------------------------------------------------------------------

describe("WindsurfCollector - error handling", () => {
	it("handles 401 invalid key by adding error message", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
		});

		const { windsurfCollector } = await importCollector("bad-key");
		const result = await windsurfCollector.collect();

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("401");
		expect(result.records).toHaveLength(0);
	});

	it("returns empty records when no service key is configured", async () => {
		const { windsurfCollector } = await importCollector(null);
		const result = await windsurfCollector.collect();

		expect(result.records).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("result tool field is always 'windsurf'", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ queryResults: [{ cascadeRuns: [] }] }),
		});

		const { windsurfCollector } = await importCollector("ws-key");
		const result = await windsurfCollector.collect();
		expect(result.tool).toBe("windsurf");
	});
});

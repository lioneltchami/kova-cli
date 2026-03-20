/**
 * devin.test.ts
 *
 * Tests for the Devin collector. Mocks credential-manager and global.fetch.
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

async function importCollector(apiKey: string | null = null) {
	vi.doMock("../../src/lib/credential-manager.js", () => ({
		getToolKey: vi.fn((tool: string) => {
			if (tool === "devin") return apiKey;
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
	return await import("../../src/lib/collectors/devin.js");
}

// Devin API returns unix timestamps for 'date'
function makeConsumptionEntry(
	overrides: {
		date?: number;
		acus?: number;
		acusByProduct?: { devin?: number; cascade?: number; terminal?: number };
	} = {},
) {
	return {
		date:
			overrides.date ??
			Math.floor(new Date("2026-03-15T00:00:00.000Z").getTime() / 1000),
		acus: overrides.acus ?? 5,
		acus_by_product: overrides.acusByProduct ?? {
			devin: 3,
			cascade: 1,
			terminal: 1,
		},
	};
}

function mockDevinSuccess(entries: unknown[]) {
	mockFetch.mockResolvedValueOnce({
		ok: true,
		status: 200,
		json: async () => ({
			total_acus: entries.reduce(
				(sum: number, e: unknown) => sum + ((e as { acus: number }).acus ?? 0),
				0,
			),
			consumption_by_date: entries,
		}),
	});
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("DevinCollector - isAvailable", () => {
	it("returns false when no API key is stored", async () => {
		const { devinCollector } = await importCollector(null);
		expect(await devinCollector.isAvailable()).toBe(false);
	});

	it("returns true when API key is stored", async () => {
		const { devinCollector } = await importCollector("cog_test_key_123");
		expect(await devinCollector.isAvailable()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// collect - API request
// ---------------------------------------------------------------------------

describe("DevinCollector - API request", () => {
	it("calls consumption/daily endpoint with correct params", async () => {
		mockDevinSuccess([]);

		const { devinCollector } = await importCollector("cog_test_key");
		await devinCollector.collect();

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("api.devin.ai/v3/enterprise/consumption/daily");
		expect(url).toContain("time_after=");
		expect(url).toContain("time_before=");
		expect((init.headers as Record<string, string>)["Authorization"]).toBe(
			"Bearer cog_test_key",
		);
	});
});

// ---------------------------------------------------------------------------
// collect - parsing consumption data
// ---------------------------------------------------------------------------

describe("DevinCollector - parsing consumption data", () => {
	it("converts ACUs to USD using DEVIN_ACU_COST_TEAMS (2.0)", async () => {
		// 5 ACUs * $2.00 = $10.00
		mockDevinSuccess([makeConsumptionEntry({ acus: 5 })]);

		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records[0]?.cost_usd).toBeCloseTo(10.0, 4);
	});

	it("generates per-day records from consumption_by_date", async () => {
		const date1 = Math.floor(
			new Date("2026-03-14T00:00:00.000Z").getTime() / 1000,
		);
		const date2 = Math.floor(
			new Date("2026-03-15T00:00:00.000Z").getTime() / 1000,
		);
		mockDevinSuccess([
			makeConsumptionEntry({ date: date1, acus: 3 }),
			makeConsumptionEntry({ date: date2, acus: 7 }),
		]);

		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records).toHaveLength(2);
		expect(result.records[0]?.cost_usd).toBeCloseTo(6.0, 4);
		expect(result.records[1]?.cost_usd).toBeCloseTo(14.0, 4);
	});

	it("includes product breakdown in metadata", async () => {
		mockDevinSuccess([
			makeConsumptionEntry({
				acusByProduct: { devin: 3, cascade: 1, terminal: 1 },
			}),
		]);

		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records[0]?.metadata?.products).toBeDefined();
		const products = JSON.parse(result.records[0]?.metadata?.products ?? "{}");
		expect(products.devin).toBe(3);
		expect(products.cascade).toBe(1);
		expect(products.terminal).toBe(1);
	});

	it("sets model to 'unknown' (Devin does not expose underlying LLM)", async () => {
		mockDevinSuccess([makeConsumptionEntry()]);

		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records[0]?.model).toBe("unknown");
	});

	it("sets input and output tokens to 0 (ACU-based model)", async () => {
		mockDevinSuccess([makeConsumptionEntry()]);

		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records[0]?.input_tokens).toBe(0);
		expect(result.records[0]?.output_tokens).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// collect - deterministic IDs
// ---------------------------------------------------------------------------

describe("DevinCollector - deterministic IDs", () => {
	it("generates deterministic IDs (same input produces same ID)", async () => {
		const unixTs = Math.floor(
			new Date("2026-03-15T00:00:00.000Z").getTime() / 1000,
		);
		const acus = 5;
		const acusByProduct = { devin: 3, cascade: 1, terminal: 1 };
		const dateIso = new Date(unixTs * 1000).toISOString();

		const expectedId = crypto
			.createHash("sha256")
			.update(`devin:${dateIso}:${acus}:${JSON.stringify(acusByProduct)}`)
			.digest("hex")
			.slice(0, 16);

		mockDevinSuccess([makeConsumptionEntry({ date: unixTs, acus })]);
		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records[0]?.id).toBe(expectedId);
	});

	it("ID is 16 hex characters", async () => {
		mockDevinSuccess([makeConsumptionEntry()]);
		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();
		expect(result.records[0]?.id).toMatch(/^[0-9a-f]{16}$/);
	});

	it("different acusByProduct produces different IDs (collision prevention)", async () => {
		const unixTs = Math.floor(
			new Date("2026-03-15T00:00:00.000Z").getTime() / 1000,
		);
		// Same date and acus but different product breakdowns must yield distinct IDs
		const entry1 = makeConsumptionEntry({
			date: unixTs,
			acus: 5,
			acusByProduct: { devin: 5, cascade: 0, terminal: 0 },
		});
		const entry2 = makeConsumptionEntry({
			date: unixTs,
			acus: 5,
			acusByProduct: { devin: 3, cascade: 1, terminal: 1 },
		});

		mockDevinSuccess([entry1, entry2]);
		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();

		expect(result.records).toHaveLength(2);
		expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
	});
});

// ---------------------------------------------------------------------------
// collect - error handling
// ---------------------------------------------------------------------------

describe("DevinCollector - error handling", () => {
	it("handles 401 response by adding error message without throwing", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
		});

		const { devinCollector } = await importCollector("bad-key");
		const result = await devinCollector.collect();

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("401");
		expect(result.records).toHaveLength(0);
	});

	it("returns empty records when no API key is configured", async () => {
		const { devinCollector } = await importCollector(null);
		const result = await devinCollector.collect();

		expect(result.records).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("result tool field is always 'devin'", async () => {
		mockDevinSuccess([]);
		const { devinCollector } = await importCollector("cog_test_key");
		const result = await devinCollector.collect();
		expect(result.tool).toBe("devin");
	});
});

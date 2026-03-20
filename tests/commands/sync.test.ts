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

function makeRecord(id: string, cost_usd = 0.05) {
	return {
		id,
		tool: "claude_code" as const,
		model: "sonnet" as const,
		session_id: "sess-1",
		project: "test-proj",
		input_tokens: 1000,
		output_tokens: 500,
		cost_usd,
		timestamp: "2026-03-15T10:00:00.000Z",
		duration_ms: null,
		metadata: {},
	};
}

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sync-test-"));
	process.env["HOME"] = tmpDir;
	process.env["USERPROFILE"] = tmpDir;
	vi.clearAllMocks();
	vi.resetModules();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("syncCommand", () => {
	it("requires login - shows message when not logged in", async () => {
		// No credentials stored
		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("login");
	});

	it("shows message when no records to sync", async () => {
		// Store credentials to pass login check
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("track");
	});

	it("--dry-run shows count without uploading", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1"), makeRecord("r2")]);

		const mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({ dryRun: true });

		// Should NOT call fetch in dry run mode
		expect(mockFetch).not.toHaveBeenCalled();

		// Should log "Dry run"
		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("Dry run");
	});

	it("uploads records and shows success on 200", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1", 0.25)]);

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 201,
				json: vi
					.fn()
					.mockResolvedValue({ accepted: 1, duplicates: 0, errors: 0 }),
			}),
		);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
		expect(successCalls).toContain("Synced");
	});

	it("shows warning when upload fails", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1")]);

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 500 }),
		);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		const warnCalls = vi.mocked(logger.warn).mock.calls.flat().join(" ");
		expect(warnCalls).toContain("failed");
	});

	it("free plan user sees upgrade message and sync does not upload", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "free",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1")]);

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({ plan: "free", active: true }),
		});
		vi.stubGlobal("fetch", mockFetch);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		// Should show upgrade message
		const warnCalls = vi.mocked(logger.warn).mock.calls.flat().join(" ");
		expect(warnCalls).toContain("Kova Pro subscription");

		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("kova.dev/pricing");

		// Upload endpoint should NOT have been called (subscription check fetch is
		// the only call, and it should have returned before the upload)
		const uploadCalls = mockFetch.mock.calls.filter(
			([url]: [string]) => url && String(url).includes("/usage"),
		);
		expect(uploadCalls).toHaveLength(0);
	});

	it("pro plan user (cached) skips live check and proceeds", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1", 0.1)]);

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: vi
				.fn()
				.mockResolvedValue({ accepted: 1, duplicates: 0, errors: 0 }),
		});
		vi.stubGlobal("fetch", mockFetch);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		// Pro user -- no subscription check fetch, goes straight to upload
		// The subscription endpoint should NOT have been called
		const subscriptionCalls = mockFetch.mock.calls.filter(
			([url]: [string]) => url && String(url).includes("subscription"),
		);
		expect(subscriptionCalls).toHaveLength(0);

		// Upload should have succeeded
		const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
		expect(successCalls).toContain("Synced");
	});

	it("network error on checkSubscription still allows sync to proceed", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "free",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([makeRecord("r1", 0.1)]);

		// First call (subscription check) throws, second call (upload) succeeds
		const mockFetch = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValue({
				ok: true,
				status: 201,
				json: vi
					.fn()
					.mockResolvedValue({ accepted: 1, duplicates: 0, errors: 0 }),
			});
		vi.stubGlobal("fetch", mockFetch);

		const logger = await import("../../src/lib/logger.js");
		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({});

		// Should not have blocked -- upload proceeds
		const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
		expect(successCalls).toContain("Synced");
	});

	it("--since filters records before uploading", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { appendRecords } = await import("../../src/lib/local-store.js");
		appendRecords([
			{
				...makeRecord("r1"),
				timestamp: "2026-01-01T10:00:00.000Z",
			},
			{
				...makeRecord("r2"),
				timestamp: "2026-03-15T10:00:00.000Z",
			},
		]);

		const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal("fetch", mockFetch);

		const { syncCommand } = await import("../../src/commands/sync.js");
		await syncCommand({ since: "2026-03-01" });

		// Should have been called (records after since date exist)
		expect(mockFetch).toHaveBeenCalledOnce();
		const body = JSON.parse(
			(mockFetch.mock.calls[0] as [string, RequestInit])[1]?.body as string,
		) as { records: unknown[] };
		// Only the March record should be included
		expect(body.records).toHaveLength(1);
	});
});

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkSubscription,
	getCredentialsPath,
	isLoggedIn,
	readCredentials,
	removeCredentials,
	storeCredentials,
} from "../src/lib/dashboard.js";
import type { DashboardCredentials } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "kova-dash-test-"));
}

function makeCreds(
	overrides: Partial<DashboardCredentials> = {},
): DashboardCredentials {
	return {
		apiKey: "kova_testapikey12345",
		dashboardUrl: "https://kova.dev",
		userId: "user-123",
		email: "test@example.com",
		plan: "pro",
		cachedAt: new Date().toISOString(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// getCredentialsPath
// ---------------------------------------------------------------------------

describe("getCredentialsPath", () => {
	it("contains '.kova' in the path", () => {
		expect(getCredentialsPath()).toContain(".kova");
	});

	it("contains 'credentials.json' in the path", () => {
		expect(getCredentialsPath()).toContain("credentials.json");
	});

	it("is under the user home directory", () => {
		expect(getCredentialsPath().startsWith(os.homedir())).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// storeCredentials / readCredentials / removeCredentials / isLoggedIn
// ---------------------------------------------------------------------------

describe("storeCredentials + readCredentials", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = makeTempDir();
		// Override HOME so the module writes to the temp dir
		process.env["HOME"] = tmpDir;
		process.env["USERPROFILE"] = tmpDir; // Windows
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("roundtrips credentials correctly", () => {
		const creds = makeCreds();
		storeCredentials(creds);
		const read = readCredentials();
		expect(read).not.toBeNull();
		expect(read?.apiKey).toBe(creds.apiKey);
		expect(read?.email).toBe(creds.email);
		expect(read?.plan).toBe(creds.plan);
		expect(read?.userId).toBe(creds.userId);
		expect(read?.dashboardUrl).toBe(creds.dashboardUrl);
	});

	it("preserves all DashboardCredentials fields", () => {
		const creds = makeCreds({ plan: "enterprise", email: "boss@corp.com" });
		storeCredentials(creds);
		const read = readCredentials();
		expect(read?.plan).toBe("enterprise");
		expect(read?.email).toBe("boss@corp.com");
		expect(read?.cachedAt).toBe(creds.cachedAt);
	});

	it("storeCredentials creates the .kova directory if it does not exist", () => {
		const credPath = getCredentialsPath();
		const dir = path.dirname(credPath);
		// Ensure directory doesn't pre-exist
		if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
		storeCredentials(makeCreds());
		expect(fs.existsSync(credPath)).toBe(true);
	});
});

describe("readCredentials", () => {
	beforeEach(() => {
		const tmpDir = makeTempDir();
		process.env["HOME"] = tmpDir;
		process.env["USERPROFILE"] = tmpDir;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null when the credentials file does not exist", () => {
		// Fresh temp home -- no credentials written
		expect(readCredentials()).toBeNull();
	});
});

describe("removeCredentials", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = makeTempDir();
		process.env["HOME"] = tmpDir;
		process.env["USERPROFILE"] = tmpDir;
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("deletes the credentials file", () => {
		storeCredentials(makeCreds());
		const credPath = getCredentialsPath();
		expect(fs.existsSync(credPath)).toBe(true);
		removeCredentials();
		expect(fs.existsSync(credPath)).toBe(false);
	});

	it("does not throw when file does not exist", () => {
		expect(() => removeCredentials()).not.toThrow();
	});
});

describe("isLoggedIn", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = makeTempDir();
		process.env["HOME"] = tmpDir;
		process.env["USERPROFILE"] = tmpDir;
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns false when no credentials exist", () => {
		expect(isLoggedIn()).toBe(false);
	});

	it("returns true after credentials are stored", () => {
		storeCredentials(makeCreds());
		expect(isLoggedIn()).toBe(true);
	});

	it("returns false after credentials are removed", () => {
		storeCredentials(makeCreds());
		removeCredentials();
		expect(isLoggedIn()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// checkSubscription
// ---------------------------------------------------------------------------

describe("checkSubscription", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = makeTempDir();
		process.env["HOME"] = tmpDir;
		process.env["USERPROFILE"] = tmpDir;
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("returns null when no credentials exist", async () => {
		const result = await checkSubscription();
		expect(result).toBeNull();
	});

	it("returns null when fetch throws a network error", async () => {
		storeCredentials(makeCreds());
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("connection refused")),
		);
		const result = await checkSubscription();
		expect(result).toBeNull();
	});

	it("returns null when fetch responds with a non-ok status", async () => {
		storeCredentials(makeCreds());
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
		);
		const result = await checkSubscription();
		expect(result).toBeNull();
	});

	it("returns plan data when fetch succeeds", async () => {
		storeCredentials(makeCreds());
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ plan: "pro", active: true }),
			}),
		);
		const result = await checkSubscription();
		expect(result).not.toBeNull();
		expect(result?.plan).toBe("pro");
		expect(result?.active).toBe(true);
	});

	it("sends Authorization Bearer header to subscription endpoint", async () => {
		const creds = makeCreds({
			apiKey: "kova_mykey",
			dashboardUrl: "https://kova.dev",
		});
		storeCredentials(creds);
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ plan: "free", active: false }),
		});
		vi.stubGlobal("fetch", mockFetch);

		await checkSubscription();

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://kova.dev/api/v1/subscription");
		const headers = init.headers as Record<string, string>;
		expect(headers["Authorization"]).toBe("Bearer kova_mykey");
	});
});

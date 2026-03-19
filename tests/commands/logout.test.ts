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

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-logout-test-"));
	process.env["HOME"] = tmpDir;
	process.env["USERPROFILE"] = tmpDir;
	vi.clearAllMocks();
	vi.resetModules();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

describe("logoutCommand", () => {
	it("removes credentials and shows success when logged in", async () => {
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
		const { logoutCommand } = await import("../../src/commands/logout.js");
		await logoutCommand();

		const successCalls = vi.mocked(logger.success).mock.calls.flat().join(" ");
		expect(successCalls).toContain("Logged out");

		// Credentials should be gone
		const { readCredentials } = await import("../../src/lib/dashboard.js");
		expect(readCredentials()).toBeNull();
	});

	it("shows 'Not logged in' when not logged in", async () => {
		// No credentials stored
		const logger = await import("../../src/lib/logger.js");
		const { logoutCommand } = await import("../../src/commands/logout.js");
		await logoutCommand();

		const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
		expect(infoCalls).toContain("Not logged in");
	});

	it("calls removeCredentials when logged in", async () => {
		const { storeCredentials } = await import("../../src/lib/dashboard.js");
		storeCredentials({
			apiKey: "kova_testkey",
			dashboardUrl: "https://kova.dev",
			userId: "user-1",
			email: "test@example.com",
			plan: "pro",
			cachedAt: new Date().toISOString(),
		});

		const { logoutCommand } = await import("../../src/commands/logout.js");
		await logoutCommand();

		const { isLoggedIn } = await import("../../src/lib/dashboard.js");
		expect(isLoggedIn()).toBe(false);
	});

	it("does not call removeCredentials when not logged in", async () => {
		const logger = await import("../../src/lib/logger.js");
		const { logoutCommand } = await import("../../src/commands/logout.js");
		await logoutCommand();

		// success should NOT have been called
		expect(vi.mocked(logger.success)).not.toHaveBeenCalled();
	});
});

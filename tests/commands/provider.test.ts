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
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-provider-test-"));
	process.env["HOME"] = tmpDir;
	process.env["USERPROFILE"] = tmpDir;
	vi.clearAllMocks();
	vi.resetModules();
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("providerCommand", () => {
	it("lists no providers when none configured", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("list", undefined);

		expect(loggerMod.warn).toHaveBeenCalledWith(
			expect.stringContaining("No AI providers configured"),
		);
	});

	it("lists configured providers", async () => {
		// Set up a provider key in the credentials file
		const kovaDir = path.join(tmpDir, ".kova");
		fs.mkdirSync(kovaDir, { recursive: true });
		fs.writeFileSync(
			path.join(kovaDir, "provider-keys.json"),
			JSON.stringify({ anthropic: "sk-ant-test-key-12345678" }),
			"utf-8",
		);

		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("list", undefined);

		expect(loggerMod.header).toHaveBeenCalledWith("Configured Providers");
	});

	it("errors on invalid provider name for add", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("add", "invalid-provider");

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid provider"),
		);
	});

	it("errors when add is called without a name", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("add", undefined);

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Usage: kova provider add"),
		);
	});

	it("errors on unknown action", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("invalid-action", undefined);

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Unknown action"),
		);
	});

	it("errors when remove is called without a name", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("remove", undefined);

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Usage: kova provider remove"),
		);
	});

	it("removes a configured provider", async () => {
		const kovaDir = path.join(tmpDir, ".kova");
		fs.mkdirSync(kovaDir, { recursive: true });
		fs.writeFileSync(
			path.join(kovaDir, "provider-keys.json"),
			JSON.stringify({ anthropic: "sk-ant-test-key-12345678" }),
			"utf-8",
		);

		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("remove", "anthropic");

		expect(loggerMod.success).toHaveBeenCalledWith(
			expect.stringContaining("anthropic removed"),
		);
	});

	it("warns when removing a non-configured provider", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("remove", "anthropic");

		expect(loggerMod.warn).toHaveBeenCalledWith(
			expect.stringContaining("is not configured"),
		);
	});

	it("errors when test is called without a name", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("test", undefined);

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Usage: kova provider test"),
		);
	});

	it("errors when testing an invalid provider", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand("test", "invalid-provider");

		expect(loggerMod.error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid provider"),
		);
	});

	it("defaults to list when no action is given", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { providerCommand } = await import("../../src/commands/provider.js");

		await providerCommand(undefined, undefined);

		// Should call list, which will warn about no providers
		expect(loggerMod.warn).toHaveBeenCalledWith(
			expect.stringContaining("No AI providers configured"),
		);
	});
});

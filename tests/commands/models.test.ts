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
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-models-test-"));
	process.env["HOME"] = tmpDir;
	process.env["USERPROFILE"] = tmpDir;
	vi.clearAllMocks();
	vi.resetModules();
	consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	consoleSpy.mockRestore();
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("modelsCommand", () => {
	it("outputs the Available Models header", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		expect(loggerMod.header).toHaveBeenCalledWith("Available Models");
	});

	it("outputs the Current Routing header", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		expect(loggerMod.header).toHaveBeenCalledWith("Current Routing");
	});

	it("outputs routing info for simple, moderate, complex", async () => {
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("simple");
		expect(allOutput).toContain("moderate");
		expect(allOutput).toContain("complex");
	});

	it("warns when no providers are configured", async () => {
		const loggerMod = await import("../../src/lib/logger.js");
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		expect(loggerMod.warn).toHaveBeenCalledWith(
			expect.stringContaining("No providers configured"),
		);
	});

	it("shows model names from MODEL_TIERS", async () => {
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		// Should contain at least haiku and sonnet from MODEL_TIERS
		expect(allOutput).toContain("haiku");
		expect(allOutput).toContain("sonnet");
	});

	it("shows provider availability status", async () => {
		const { modelsCommand } = await import("../../src/commands/models.js");

		modelsCommand();

		const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
		// With no providers configured, should show "No key" status
		expect(allOutput).toContain("No key");
	});
});

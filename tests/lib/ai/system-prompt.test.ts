import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../../src/lib/ai/system-prompt.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-prompt-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe("buildSystemPrompt", () => {
	it("includes the project name from directory basename", () => {
		const prompt = buildSystemPrompt(tmpDir);
		const dirName = path.basename(tmpDir);
		expect(prompt).toContain(dirName);
	});

	it("includes the working directory path", () => {
		const prompt = buildSystemPrompt(tmpDir);
		expect(prompt).toContain(tmpDir);
	});

	it("reads package.json and includes project info when present", () => {
		const pkg = {
			name: "my-cool-app",
			description: "A cool application",
			dependencies: {
				express: "^4.18.0",
				zod: "^3.22.0",
				typescript: "^5.0.0",
			},
		};
		fs.writeFileSync(
			path.join(tmpDir, "package.json"),
			JSON.stringify(pkg),
			"utf-8",
		);
		const prompt = buildSystemPrompt(tmpDir);
		expect(prompt).toContain("my-cool-app");
		expect(prompt).toContain("A cool application");
		expect(prompt).toContain("express");
		expect(prompt).toContain("zod");
	});

	it("handles missing package.json gracefully", () => {
		// No package.json written - should not throw
		const prompt = buildSystemPrompt(tmpDir);
		expect(prompt).toBeDefined();
		expect(prompt.length).toBeGreaterThan(0);
		// Should not contain "Project:" tech context line
		expect(prompt).not.toContain("Dependencies:");
	});

	it("handles corrupted package.json gracefully", () => {
		fs.writeFileSync(
			path.join(tmpDir, "package.json"),
			"not valid json {{{",
			"utf-8",
		);
		// Should not throw
		const prompt = buildSystemPrompt(tmpDir);
		expect(prompt).toBeDefined();
		expect(prompt.length).toBeGreaterThan(0);
	});

	it("includes coding instructions", () => {
		const prompt = buildSystemPrompt(tmpDir);
		expect(prompt).toContain("expert software engineer");
		expect(prompt).toContain("read a file before editing");
	});

	it("limits dependencies to 15", () => {
		const deps: Record<string, string> = {};
		for (let i = 0; i < 20; i++) {
			deps[`dep-${i}`] = "^1.0.0";
		}
		const pkg = { name: "big-app", dependencies: deps };
		fs.writeFileSync(
			path.join(tmpDir, "package.json"),
			JSON.stringify(pkg),
			"utf-8",
		);
		const prompt = buildSystemPrompt(tmpDir);
		// Should contain dep-0 through dep-14 but not dep-15
		expect(prompt).toContain("dep-0");
		expect(prompt).not.toContain("dep-15");
	});
});

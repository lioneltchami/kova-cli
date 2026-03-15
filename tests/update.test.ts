import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyUpdates, checkForUpdates } from "../src/commands/update.js";
import { TEMPLATE_FILES } from "../src/lib/constants.js";
import { getTemplatesDir, scaffoldProject } from "../src/lib/scaffold.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-update-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("checkForUpdates", () => {
	it("returns all unchanged on a freshly scaffolded project", async () => {
		await scaffoldProject(tmpDir, {});
		const result = checkForUpdates(tmpDir);
		expect(result.missing).toHaveLength(0);
		expect(result.updated).toHaveLength(0);
		// Every template file that exists in the package should be in unchanged
		expect(result.unchanged.length).toBeGreaterThan(0);
	});

	it("detects a missing file when one template file is deleted", async () => {
		await scaffoldProject(tmpDir, {});
		// Delete the first template file
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		fs.rmSync(destPath);
		const result = checkForUpdates(tmpDir);
		expect(result.missing).toContain(firstFile);
	});

	it("detects a changed file when a template file is modified", async () => {
		await scaffoldProject(tmpDir, {});
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		// Modify the file content so hash differs from package template
		fs.writeFileSync(destPath, "LOCALLY MODIFIED CONTENT", "utf-8");
		const result = checkForUpdates(tmpDir);
		expect(result.updated).toContain(firstFile);
	});

	it("does not crash when .claude/ directory does not exist", () => {
		// Create a temp dir with no .claude/ inside
		const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-empty-"));
		try {
			// Should not throw - missing files will be reported, not crash
			expect(() => checkForUpdates(emptyDir)).not.toThrow();
		} finally {
			fs.rmSync(emptyDir, { recursive: true, force: true });
		}
	});
});

describe("applyUpdates", () => {
	it("adds missing files when they are listed in result.missing", async () => {
		await scaffoldProject(tmpDir, {});
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		// Delete the file to make it missing
		fs.rmSync(destPath);

		const result = checkForUpdates(tmpDir);
		expect(result.missing).toContain(firstFile);

		const { applied } = applyUpdates(tmpDir, result, false);
		expect(applied).toContain(firstFile);
		// File should exist again
		expect(fs.existsSync(destPath)).toBe(true);
	});

	it("skips changed files without force (reports them in skippedLocal)", async () => {
		await scaffoldProject(tmpDir, {});
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		const customContent = "MY LOCAL MODIFICATIONS";
		fs.writeFileSync(destPath, customContent, "utf-8");

		const result = checkForUpdates(tmpDir);
		const { skippedLocal, applied } = applyUpdates(tmpDir, result, false);

		expect(skippedLocal).toContain(firstFile);
		expect(applied).not.toContain(firstFile);
		// Content should remain unchanged
		expect(fs.readFileSync(destPath, "utf-8")).toBe(customContent);
	});

	it("overwrites changed files when force=true", async () => {
		await scaffoldProject(tmpDir, {});
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		fs.writeFileSync(destPath, "MY LOCAL MODIFICATIONS", "utf-8");

		const result = checkForUpdates(tmpDir);
		const { applied, skippedLocal } = applyUpdates(tmpDir, result, true);

		expect(applied).toContain(firstFile);
		expect(skippedLocal).not.toContain(firstFile);
	});

	it("file content matches package template after applyUpdates with force=true", async () => {
		await scaffoldProject(tmpDir, {});
		const firstFile = TEMPLATE_FILES[0]!;
		const destPath = path.join(tmpDir, ".claude", firstFile);
		fs.writeFileSync(destPath, "CORRUPTED", "utf-8");

		const result = checkForUpdates(tmpDir);
		applyUpdates(tmpDir, result, true);

		// Read from the package templates dir for comparison
		const templatesDir = getTemplatesDir();
		const srcPath = path.join(templatesDir, firstFile);
		const expectedContent = fs.readFileSync(srcPath, "utf-8");
		const actualContent = fs.readFileSync(destPath, "utf-8");
		expect(actualContent).toBe(expectedContent);
	});
});

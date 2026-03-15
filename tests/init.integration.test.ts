import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateConfig, loadConfig, saveConfig } from "../src/lib/config.js";
import { KOVA_CONFIG_FILE, TEMPLATE_FILES } from "../src/lib/constants.js";
import { detectProject } from "../src/lib/detect.js";
import { scaffoldProject } from "../src/lib/scaffold.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-init-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Writes a full Next.js + TypeScript + Supabase + Stripe package.json
function writeNextJsProject(dir: string): void {
	const pkg = {
		name: "my-next-app",
		scripts: {
			dev: "next dev",
			build: "next build",
			test: "vitest run",
			lint: "eslint .",
			typecheck: "tsc --noEmit",
		},
		dependencies: {
			next: "14.0.0",
			react: "18.0.0",
			"@supabase/supabase-js": "2.0.0",
			stripe: "14.0.0",
		},
	};
	fs.writeFileSync(
		path.join(dir, "package.json"),
		JSON.stringify(pkg),
		"utf-8",
	);
	fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}", "utf-8");
	fs.writeFileSync(path.join(dir, "package-lock.json"), "{}", "utf-8");
}

describe("init integration", () => {
	it("creates .claude/ directory with all template files in a fresh project", async () => {
		writeNextJsProject(tmpDir);

		const detected = await detectProject(tmpDir);
		const files = await scaffoldProject(tmpDir, {});
		const config = generateConfig(detected);
		await saveConfig(tmpDir, config);

		// .claude/ directory exists
		expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);

		// All template files were created
		for (const templateFile of TEMPLATE_FILES) {
			const dest = path.join(tmpDir, ".claude", templateFile);
			expect(fs.existsSync(dest), `Expected ${templateFile} to exist`).toBe(
				true,
			);
		}

		// .claude/tasks/ directory exists
		expect(fs.existsSync(path.join(tmpDir, ".claude", "tasks"))).toBe(true);

		// kova.yaml config was written
		expect(fs.existsSync(path.join(tmpDir, KOVA_CONFIG_FILE))).toBe(true);

		// scaffoldProject returned the right number of relative paths
		expect(files.length).toBe(TEMPLATE_FILES.length);
	});

	it("detects Next.js + TypeScript + Supabase + Stripe correctly", async () => {
		writeNextJsProject(tmpDir);

		const detected = await detectProject(tmpDir);

		expect(detected.language).toBe("TypeScript");
		expect(detected.framework).toBe("Next.js");
		expect(detected.packageManager).toBe("npm");
		expect(detected.database).toBe("Supabase");
		expect(detected.payments).toBe("Stripe");
		expect(detected.commands.dev).toBe("next dev");
		expect(detected.commands.build).toBe("next build");
		expect(detected.commands.test).toBe("vitest run");
		expect(detected.commands.lint).toBe("eslint .");
		expect(detected.commands.typecheck).toBe("tsc --noEmit");
	});

	it("generates kova.yaml with correct values from detection", async () => {
		writeNextJsProject(tmpDir);

		const detected = await detectProject(tmpDir);
		const config = generateConfig(detected);
		await saveConfig(tmpDir, config);

		const loaded = await loadConfig(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded!.project.language).toBe("TypeScript");
		expect(loaded!.project.framework).toBe("Next.js");
		expect(loaded!.project.package_manager).toBe("npm");
		expect(loaded!.quality.test).toBe("vitest run");
		expect(loaded!.quality.lint).toBe("eslint .");
		expect(loaded!.quality.build).toBe("next build");
		expect(loaded!.quality.typecheck).toBe("tsc --noEmit");
	});

	it("handles --force overwrite correctly", async () => {
		writeNextJsProject(tmpDir);

		// First init
		await scaffoldProject(tmpDir, {});

		// Corrupt one file to prove force overwrites it
		const firstTemplate = TEMPLATE_FILES[0]!;
		const targetPath = path.join(tmpDir, ".claude", firstTemplate);
		fs.writeFileSync(targetPath, "CORRUPTED", "utf-8");

		// Second init with force -- should not throw
		const secondFiles = await scaffoldProject(tmpDir, { force: true });

		// All template files returned
		expect(secondFiles.length).toBe(TEMPLATE_FILES.length);

		// The corrupted file was overwritten (content is no longer "CORRUPTED")
		const content = fs.readFileSync(targetPath, "utf-8");
		expect(content).not.toBe("CORRUPTED");
	});

	it("handles --merge correctly", async () => {
		writeNextJsProject(tmpDir);

		// First init
		await scaffoldProject(tmpDir, {});

		// Write a custom file inside .claude/ (not part of TEMPLATE_FILES)
		const customFile = path.join(tmpDir, ".claude", "my-custom-notes.md");
		fs.writeFileSync(customFile, "MY CUSTOM CONTENT", "utf-8");

		// Mark one template file with custom content to verify merge skips it
		const firstTemplate = TEMPLATE_FILES[0]!;
		const existingTemplatePath = path.join(tmpDir, ".claude", firstTemplate);
		fs.writeFileSync(existingTemplatePath, "PRESERVED_CONTENT", "utf-8");

		// Second init with merge -- should not throw
		const mergedFiles = await scaffoldProject(tmpDir, { merge: true });

		// The first template was skipped (already existed), so it should NOT be in the returned list
		const normalizedMerged = mergedFiles.map((f) => f.replace(/\\/g, "/"));
		expect(normalizedMerged).not.toContain(`.claude/${firstTemplate}`);

		// The preserved content is intact (merge did not overwrite)
		const preservedContent = fs.readFileSync(existingTemplatePath, "utf-8");
		expect(preservedContent).toBe("PRESERVED_CONTENT");

		// The custom file outside TEMPLATE_FILES is untouched
		expect(fs.existsSync(customFile)).toBe(true);
		expect(fs.readFileSync(customFile, "utf-8")).toBe("MY CUSTOM CONTENT");
	});
});

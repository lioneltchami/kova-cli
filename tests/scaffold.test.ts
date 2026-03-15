import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEMPLATE_FILES } from "../src/lib/constants.js";
import { scaffoldProject } from "../src/lib/scaffold.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("scaffoldProject", () => {
  it("creates .claude directory with all template files", async () => {
    await scaffoldProject(tmpDir, {});
    const claudeDir = path.join(tmpDir, ".claude");
    expect(fs.existsSync(claudeDir)).toBe(true);
    for (const templateFile of TEMPLATE_FILES) {
      const filePath = path.join(claudeDir, templateFile);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("creates .claude/tasks directory", async () => {
    await scaffoldProject(tmpDir, {});
    const tasksDir = path.join(tmpDir, ".claude", "tasks");
    expect(fs.existsSync(tasksDir)).toBe(true);
    expect(fs.statSync(tasksDir).isDirectory()).toBe(true);
  });

  it("returns list of created file paths", async () => {
    const created = await scaffoldProject(tmpDir, {});
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(TEMPLATE_FILES.length);
    // Paths should be relative to projectDir
    for (const filePath of created) {
      expect(path.isAbsolute(filePath)).toBe(false);
      expect(filePath.startsWith(".claude")).toBe(true);
    }
  });

  it("throws when .claude exists without force or merge", async () => {
    // Create .claude first
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    await expect(scaffoldProject(tmpDir, {})).rejects.toThrow(
      ".claude/ already exists",
    );
  });

  it("overwrites files when force is true", async () => {
    // First scaffold
    await scaffoldProject(tmpDir, {});
    // Write a marker into one of the files
    const firstFile = TEMPLATE_FILES[0];
    if (firstFile) {
      const filePath = path.join(tmpDir, ".claude", firstFile);
      fs.writeFileSync(filePath, "OVERWRITE_ME", "utf-8");
      // Scaffold again with force
      await scaffoldProject(tmpDir, { force: true });
      // The file should have been overwritten (content is no longer the marker)
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toBe("OVERWRITE_ME");
    }
  });

  it("skips existing files when merge is true", async () => {
    // First scaffold
    await scaffoldProject(tmpDir, {});
    // Overwrite a file with custom content
    const firstFile = TEMPLATE_FILES[0];
    if (firstFile) {
      const filePath = path.join(tmpDir, ".claude", firstFile);
      fs.writeFileSync(filePath, "MY_CUSTOM_CONTENT", "utf-8");
      // Scaffold again with merge
      const created = await scaffoldProject(tmpDir, { merge: true });
      // The custom file should NOT be in the returned list (it was skipped)
      expect(created).not.toContain(`.claude/${firstFile}`);
      // Original custom content preserved
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toBe("MY_CUSTOM_CONTENT");
    }
  });

  it("creates nested directories for templates", async () => {
    await scaffoldProject(tmpDir, {});
    // Check that nested paths are created (e.g. commands/ and skills/ subdirs)
    const commandsDir = path.join(tmpDir, ".claude", "commands");
    expect(fs.existsSync(commandsDir)).toBe(true);
    const skillsDir = path.join(tmpDir, ".claude", "skills");
    expect(fs.existsSync(skillsDir)).toBe(true);
  });
});

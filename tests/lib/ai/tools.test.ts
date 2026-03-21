import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCodingTools } from "../../../src/lib/ai/tools.js";

let tmpDir: string;
let tools: ReturnType<typeof createCodingTools>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-tools-test-"));
  tools = createCodingTools(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// createCodingTools - returns all tools
// ---------------------------------------------------------------------------

describe("createCodingTools", () => {
  it("returns all 6 tools", () => {
    const toolNames = Object.keys(tools);
    expect(toolNames).toContain("readFile");
    expect(toolNames).toContain("editFile");
    expect(toolNames).toContain("createFile");
    expect(toolNames).toContain("listFiles");
    expect(toolNames).toContain("runCommand");
    expect(toolNames).toContain("searchFiles");
    expect(toolNames).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// readFile
// ---------------------------------------------------------------------------

describe("readFile tool", () => {
  it("reads an existing file", async () => {
    fs.writeFileSync(path.join(tmpDir, "hello.txt"), "hello world", "utf-8");
    const result = await tools.readFile.execute(
      { filePath: "hello.txt" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toEqual({ content: "hello world", lines: 1 });
  });

  it("returns error for non-existent file", async () => {
    const result = await tools.readFile.execute(
      { filePath: "nope.txt" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("File not found");
  });

  it("prevents path traversal with ../", async () => {
    const result = await tools.readFile.execute(
      { filePath: "../../etc/passwd" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Path traversal");
  });

  it("prevents path traversal with absolute path", async () => {
    const result = await tools.readFile.execute(
      { filePath: "/etc/passwd" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// editFile
// ---------------------------------------------------------------------------

describe("editFile tool", () => {
  it("replaces exact match in file", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "code.ts"),
      "const x = 1;\nconst y = 2;\n",
      "utf-8",
    );
    const result = await tools.editFile.execute(
      {
        filePath: "code.ts",
        oldString: "const x = 1;",
        newString: "const x = 42;",
      },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toEqual({ success: true, filePath: "code.ts" });
    const content = fs.readFileSync(path.join(tmpDir, "code.ts"), "utf-8");
    expect(content).toContain("const x = 42;");
    expect(content).toContain("const y = 2;");
  });

  it("returns error when old string not found", async () => {
    fs.writeFileSync(path.join(tmpDir, "code.ts"), "const x = 1;\n", "utf-8");
    const result = await tools.editFile.execute(
      {
        filePath: "code.ts",
        oldString: "not in file",
        newString: "replacement",
      },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Could not find");
  });

  it("rejects when multiple occurrences found", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "dup.ts"),
      "foo bar foo bar foo",
      "utf-8",
    );
    const result = await tools.editFile.execute(
      {
        filePath: "dup.ts",
        oldString: "foo",
        newString: "baz",
      },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("3 occurrences");
  });

  it("prevents path traversal", async () => {
    const result = await tools.editFile.execute(
      {
        filePath: "../../../etc/hosts",
        oldString: "old",
        newString: "new",
      },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Path traversal");
  });
});

// ---------------------------------------------------------------------------
// createFile
// ---------------------------------------------------------------------------

describe("createFile tool", () => {
  it("creates a new file with content", async () => {
    const result = await tools.createFile.execute(
      { filePath: "new-file.ts", content: "export const a = 1;" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toEqual({ success: true, filePath: "new-file.ts" });
    const content = fs.readFileSync(path.join(tmpDir, "new-file.ts"), "utf-8");
    expect(content).toBe("export const a = 1;");
  });

  it("creates nested directories", async () => {
    await tools.createFile.execute(
      { filePath: "src/lib/deep/file.ts", content: "nested" },
      { toolCallId: "t1", messages: [] },
    );
    const content = fs.readFileSync(
      path.join(tmpDir, "src/lib/deep/file.ts"),
      "utf-8",
    );
    expect(content).toBe("nested");
  });

  it("prevents path traversal", async () => {
    const result = await tools.createFile.execute(
      { filePath: "../../outside.txt", content: "bad" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Path traversal");
  });
});

// ---------------------------------------------------------------------------
// listFiles
// ---------------------------------------------------------------------------

describe("listFiles tool", () => {
  it("lists files in root directory", async () => {
    fs.writeFileSync(path.join(tmpDir, "a.ts"), "a", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "b.ts"), "b", "utf-8");
    fs.mkdirSync(path.join(tmpDir, "src"));

    const result = await tools.listFiles.execute(
      { dirPath: "." },
      { toolCallId: "t1", messages: [] },
    );
    const entries = (
      result as { entries: Array<{ name: string; type: string }> }
    ).entries;
    expect(entries).toBeDefined();
    const names = entries.map((e) => e.name);
    expect(names).toContain("a.ts");
    expect(names).toContain("b.ts");
    expect(names).toContain("src");
  });

  it("returns error for non-existent directory", async () => {
    const result = await tools.listFiles.execute(
      { dirPath: "nope" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
  });

  it("lists files recursively", async () => {
    fs.mkdirSync(path.join(tmpDir, "sub"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "root.ts"), "r", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "sub", "child.ts"), "c", "utf-8");

    const result = await tools.listFiles.execute(
      { dirPath: ".", recursive: true },
      { toolCallId: "t1", messages: [] },
    );
    const files = (result as { files: string[] }).files;
    expect(files).toContain("root.ts");
    expect(files).toContain(path.join("sub", "child.ts"));
  });

  it("prevents path traversal", async () => {
    const result = await tools.listFiles.execute(
      { dirPath: "../../.." },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Path traversal");
  });
});

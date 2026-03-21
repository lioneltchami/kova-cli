import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatContext,
  loadFiles,
  loadGlob,
  type LoadedContext,
} from "../../../src/lib/ai/context-loader.js";

// ---------------------------------------------------------------------------
// loadFiles
// ---------------------------------------------------------------------------

describe("loadFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-loader-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads existing files correctly", () => {
    fs.writeFileSync(path.join(tmpDir, "a.ts"), "const a = 1;");
    fs.writeFileSync(path.join(tmpDir, "b.ts"), "const b = 2;");

    const ctx = loadFiles(["a.ts", "b.ts"], tmpDir);

    expect(ctx.files).toHaveLength(2);
    expect(ctx.files[0].path).toBe("a.ts");
    expect(ctx.files[0].content).toBe("const a = 1;");
    expect(ctx.files[1].path).toBe("b.ts");
    expect(ctx.files[1].content).toBe("const b = 2;");
    expect(ctx.totalBytes).toBeGreaterThan(0);
    expect(ctx.truncated).toBe(false);
  });

  it("skips files outside workingDir (path traversal attempt)", () => {
    fs.writeFileSync(path.join(tmpDir, "legit.ts"), "ok");

    const ctx = loadFiles(["../../etc/passwd", "legit.ts"], tmpDir);

    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0].path).toBe("legit.ts");
  });

  it("skips unreadable/nonexistent files", () => {
    fs.writeFileSync(path.join(tmpDir, "exists.ts"), "hello");

    const ctx = loadFiles(["exists.ts", "missing.ts"], tmpDir);

    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0].path).toBe("exists.ts");
  });

  it("respects MAX_CONTEXT_BYTES limit and sets truncated flag", () => {
    // Create a file that is just under 500KB
    const bigContent = "x".repeat(499_000);
    fs.writeFileSync(path.join(tmpDir, "big.ts"), bigContent);
    // Create a second file that would push past the limit
    const smallContent = "y".repeat(2_000);
    fs.writeFileSync(path.join(tmpDir, "small.ts"), smallContent);

    const ctx = loadFiles(["big.ts", "small.ts"], tmpDir);

    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0].path).toBe("big.ts");
    expect(ctx.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadGlob
// ---------------------------------------------------------------------------

vi.mock("execa", () => ({
  execaCommand: vi.fn(),
}));

describe("loadGlob", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-glob-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds files matching patterns", async () => {
    fs.writeFileSync(path.join(tmpDir, "foo.ts"), "foo content");
    fs.writeFileSync(path.join(tmpDir, "bar.ts"), "bar content");

    const { execaCommand } = await import("execa");
    const mockedExeca = vi.mocked(execaCommand);
    mockedExeca.mockResolvedValueOnce({
      stdout: "foo.ts\nbar.ts",
    } as never);

    const ctx = await loadGlob(["*.ts"], tmpDir);

    expect(mockedExeca).toHaveBeenCalledWith(
      'rg --files --glob "*.ts" --max-filesize 100K',
      { cwd: tmpDir, timeout: 10_000 },
    );
    expect(ctx.files).toHaveLength(2);
  });

  it("deduplicates files across multiple patterns", async () => {
    fs.writeFileSync(path.join(tmpDir, "shared.ts"), "shared");

    const { execaCommand } = await import("execa");
    const mockedExeca = vi.mocked(execaCommand);
    // Both patterns return the same file
    mockedExeca.mockResolvedValueOnce({ stdout: "shared.ts" } as never);
    mockedExeca.mockResolvedValueOnce({ stdout: "shared.ts" } as never);

    const ctx = await loadGlob(["*.ts", "shared.*"], tmpDir);

    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0].path).toBe("shared.ts");
  });
});

// ---------------------------------------------------------------------------
// formatContext
// ---------------------------------------------------------------------------

describe("formatContext", () => {
  it("formats file content with headers", () => {
    const ctx: LoadedContext = {
      files: [
        { path: "src/index.ts", content: 'console.log("hi");', sizeBytes: 18 },
        { path: "src/utils.ts", content: "export {};\n", sizeBytes: 11 },
      ],
      totalBytes: 29,
      truncated: false,
    };

    const result = formatContext(ctx);

    expect(result).toContain("<context>");
    expect(result).toContain("</context>");
    expect(result).toContain("--- src/index.ts ---");
    expect(result).toContain('console.log("hi");');
    expect(result).toContain("--- src/utils.ts ---");
    expect(result).toContain("2 file(s)");
    expect(result).not.toContain("omitted");
  });

  it("returns empty string for no files", () => {
    const ctx: LoadedContext = {
      files: [],
      totalBytes: 0,
      truncated: false,
    };

    expect(formatContext(ctx)).toBe("");
  });

  it("includes truncation notice when truncated is true", () => {
    const ctx: LoadedContext = {
      files: [{ path: "a.ts", content: "a", sizeBytes: 1 }],
      totalBytes: 1,
      truncated: true,
    };

    const result = formatContext(ctx);

    expect(result).toContain("omitted due to context size limits");
  });
});

import fs from "fs";
import path from "path";

export interface LoadedContext {
  files: { path: string; content: string; sizeBytes: number }[];
  totalBytes: number;
  truncated: boolean;
}

const MAX_CONTEXT_BYTES = 500_000; // ~500KB, roughly 125K tokens

/**
 * Load specific files by path.
 */
export function loadFiles(
  filePaths: string[],
  workingDir: string,
): LoadedContext {
  const files: LoadedContext["files"] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const filePath of filePaths) {
    const fullPath = path.resolve(workingDir, filePath);
    // Security: must be within workingDir
    if (!fullPath.startsWith(workingDir)) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const sizeBytes = Buffer.byteLength(content, "utf-8");

      if (totalBytes + sizeBytes > MAX_CONTEXT_BYTES) {
        truncated = true;
        break;
      }

      files.push({ path: filePath, content, sizeBytes });
      totalBytes += sizeBytes;
    } catch {
      // Skip unreadable files
    }
  }

  return { files, totalBytes, truncated };
}

/**
 * Load files matching glob patterns using ripgrep for Node 18 compatibility.
 */
export async function loadGlob(
  patterns: string[],
  workingDir: string,
): Promise<LoadedContext> {
  const { execaCommand } = await import("execa");

  const allFiles: string[] = [];

  for (const pattern of patterns) {
    try {
      const { stdout } = await execaCommand(
        `rg --files --glob "${pattern}" --max-filesize 100K`,
        { cwd: workingDir, timeout: 10_000 },
      );
      const files = stdout.split("\n").filter(Boolean);
      allFiles.push(...files);
    } catch {
      // Pattern matched nothing or rg not available
    }
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];

  return loadFiles(uniqueFiles, workingDir);
}

/**
 * Format loaded context as a string to prepend to system prompt or user message.
 */
export function formatContext(context: LoadedContext): string {
  if (context.files.length === 0) return "";

  const parts = context.files.map((f) => `--- ${f.path} ---\n${f.content}`);

  let result = `<context>\nThe following ${context.files.length} file(s) are provided as context:\n\n${parts.join("\n\n")}\n</context>`;

  if (context.truncated) {
    result += "\n\n(Note: Some files were omitted due to context size limits.)";
  }

  return result;
}

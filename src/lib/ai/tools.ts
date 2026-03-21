import { tool } from "ai";
import { execaCommand } from "execa";
import fs from "fs";
import path from "path";
import { z } from "zod";

export function createCodingTools(workingDir: string) {
	return {
		readFile: tool({
			description:
				"Read the contents of a file. Use this to understand existing code before making changes.",
			inputSchema: z.object({
				filePath: z
					.string()
					.describe("Relative path to the file from the project root"),
			}),
			execute: async ({ filePath }) => {
				const fullPath = path.resolve(workingDir, filePath);
				if (!fullPath.startsWith(workingDir)) {
					return {
						error:
							"Path traversal detected. Must stay within project directory.",
					};
				}
				try {
					const content = fs.readFileSync(fullPath, "utf-8");
					return { content, lines: content.split("\n").length };
				} catch {
					return { error: `File not found: ${filePath}` };
				}
			},
		}),

		editFile: tool({
			description:
				"Edit a file by replacing a specific string with new content. The old_string must match exactly (including whitespace and indentation).",
			inputSchema: z.object({
				filePath: z.string().describe("Relative path to the file"),
				oldString: z.string().describe("The exact string to find and replace"),
				newString: z.string().describe("The replacement string"),
			}),
			execute: async ({ filePath, oldString, newString }) => {
				const fullPath = path.resolve(workingDir, filePath);
				if (!fullPath.startsWith(workingDir)) {
					return { error: "Path traversal detected." };
				}
				try {
					const content = fs.readFileSync(fullPath, "utf-8");
					if (!content.includes(oldString)) {
						return {
							error: `Could not find the specified string in ${filePath}. Make sure it matches exactly.`,
						};
					}
					const occurrences = content.split(oldString).length - 1;
					if (occurrences > 1) {
						return {
							error: `Found ${occurrences} occurrences of the string. Please provide more context to make the match unique.`,
						};
					}
					const updated = content.replace(oldString, newString);
					fs.writeFileSync(fullPath, updated, "utf-8");
					return { success: true, filePath };
				} catch {
					return { error: `Failed to edit ${filePath}` };
				}
			},
		}),

		createFile: tool({
			description: "Create a new file with the given content.",
			inputSchema: z.object({
				filePath: z.string().describe("Relative path for the new file"),
				content: z.string().describe("The file content to write"),
			}),
			execute: async ({ filePath, content }) => {
				const fullPath = path.resolve(workingDir, filePath);
				if (!fullPath.startsWith(workingDir)) {
					return { error: "Path traversal detected." };
				}
				const dir = path.dirname(fullPath);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(fullPath, content, "utf-8");
				return { success: true, filePath };
			},
		}),

		listFiles: tool({
			description:
				"List files in a directory. Use this to understand project structure.",
			inputSchema: z.object({
				dirPath: z
					.string()
					.describe(
						"Relative path to the directory (use '.' for project root)",
					),
				recursive: z
					.boolean()
					.optional()
					.describe("If true, list files recursively"),
			}),
			execute: async ({ dirPath, recursive }) => {
				const fullPath = path.resolve(workingDir, dirPath);
				if (!fullPath.startsWith(workingDir)) {
					return { error: "Path traversal detected." };
				}
				try {
					if (recursive) {
						const files: string[] = [];
						const walk = (dir: string) => {
							for (const entry of fs.readdirSync(dir, {
								withFileTypes: true,
							})) {
								if (entry.name === "node_modules" || entry.name === ".git")
									continue;
								const p = path.join(dir, entry.name);
								if (entry.isDirectory()) walk(p);
								else files.push(path.relative(workingDir, p));
							}
						};
						walk(fullPath);
						return { files: files.slice(0, 200) };
					}
					const entries = fs.readdirSync(fullPath, { withFileTypes: true });
					return {
						entries: entries.map((e) => ({
							name: e.name,
							type: e.isDirectory() ? ("dir" as const) : ("file" as const),
						})),
					};
				} catch {
					return { error: `Directory not found: ${dirPath}` };
				}
			},
		}),

		runCommand: tool({
			description:
				"Run a shell command in the project directory. Use for running tests, linting, or checking build status.",
			inputSchema: z.object({
				command: z.string().describe("The shell command to run"),
			}),
			execute: async ({ command }) => {
				try {
					const result = await execaCommand(command, {
						cwd: workingDir,
						timeout: 30_000,
						reject: false,
					});
					return {
						stdout: (result.stdout ?? "").slice(0, 5000),
						stderr: (result.stderr ?? "").slice(0, 2000),
						exitCode: result.exitCode,
					};
				} catch {
					return { error: `Command failed: ${command}` };
				}
			},
		}),

		searchFiles: tool({
			description:
				"Search for a pattern across files in the project. Returns matching file paths and line content.",
			inputSchema: z.object({
				pattern: z.string().describe("The text pattern to search for"),
				glob: z
					.string()
					.optional()
					.describe(
						"File glob pattern to filter (e.g. '*.ts', 'src/**/*.tsx')",
					),
			}),
			execute: async ({ pattern, glob: fileGlob }) => {
				try {
					const args = [
						"--no-heading",
						"--line-number",
						"--max-count=5",
						"--max-filesize=1M",
					];
					if (fileGlob) args.push("--glob", fileGlob);
					args.push(pattern, ".");

					const result = await execaCommand(
						`rg ${args.map((a) => `'${a}'`).join(" ")}`,
						{
							cwd: workingDir,
							timeout: 10_000,
							reject: false,
						},
					);

					const lines = (result.stdout ?? "").split("\n").slice(0, 50);
					return { matches: lines.filter(Boolean) };
				} catch {
					return { error: "Search failed." };
				}
			},
		}),
	};
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TEMPLATE_FILES } from "./constants.js";
import type { ScaffoldOptions } from "../types.js";

export function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // dist/lib/scaffold.js -> ../../templates => project root/templates
  return path.join(__dirname, "..", "..", "templates");
}

export async function scaffoldProject(
  projectDir: string,
  options: ScaffoldOptions,
): Promise<string[]> {
  const templatesDir = getTemplatesDir();
  const claudeDir = path.join(projectDir, ".claude");
  const claudeExists = fs.existsSync(claudeDir);

  if (claudeExists && !options.force && !options.merge) {
    throw new Error(
      "Directory .claude/ already exists. Use --force to overwrite or --merge to add missing files.",
    );
  }

  const createdFiles: string[] = [];

  for (const templateFile of TEMPLATE_FILES) {
    const srcPath = path.join(templatesDir, templateFile);
    const destPath = path.join(claudeDir, templateFile);

    if (options.merge && fs.existsSync(destPath)) {
      // Skip files that already exist in merge mode
      continue;
    }

    // Ensure parent directories exist
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });

    // Copy the template file if it exists in templates
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      // Create an empty file as placeholder if template source is missing
      fs.writeFileSync(destPath, "");
    }

    createdFiles.push(path.relative(projectDir, destPath));
  }

  // Always ensure .claude/tasks/ directory exists
  const tasksDir = path.join(claudeDir, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });

  return createdFiles;
}

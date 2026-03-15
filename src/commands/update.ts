import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CLAUDE_DIR, TEMPLATE_FILES } from "../lib/constants.js";
import * as logger from "../lib/logger.js";
import { getTemplatesDir } from "../lib/scaffold.js";

export interface UpdateOptions {
  force?: boolean;
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export interface UpdateResult {
  updated: string[];
  skipped: string[];
  unchanged: string[];
  missing: string[];
}

export function checkForUpdates(projectDir: string): UpdateResult {
  const templatesDir = getTemplatesDir();
  const claudeDir = path.join(projectDir, CLAUDE_DIR);

  const result: UpdateResult = {
    updated: [],
    skipped: [],
    unchanged: [],
    missing: [],
  };

  for (const templateFile of TEMPLATE_FILES) {
    const srcPath = path.join(templatesDir, templateFile);
    const destPath = path.join(claudeDir, templateFile);

    if (!fs.existsSync(srcPath)) continue;

    if (!fs.existsSync(destPath)) {
      result.missing.push(templateFile);
      continue;
    }

    const srcHash = fileHash(srcPath);
    const destHash = fileHash(destPath);

    if (srcHash === destHash) {
      result.unchanged.push(templateFile);
    } else {
      result.updated.push(templateFile);
    }
  }

  return result;
}

export function applyUpdates(
  projectDir: string,
  result: UpdateResult,
  force: boolean,
): { applied: string[]; skippedLocal: string[] } {
  const templatesDir = getTemplatesDir();
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const applied: string[] = [];
  const skippedLocal: string[] = [];

  for (const templateFile of result.missing) {
    const srcPath = path.join(templatesDir, templateFile);
    const destPath = path.join(claudeDir, templateFile);
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    applied.push(templateFile);
  }

  for (const templateFile of result.updated) {
    if (force) {
      const srcPath = path.join(templatesDir, templateFile);
      const destPath = path.join(claudeDir, templateFile);
      fs.copyFileSync(srcPath, destPath);
      applied.push(templateFile);
    } else {
      skippedLocal.push(templateFile);
    }
  }

  return { applied, skippedLocal };
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, CLAUDE_DIR);

  if (!fs.existsSync(claudeDir)) {
    logger.error("No .claude/ directory found. Run 'kova init' first.");
    process.exit(1);
  }

  logger.info("Checking for template updates...");
  console.log();

  const result = checkForUpdates(projectDir);

  if (result.missing.length > 0) {
    logger.info(`New templates available: ${result.missing.length}`);
    for (const f of result.missing) {
      logger.success(`  + ${f}`);
    }
  }

  if (result.updated.length > 0) {
    logger.info(`Changed templates: ${result.updated.length}`);
    for (const f of result.updated) {
      logger.warn(`  ~ ${f}`);
    }
  }

  if (result.unchanged.length > 0) {
    logger.info(`Unchanged: ${result.unchanged.length} files`);
  }

  if (result.missing.length === 0 && result.updated.length === 0) {
    logger.success("All templates are up to date.");
    return;
  }

  console.log();
  const { applied, skippedLocal } = applyUpdates(
    projectDir,
    result,
    !!options.force,
  );

  if (applied.length > 0) {
    logger.success(`Updated ${applied.length} file(s):`);
    for (const f of applied) {
      logger.info(`  ${f}`);
    }
  }

  if (skippedLocal.length > 0) {
    console.log();
    logger.warn(`Skipped ${skippedLocal.length} locally modified file(s):`);
    for (const f of skippedLocal) {
      logger.warn(`  ${f}`);
    }
    logger.info("Use 'kova update --force' to overwrite local modifications.");
  }
}

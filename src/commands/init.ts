import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateConfig, saveConfig } from "../lib/config.js";
import { detectProject } from "../lib/detect.js";
import { isInteractiveMode, runInteractiveInit } from "../lib/interactive.js";
import * as logger from "../lib/logger.js";
import { getTemplatesDir, scaffoldProject } from "../lib/scaffold.js";
import type { DetectedProject } from "../types.js";

export interface InitOptions {
  force?: boolean;
  merge?: boolean;
  dryRun?: boolean;
  noDetect?: boolean;
  preset?: string;
}

function buildDetectedRows(detected: DetectedProject): [string, string][] {
  const rows: [string, string][] = [
    ["language", detected.language ?? "(none detected)"],
    ["framework", detected.framework ?? "(none detected)"],
    ["packageManager", detected.packageManager ?? "(none detected)"],
    ["database", detected.database ?? "(none detected)"],
    ["auth", detected.auth ?? "(none detected)"],
    ["payments", detected.payments ?? "(none detected)"],
  ];

  if (detected.commands.dev) rows.push(["commands.dev", detected.commands.dev]);
  if (detected.commands.build)
    rows.push(["commands.build", detected.commands.build]);
  if (detected.commands.test)
    rows.push(["commands.test", detected.commands.test]);
  if (detected.commands.lint)
    rows.push(["commands.lint", detected.commands.lint]);
  if (detected.commands.typecheck)
    rows.push(["commands.typecheck", detected.commands.typecheck]);

  return rows;
}

function generateClaudeMd(detected: DetectedProject, projectDir: string): void {
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(templatesDir, "CLAUDE.md.template");

  let template: string;
  try {
    template = fs.readFileSync(templatePath, "utf-8");
  } catch {
    logger.warn("CLAUDE.md.template not found, skipping CLAUDE.md generation.");
    return;
  }

  const projectName = path.basename(projectDir);
  const language = detected.language ?? "Unknown";
  const framework = detected.framework ?? "None";
  const packageManager = detected.packageManager ?? "npm";

  // Build quality gates section
  const qualityLines: string[] = [];
  if (detected.commands.test)
    qualityLines.push(`- **Test**: \`${detected.commands.test}\``);
  if (detected.commands.lint)
    qualityLines.push(`- **Lint**: \`${detected.commands.lint}\``);
  if (detected.commands.typecheck)
    qualityLines.push(`- **Typecheck**: \`${detected.commands.typecheck}\``);
  if (detected.commands.build)
    qualityLines.push(`- **Build**: \`${detected.commands.build}\``);
  const qualityGates =
    qualityLines.length > 0
      ? qualityLines.join("\n")
      : "No quality commands detected. Add them to kova.yaml manually.";

  // Build boundaries section
  const boundaries =
    "- `*.lock` - Lock files (never modify directly)\n- `.env*` - Environment variables\n- `node_modules/**` - Dependencies";

  // Build rules section
  const projectRules =
    "- Follow the existing code style and conventions\n- Run quality checks before marking tasks complete\n- Never commit secrets or credentials";

  // Optional lines
  const databaseLine = detected.database
    ? `- **Database**: ${detected.database}`
    : "";
  const authLine = detected.auth ? `- **Auth**: ${detected.auth}` : "";
  const paymentsLine = detected.payments
    ? `- **Payments**: ${detected.payments}`
    : "";

  let output = template
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{LANGUAGE\}\}/g, language)
    .replace(/\{\{FRAMEWORK\}\}/g, framework)
    .replace(/\{\{PACKAGE_MANAGER\}\}/g, packageManager)
    .replace(/\{\{QUALITY_GATES\}\}/g, qualityGates)
    .replace(/\{\{PROJECT_RULES\}\}/g, projectRules)
    .replace(/\{\{BOUNDARIES\}\}/g, boundaries)
    .replace(/\{\{DATABASE_LINE\}\}/g, databaseLine)
    .replace(/\{\{AUTH_LINE\}\}/g, authLine)
    .replace(/\{\{PAYMENTS_LINE\}\}/g, paymentsLine);

  // Remove empty optional lines (lines that are just empty strings from unset placeholders)
  output = output
    .split("\n")
    .filter((line) => line.trim() !== "" || line === "")
    .join("\n")
    // Collapse triple+ newlines down to double
    .replace(/\n{3,}/g, "\n\n");

  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  fs.writeFileSync(claudeMdPath, output, "utf-8");
}

export async function initCommand(options: InitOptions): Promise<void> {
  logger.banner();

  const projectDir = process.cwd();

  // Step 1: Detect project (unless --no-detect)
  let detected: DetectedProject = {
    language: null,
    framework: null,
    packageManager: null,
    database: null,
    auth: null,
    payments: null,
    commands: {
      test: null,
      lint: null,
      build: null,
      typecheck: null,
      dev: null,
    },
  };

  // Check for interactive mode (TTY + no flags)
  if (isInteractiveMode(options)) {
    // Run detection silently for defaults
    const silentDetected = await detectProject(projectDir);

    try {
      const interactiveResult = await runInteractiveInit(silentDetected);

      // Override detected values with interactive choices
      detected = {
        language: interactiveResult.language,
        framework: interactiveResult.framework,
        packageManager: interactiveResult.packageManager,
        database: interactiveResult.database,
        auth: interactiveResult.auth,
        payments: interactiveResult.payments,
        commands: silentDetected.commands, // Keep detected commands
      };

      // Skip the normal detection display since we already showed interactive prompts
      // Continue to scaffold below...
    } catch (err) {
      // User cancelled (Ctrl+C) -- exit gracefully
      if (err instanceof Error && err.message.includes("User force closed")) {
        logger.info("Init cancelled.");
        return;
      }
      throw err;
    }
  } else if (!options.noDetect) {
    // Original flag-based detection flow
    logger.info("Detecting project...");
    detected = await detectProject(projectDir);
    console.log();
    logger.table(buildDetectedRows(detected));
    console.log();
  }

  // Step 2: Dry-run mode - list what would be created and return
  if (options.dryRun) {
    logger.header("Dry Run - Files That Would Be Created");
    logger.info(".claude/commands/team-plan.md");
    logger.info(".claude/commands/build.md");
    logger.info(".claude/commands/team-build.md");
    logger.info(".claude/skills/session-management/SKILL.md");
    logger.info(".claude/skills/sub-agent-invocation/SKILL.md");
    logger.info(".claude/hooks/Validators/validate-new-file.mjs");
    logger.info(".claude/hooks/Validators/validate-file-contains.mjs");
    logger.info(".claude/hooks/FormatterHook/formatter.mjs");
    logger.info(
      ".claude/hooks/SkillActivationHook/skill-activation-prompt.mjs",
    );
    logger.info(".claude/agents/agent-rules.json");
    logger.info(".claude/skills/skill-rules.json");
    logger.info(".claude/settings.json");
    logger.info(".claude/tasks/ (directory)");
    logger.info("kova.yaml");
    logger.info("CLAUDE.md");
    console.log();
    logger.warn("Dry run complete. No files were created.");
    return;
  }

  // Step 3: Scaffold .claude/ directory
  let createdFiles: string[] = [];
  try {
    createdFiles = await scaffoldProject(projectDir, {
      force: options.force,
      merge: options.merge,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    if (message.includes("already exists")) {
      logger.info(
        "Use --force to overwrite or --merge to add only missing files.",
      );
    }
    process.exit(1);
  }

  // Step 4: Generate and save kova.yaml config
  const config = generateConfig(detected);
  await saveConfig(projectDir, config);

  // Step 5: Generate CLAUDE.md from template
  generateClaudeMd(detected, projectDir);

  // Step 6: Report created files
  logger.header("Kova Initialized");

  if (createdFiles.length > 0) {
    for (const file of createdFiles) {
      logger.success(file);
    }
  } else if (options.merge) {
    logger.info(
      "All .claude/ files already exist -- nothing to add in merge mode.",
    );
  }

  logger.success("kova.yaml");
  logger.success("CLAUDE.md");

  // Step 7: Print next steps
  console.log();
  logger.header("Next Steps");
  logger.info(
    "1. Review kova.yaml and adjust model tiers, rules, and boundaries as needed.",
  );
  logger.info(
    "2. Open CLAUDE.md in your editor to verify the generated project context.",
  );
  logger.info(
    '3. Run `kova plan "<your feature>"` to create an implementation plan.',
  );
  logger.info("4. Run `kova build` to execute the plan with sub-agents.");
  console.log();
}

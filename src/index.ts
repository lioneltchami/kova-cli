import { Command } from "commander";
import { VERSION } from "./lib/constants.js";
import { suggestCommand, wrapCommandAction } from "./lib/error-handler.js";
import * as logger from "./lib/logger.js";
import {
  checkForUpdateBackground,
  getUpdateResult,
} from "./lib/update-checker.js";

// Non-blocking update check
void checkForUpdateBackground(VERSION);

const program = new Command();

program
  .name("kova")
  .description("AI coding orchestration CLI - Plan the hunt. Run the pack.")
  .version(VERSION);

// Init command
program
  .command("init")
  .description("Initialize a project for orchestrated development")
  .option("-f, --force", "Overwrite existing .claude/ directory")
  .option("-m, --merge", "Merge with existing .claude/ files")
  .option("--dry-run", "Show what would be created without creating")
  .option("--no-detect", "Skip auto-detection, use defaults")
  .option("--preset <name>", "Use a preset configuration")
  .action(
    wrapCommandAction(async (options) => {
      const { initCommand } = await import("./commands/init.js");
      await initCommand(options);
    }),
  );

// Plan command
program
  .command("plan [prompt...]")
  .description("Create an implementation plan")
  .option("--model <model>", "Override planning model")
  .option("--auto-build", "Skip approval, immediately build")
  .option("--output <path>", "Custom output path for plan file")
  .option(
    "-t, --template <name>",
    "Use a plan template (feature, bugfix, refactor, migration, security, performance)",
  )
  .option("--issue <number>", "Link a GitHub issue for context")
  .option("--no-branch", "Disable auto-branch creation")
  .action(
    wrapCommandAction(async (promptParts, options) => {
      const { planCommand } = await import("./commands/plan.js");
      const prompt = (promptParts as string[]).join(" ");
      await planCommand(prompt, options);
    }),
  );

// Run command (plan + build combined)
program
  .command("run [prompt...]")
  .description("Plan and build in one step")
  .option("--model <model>", "Override planning model")
  .option("-t, --template <name>", "Use a plan template")
  .option("--no-auto", "Pause for approval before building")
  .option("--live", "Show real-time build progress")
  .option("--resume", "Resume from checkpoint")
  .option("--verbose", "Show agent output in real-time")
  .option("--issue <number>", "Link a GitHub issue for context")
  .option("--branch <name>", "Custom branch name")
  .option("--no-branch", "Disable auto-branch creation")
  .action(
    wrapCommandAction(async (promptParts, options) => {
      const { runCommand } = await import("./commands/run.js");
      const prompt = (promptParts as string[]).join(" ");
      await runCommand(prompt, options);
    }),
  );

// Build command
program
  .command("build [plan-path]")
  .description("Execute a plan using sub-agent dispatch")
  .option("--resume", "Resume from checkpoint")
  .option("--parallel <n>", "Max parallel agents", parseInt)
  .option("--model-override <model>", "Use this model for all tasks")
  .option("--dry-run", "Show execution plan without running")
  .option("--verbose", "Show agent output in real-time")
  .option("--no-validate", "Skip quality validation step")
  .option("--live", "Show real-time build progress")
  .action(
    wrapCommandAction(async (planPath, options) => {
      const { buildCommand } = await import("./commands/build.js");
      await buildCommand(planPath as string | undefined, options);
    }),
  );

// Team-build command
program
  .command("team-build [plan-path]")
  .description("Execute a plan using Agent Teams coordination")
  .option("--resume", "Resume from checkpoint")
  .option("--parallel <n>", "Max parallel agents", parseInt)
  .option("--model-override <model>", "Use this model for all tasks")
  .option("--dry-run", "Show execution plan without running")
  .option("--verbose", "Show agent output in real-time")
  .option("--no-validate", "Skip quality validation step")
  .option("--wave-timeout <seconds>", "Max time per wave", parseInt)
  .option("--live", "Show real-time build progress")
  .action(
    wrapCommandAction(async (planPath, options) => {
      const { teamBuildCommand } = await import("./commands/team-build.js");
      await teamBuildCommand(planPath as string | undefined, options);
    }),
  );

// Status command
program
  .command("status")
  .description("Check progress of current or recent builds")
  .action(
    wrapCommandAction(async () => {
      const { statusCommand } = await import("./commands/status.js");
      await statusCommand();
    }),
  );

// Config command
program
  .command("config [action] [args...]")
  .description("View or edit Kova configuration")
  .action(
    wrapCommandAction(async (action, args) => {
      const { configCommand } = await import("./commands/config.js");
      await configCommand(
        action as string | undefined,
        args as string[] | undefined,
      );
    }),
  );

// Update command
program
  .command("update")
  .description("Update scaffolded templates from latest package version")
  .option("-f, --force", "Overwrite locally modified files")
  .action(
    wrapCommandAction(async (options) => {
      const { updateCommand } = await import("./commands/update.js");
      await updateCommand(options);
    }),
  );

// Completions command
program
  .command("completions [shell]")
  .description("Generate shell completion scripts (bash, zsh, fish)")
  .action(
    wrapCommandAction(async (shell) => {
      const { completionsCommand } = await import("./commands/completions.js");
      await completionsCommand(shell as string | undefined);
    }),
  );

// PR command
program
  .command("pr")
  .description("Create a GitHub Pull Request from the last build")
  .option("--title <title>", "Override PR title")
  .option("--body <body>", "Override PR body")
  .option("--draft", "Create as draft PR")
  .option("--base <branch>", "Target branch (default: main)")
  .action(
    wrapCommandAction(async (options) => {
      const { prCommand } = await import("./commands/pr.js");
      await prCommand(options);
    }),
  );

// Handle unknown commands with suggestions
program.on("command:*", (operands: string[]) => {
  const unknown = operands[0] ?? "";
  const commands = program.commands.map((c) => c.name());
  const suggestion = suggestCommand(unknown, commands);
  if (suggestion) {
    logger.error(`Unknown command: ${unknown}. Did you mean '${suggestion}'?`);
  } else {
    logger.error(`Unknown command: ${unknown}.`);
  }
  logger.info("Run 'kova --help' to see available commands.");
  logger.info("Docs: https://github.com/kova-cli/kova");
  process.exitCode = 1;
});

program.parse();

// Show update banner after command completes
process.on("beforeExit", () => {
  const latestVersion = getUpdateResult();
  if (latestVersion) {
    logger.updateBanner(VERSION, latestVersion);
  }
});

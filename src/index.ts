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
  .description(
    "AI dev tool cost tracker - Know what your AI tools actually cost.",
  )
  .version(VERSION);

// Track command
program
  .command("track")
  .description("Scan and record AI tool usage data")
  .option("--since <date>", "Only collect usage since this date")
  .option("--tool <tool>", "Only collect from specific tool")
  .option("--daemon", "Run continuously at configured interval")
  .action(
    wrapCommandAction(async (options) => {
      const { trackCommand } = await import("./commands/track.js");
      await trackCommand(options as import("./commands/track.js").TrackOptions);
    }),
  );

// Costs command
program
  .command("costs")
  .description("View AI tool cost breakdown and analytics")
  .option("--today", "Show today only")
  .option("--week", "Show last 7 days")
  .option("--month [month]", "Show specific month (YYYY-MM)")
  .option("--tool <tool>", "Filter by AI tool")
  .option("--project <name>", "Filter by project")
  .option("--detailed", "Show per-session breakdown")
  .option("--json", "Output as JSON")
  .action(
    wrapCommandAction(async (options) => {
      const { costsCommand } = await import("./commands/costs.js");
      await costsCommand(options as import("./commands/costs.js").CostsOptions);
    }),
  );

// Budget command
program
  .command("budget [action]")
  .description("Manage AI tool spending budgets")
  .option("--monthly <amount>", "Set monthly budget in USD")
  .option("--daily <amount>", "Set daily budget in USD")
  .option("--warn-at <percent>", "Set warning threshold percentage")
  .action(
    wrapCommandAction(async (action, options) => {
      const { budgetCommand } = await import("./commands/budget.js");
      await budgetCommand(
        action as string | undefined,
        options as import("./commands/budget.js").BudgetOptions,
      );
    }),
  );

// Sync command
program
  .command("sync")
  .description("Upload usage data to Kova cloud dashboard")
  .option("--since <date>", "Only sync records since this date")
  .option("--dry-run", "Show what would be synced without uploading")
  .action(
    wrapCommandAction(async (options) => {
      const { syncCommand } = await import("./commands/sync.js");
      await syncCommand(options as import("./commands/sync.js").SyncOptions);
    }),
  );

// Report command
program
  .command("report")
  .description("Generate AI tool cost reports")
  .option("--format <format>", "Output format: csv, json, or text", "text")
  .option("--output <path>", "Write report to file")
  .option("--month <month>", "Report for specific month (YYYY-MM)")
  .action(
    wrapCommandAction(async (options) => {
      const { reportCommand } = await import("./commands/report.js");
      await reportCommand(
        options as import("./commands/report.js").ReportOptions,
      );
    }),
  );

// Login command
program
  .command("login [api-key]")
  .description("Log in to the Kova dashboard with your API key")
  .action(
    wrapCommandAction(async (apiKey) => {
      const { loginCommand } = await import("./commands/login.js");
      await loginCommand(apiKey as string | undefined);
    }),
  );

// Logout command
program
  .command("logout")
  .description("Log out from the Kova dashboard")
  .action(
    wrapCommandAction(async () => {
      const { logoutCommand } = await import("./commands/logout.js");
      await logoutCommand();
    }),
  );

// Account command
program
  .command("account")
  .description("View your Kova account and subscription details")
  .action(
    wrapCommandAction(async () => {
      const { accountCommand } = await import("./commands/account.js");
      await accountCommand();
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

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

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

const program = new Command();

program
	.name("kova")
	.description(
		"AI dev tool cost tracker and coding orchestrator - Use AI tools and know what they cost.",
	)
	.version(VERSION);

// Track command
program
	.command("track")
	.description("Scan and record AI tool usage data")
	.option("--since <date>", "Only collect usage since this date")
	.option("--tool <tool>", "Only collect from specific tool")
	.option("--daemon", "Run continuously at configured interval")
	.option("--auto-sync", "Automatically sync after each scan")
	.action(
		wrapCommandAction(async (options) => {
			const { trackCommand } = await import("./commands/track.js");
			await trackCommand(options as import("./commands/track.js").TrackOptions);
		}),
	);

// Compare command
program
	.command("compare")
	.description("Compare AI tool or model costs side-by-side")
	.option("--tools", "Group comparison by tool (default)")
	.option("--models", "Group comparison by model")
	.option(
		"--period <period>",
		"Time period to compare (e.g. 7d, 30d, 90d)",
		"30d",
	)
	.action(
		wrapCommandAction(async (options) => {
			const { compareCommand } = await import("./commands/compare.js");
			await compareCommand(
				options as import("./commands/compare.js").CompareOptions,
			);
		}),
	);

// Costs command
program
	.command("costs")
	.description("View AI tool cost breakdown and analytics")
	.option("--today", "Show today only")
	.option("--week", "Show last 7 days")
	.option("--month [month]", "Show specific month (YYYY-MM)")
	.option(
		"--since <date>",
		"Show costs since date (e.g. 7d, 30d, 2w, 1m, 2026-01-15)",
	)
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

// Config command
program
	.command("config [action] [args...]")
	.description(
		"Manage Kova configuration and tool credentials (set-key, remove-key, show-keys, set)",
	)
	.action(
		wrapCommandAction(async (action, args) => {
			const { configCommand } = await import("./commands/config-cmd.js");
			await configCommand(
				action as string | undefined,
				args as string[] | undefined,
			);
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

// Init command
program
	.command("init")
	.description("Interactive onboarding wizard - detect tools and first scan")
	.action(
		wrapCommandAction(async () => {
			const { initCommand } = await import("./commands/init.js");
			await initCommand();
		}),
	);

// Dashboard command
program
	.command("dashboard")
	.description("Open the Kova web dashboard in your browser")
	.action(
		wrapCommandAction(async () => {
			const { dashboardCommand } = await import("./commands/dashboard.js");
			await dashboardCommand();
		}),
	);

// Data export command (GDPR right-to-portability)
program
	.command("data export")
	.description("Export your local usage data to a JSON file")
	.option("--output <path>", "Path to write the export file")
	.action(
		wrapCommandAction(async (options) => {
			const { dataExportCommand } = await import("./commands/data-export.js");
			await dataExportCommand(
				options as import("./commands/data-export.js").DataExportOptions,
			);
		}),
	);

// Tag command
program
	.command("tag [project]")
	.description("Map a project directory to a cost center")
	.option("--cost-center <name>", "Cost center name to assign the project to")
	.action(
		wrapCommandAction(async (project, options) => {
			const { tagCommand } = await import("./commands/tag.js");
			await tagCommand(
				project as string | undefined,
				options as import("./commands/tag.js").TagOptions,
			);
		}),
	);

// CI report command
program
	.command("ci-report")
	.description("Generate a cost report for CI/CD pipelines")
	.option("--format <format>", "Output format: json or table", "table")
	.option("--period <period>", "Time period: 7d or 30d", "7d")
	.action(
		wrapCommandAction(async (options) => {
			const { ciReportCommand } = await import("./commands/ci-report.js");
			await ciReportCommand(
				options as import("./commands/ci-report.js").CiReportOptions,
			);
		}),
	);

// Audit command
program
	.command("audit [action]")
	.description("Export audit log data (action: export)")
	.option("--format <format>", "Output format: csv or json", "json")
	.option("--since <month>", "Export records since month (YYYY-MM)")
	.option("--output <path>", "Write audit log to file")
	.option("--local", "Use local data only, even if logged in")
	.action(
		wrapCommandAction(async (_action, options) => {
			const { auditExportCommand } = await import("./commands/audit.js");
			await auditExportCommand(
				options as import("./commands/audit.js").AuditExportOptions,
			);
		}),
	);

// SSO command
program
	.command("sso <action>")
	.description("Manage SSO authentication (actions: configure, login, status)")
	.option("--issuer <url>", "SSO issuer URL (for sso configure)")
	.action(
		wrapCommandAction(async (action, options) => {
			const ssoModule = await import("./commands/sso.js");
			if (action === "configure") {
				await ssoModule.ssoConfigureCommand(
					options as import("./commands/sso.js").SsoConfigureOptions,
				);
			} else if (action === "login") {
				await ssoModule.ssoLoginCommand();
			} else if (action === "status") {
				await ssoModule.ssoStatusCommand();
			} else {
				logger.error(
					`Unknown sso action: ${String(action)}. Use configure, login, or status.`,
				);
			}
		}),
	);

// Policy command
program
	.command("policy [action] [key] [value]")
	.description("Manage org policies (actions: list, set, enforce) [Enterprise]")
	.action(
		wrapCommandAction(async (action, key, value) => {
			const policyModule = await import("./commands/policy.js");
			if (!action || action === "list") {
				await policyModule.policyListCommand();
			} else if (action === "set") {
				await policyModule.policySetCommand(
					key as string | undefined,
					value as string | undefined,
				);
			} else if (action === "enforce") {
				await policyModule.policyEnforceCommand();
			} else {
				logger.error(
					`Unknown policy action: ${String(action)}. Use list, set, or enforce.`,
				);
			}
		}),
	);

// Run command (AI coding orchestrator)
program
	.command("run <prompt>")
	.description("Execute an AI coding task with intelligent model routing")
	.option(
		"--model <id>",
		"Use specific model (e.g. anthropic:claude-sonnet-4-20250514)",
	)
	.option(
		"--provider <name>",
		"Use specific provider (anthropic, openai, google, openrouter)",
	)
	.option("--tier <tier>", "Use model tier: cheap, mid, or strong")
	.option("--dry-run", "Show what would happen without making changes")
	.option("--auto-apply", "Apply file edits without confirmation")
	.option(
		"--context <file>",
		"Attach file as context (repeatable)",
		collect,
		[],
	)
	.option(
		"--include <glob>",
		"Include files matching glob as context (repeatable)",
		collect,
		[],
	)
	.option("--budget <usd>", "Session budget cap in USD")
	.action(
		wrapCommandAction(async (prompt, options) => {
			const { runCommand } = await import("./commands/run.js");
			await runCommand(
				prompt as string,
				options as import("./commands/run.js").RunOptions,
			);
		}),
	);

// Chat command (interactive AI REPL)
program
	.command("chat")
	.description("Start an interactive AI coding chat session")
	.option(
		"--model <id>",
		"Use specific model (e.g. anthropic:claude-sonnet-4-20250514)",
	)
	.option(
		"--provider <name>",
		"Use specific provider (anthropic, openai, google, openrouter)",
	)
	.option("--tier <tier>", "Use model tier: cheap, mid, or strong")
	.option("--budget <usd>", "Session budget cap in USD")
	.action(
		wrapCommandAction(async (options) => {
			const { chatCommand } = await import("./commands/chat.js");
			await chatCommand(options as import("./commands/chat.js").ChatOptions);
		}),
	);

// Models command
program
	.command("models")
	.description("List available AI models with pricing and routing config")
	.action(
		wrapCommandAction(async () => {
			const { modelsCommand } = await import("./commands/models.js");
			modelsCommand();
		}),
	);

// Provider command
program
	.command("provider <action> [name]")
	.description("Manage AI provider API keys (add, list, test, remove)")
	.action(
		wrapCommandAction(async (action, name) => {
			const { providerCommand } = await import("./commands/provider.js");
			await providerCommand(
				action as string | undefined,
				name as string | undefined,
			);
		}),
	);

// History command
program
	.command("history")
	.description("View past AI session history with costs")
	.option(
		"--tool <tool>",
		"Filter by tool (e.g., kova_orchestrator, claude_code)",
	)
	.option("--project <name>", "Filter by project name")
	.option("--days <n>", "Look back N days (default: 30)")
	.option("--limit <n>", "Max sessions to show (default: 50)")
	.action(
		wrapCommandAction(async (options) => {
			const { historyCommand } = await import("./commands/history.js");
			await historyCommand(
				options as import("./commands/history.js").HistoryOptions,
			);
		}),
	);

// Bench command
program
	.command("bench <prompt>")
	.description("Benchmark a prompt against multiple models")
	.option(
		"--models <list>",
		"Comma-separated model names (e.g., sonnet,gpt-4o,gemini-pro)",
	)
	.option("--no-tools", "Disable tools for pure text comparison")
	.action(
		wrapCommandAction(async (prompt, options) => {
			const { benchCommand } = await import("./commands/bench.js");
			await benchCommand(
				prompt as string,
				options as import("./commands/bench.js").BenchOptions,
			);
		}),
	);

// Hook command
program
	.command("hook [action]")
	.description("Manage Claude Code integration hooks")
	.action(
		wrapCommandAction(async (action) => {
			const { hookCommand } = await import("./commands/hook.js");
			await hookCommand(action as string | undefined);
		}),
	);

// MCP command
program
	.command("mcp")
	.description("Start Kova as an MCP server (stdio transport)")
	.action(
		wrapCommandAction(async () => {
			const { mcpCommand } = await import("./commands/mcp.js");
			await mcpCommand();
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

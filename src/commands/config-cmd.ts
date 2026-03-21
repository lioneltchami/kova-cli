import { readConfig, updateConfig } from "../lib/config-store.js";
import {
	getToolKey,
	listConfiguredTools,
	removeToolKey,
	setToolKey,
} from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";
import type { AiTool, KovaFinOpsConfig } from "../types.js";

const VALID_TOOLS: AiTool[] = [
	"claude_code",
	"cursor",
	"copilot",
	"windsurf",
	"devin",
];

const TOOL_KEY_HELP: Partial<Record<AiTool, string>> = {
	cursor: "Cursor Admin API key or WorkosCursorSessionToken cookie",
	copilot: "GitHub PAT with manage_billing:copilot scope",
	windsurf: "Windsurf Enterprise service key",
	devin: "Devin service user token (starts with cog_)",
	claude_code: "Claude Code uses local files -- no API key needed",
};

function maskKey(key: string): string {
	if (key.length <= 8) return key.slice(0, 4) + "...";
	return key.slice(0, 8) + "...";
}

function isValidTool(tool: string): tool is AiTool {
	return (VALID_TOOLS as string[]).includes(tool);
}

export async function configCommand(
	action?: string,
	args?: string[],
): Promise<void> {
	const safeArgs = args ?? [];

	// No action: show config summary
	if (!action) {
		const config = readConfig();
		const configuredTools = listConfiguredTools();

		logger.header("Kova Configuration");

		logger.table([
			["tracking.tools", config.tracking.tools.join(", ") || "(none)"],
			["tracking.auto_sync", String(config.tracking.auto_sync)],
			[
				"tracking.scan_interval",
				String(config.tracking.scan_interval_minutes) + " min",
			],
			[
				"budget.monthly_usd",
				config.budget.monthly_usd !== null
					? "$" + config.budget.monthly_usd.toFixed(2)
					: "(not set)",
			],
			[
				"budget.daily_usd",
				config.budget.daily_usd !== null
					? "$" + config.budget.daily_usd.toFixed(2)
					: "(not set)",
			],
			["budget.warn_at_percent", String(config.budget.warn_at_percent) + "%"],
			["display.show_tokens", String(config.display.show_tokens)],
			[
				"display.show_model_breakdown",
				String(config.display.show_model_breakdown),
			],
		]);

		console.log();

		if (configuredTools.length === 0) {
			logger.info(
				"No tool credentials configured. Use: kova config set-key <tool> <key>",
			);
		} else {
			logger.info("Configured tool credentials:");
			for (const tool of configuredTools) {
				const key = getToolKey(tool);
				const masked = key ? maskKey(key) : "(empty)";
				logger.table([[tool, masked]]);
			}
		}

		return;
	}

	// set-key <tool> <key>
	if (action === "set-key") {
		const toolArg = safeArgs[0];
		const keyArg = safeArgs[1];

		if (!toolArg) {
			logger.error("Usage: kova config set-key <tool> <key>");
			logger.info("Valid tools: " + VALID_TOOLS.join(", "));
			return;
		}

		if (!isValidTool(toolArg)) {
			logger.error(`Invalid tool: "${toolArg}".`);
			logger.info("Valid tools: " + VALID_TOOLS.join(", "));
			return;
		}

		if (!keyArg) {
			logger.error("Usage: kova config set-key <tool> <key>");
			logger.info(
				`Expected key format for ${toolArg}: ${TOOL_KEY_HELP[toolArg]}`,
			);
			return;
		}

		setToolKey(toolArg, keyArg);

		logger.success(`API key stored for ${toolArg}: ${maskKey(keyArg)}`);
		logger.info(`Tip: ${TOOL_KEY_HELP[toolArg]}`);
		return;
	}

	// remove-key <tool>
	if (action === "remove-key") {
		const toolArg = safeArgs[0];

		if (!toolArg) {
			logger.error("Usage: kova config remove-key <tool>");
			logger.info("Valid tools: " + VALID_TOOLS.join(", "));
			return;
		}

		if (!isValidTool(toolArg)) {
			logger.error(`Invalid tool: "${toolArg}".`);
			logger.info("Valid tools: " + VALID_TOOLS.join(", "));
			return;
		}

		removeToolKey(toolArg);
		logger.success(`Removed API key for ${toolArg}.`);
		return;
	}

	// show-keys
	if (action === "show-keys") {
		const configuredTools = listConfiguredTools();

		if (configuredTools.length === 0) {
			logger.info(
				"No tool credentials configured. Use: kova config set-key <tool> <key>",
			);
			return;
		}

		logger.header("Configured Tool Credentials");

		const rows: [string, string][] = configuredTools.map((tool) => {
			const key = getToolKey(tool);
			return [tool, key ? maskKey(key) : "(empty)"];
		});
		logger.table(rows);
		return;
	}

	// set <key> <value>
	if (action === "set") {
		const keyArg = safeArgs[0];
		const valueArg = safeArgs[1];

		if (!keyArg || valueArg === undefined) {
			logger.error("Usage: kova config set <key> <value>");
			logger.info(
				"Supported keys: tracking.tools, tracking.auto_sync, tracking.scan_interval_minutes,",
			);
			logger.info(
				"                display.show_tokens, display.show_model_breakdown,",
			);
			logger.info(
				"                budget.monthly_usd, budget.daily_usd, budget.warn_at_percent,",
			);
			logger.info(
				"                routing.simple, routing.moderate, routing.complex,",
			);
			logger.info(
				"                orchestration.fallback, orchestration.session_budget",
			);
			return;
		}

		const partial = buildPartialConfig(keyArg, valueArg);

		if (!partial) {
			logger.error(`Unknown config key: "${keyArg}".`);
			logger.info(
				"Supported keys: tracking.tools, tracking.auto_sync, tracking.scan_interval_minutes,",
			);
			logger.info(
				"                display.show_tokens, display.show_model_breakdown,",
			);
			logger.info(
				"                budget.monthly_usd, budget.daily_usd, budget.warn_at_percent,",
			);
			logger.info(
				"                routing.simple, routing.moderate, routing.complex,",
			);
			logger.info(
				"                orchestration.fallback, orchestration.session_budget",
			);
			return;
		}

		updateConfig(partial);
		logger.success(`Config updated: ${keyArg} = ${valueArg}`);
		return;
	}

	logger.error(
		`Unknown config action: "${action}". Use set-key, remove-key, show-keys, set, or omit action to show config.`,
	);
}

function buildPartialConfig(
	key: string,
	value: string,
): Partial<KovaFinOpsConfig> | null {
	switch (key) {
		case "tracking.tools": {
			const tools = value
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0) as AiTool[];
			return { tracking: { tools } as KovaFinOpsConfig["tracking"] };
		}
		case "tracking.auto_sync": {
			const bool = parseBoolean(value);
			if (bool === null) return null;
			return { tracking: { auto_sync: bool } as KovaFinOpsConfig["tracking"] };
		}
		case "tracking.scan_interval_minutes": {
			const num = parseNumber(value);
			if (num === null) return null;
			return {
				tracking: {
					scan_interval_minutes: num,
				} as KovaFinOpsConfig["tracking"],
			};
		}
		case "display.show_tokens": {
			const bool = parseBoolean(value);
			if (bool === null) return null;
			return {
				display: { show_tokens: bool } as KovaFinOpsConfig["display"],
			};
		}
		case "display.show_model_breakdown": {
			const bool = parseBoolean(value);
			if (bool === null) return null;
			return {
				display: {
					show_model_breakdown: bool,
				} as KovaFinOpsConfig["display"],
			};
		}
		case "budget.monthly_usd": {
			const num = parseNumber(value);
			if (num === null) return null;
			return {
				budget: { monthly_usd: num } as KovaFinOpsConfig["budget"],
			};
		}
		case "budget.daily_usd": {
			const num = parseNumber(value);
			if (num === null) return null;
			return {
				budget: { daily_usd: num } as KovaFinOpsConfig["budget"],
			};
		}
		case "budget.warn_at_percent": {
			const num = parseNumber(value);
			if (num === null) return null;
			return {
				budget: { warn_at_percent: num } as KovaFinOpsConfig["budget"],
			};
		}
		case "routing.simple":
			return { orchestration: { routing: { simple: value } } } as any;
		case "routing.moderate":
			return { orchestration: { routing: { moderate: value } } } as any;
		case "routing.complex":
			return { orchestration: { routing: { complex: value } } } as any;
		case "orchestration.fallback": {
			const bool = parseBoolean(value);
			if (bool === null) return null;
			return { orchestration: { fallback: bool } } as any;
		}
		case "orchestration.session_budget": {
			const num = parseNumber(value);
			if (num === null) return null;
			return { orchestration: { session_budget: num } } as any;
		}
		default:
			return null;
	}
}

function parseBoolean(value: string): boolean | null {
	if (value === "true") return true;
	if (value === "false") return false;
	return null;
}

function parseNumber(value: string): number | null {
	const num = Number(value);
	if (isNaN(num)) return null;
	return num;
}

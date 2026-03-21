import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readConfig } from "../lib/config-store.js";
import { VERSION } from "../lib/constants.js";
import { aggregateCosts } from "../lib/cost-calculator.js";
import { formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import type { AiTool } from "../types.js";

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({
		name: "kova",
		version: VERSION,
	});

	// -- Resources --

	server.resource("costs-today", "kova://costs/today", async (uri) => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const records = queryRecords({ since: today });
		const summary = aggregateCosts(records);
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(
						{
							period: "today",
							total_cost_usd: summary.total_cost_usd,
							total_sessions: summary.total_sessions,
							total_input_tokens: summary.total_input_tokens,
							total_output_tokens: summary.total_output_tokens,
							by_tool: summary.by_tool,
							by_model: summary.by_model,
						},
						null,
						2,
					),
				},
			],
		};
	});

	server.resource("costs-week", "kova://costs/week", async (uri) => {
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		const records = queryRecords({ since: weekAgo });
		const summary = aggregateCosts(records);
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(
						{
							period: "last_7_days",
							total_cost_usd: summary.total_cost_usd,
							total_sessions: summary.total_sessions,
							by_day: summary.by_day,
							by_tool: summary.by_tool,
							by_model: summary.by_model,
						},
						null,
						2,
					),
				},
			],
		};
	});

	server.resource("budget-status", "kova://budget/status", async (uri) => {
		const config = readConfig();
		const now = new Date();

		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const monthRecords = queryRecords({ since: monthStart });
		const monthCost = monthRecords.reduce((sum, r) => sum + r.cost_usd, 0);

		const dayStart = new Date(now);
		dayStart.setHours(0, 0, 0, 0);
		const dayRecords = queryRecords({ since: dayStart });
		const dayCost = dayRecords.reduce((sum, r) => sum + r.cost_usd, 0);

		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(
						{
							monthly: {
								budget_usd: config.budget.monthly_usd,
								spent_usd: monthCost,
								percent: config.budget.monthly_usd
									? (monthCost / config.budget.monthly_usd) * 100
									: null,
							},
							daily: {
								budget_usd: config.budget.daily_usd,
								spent_usd: dayCost,
								percent: config.budget.daily_usd
									? (dayCost / config.budget.daily_usd) * 100
									: null,
							},
							warn_at_percent: config.budget.warn_at_percent,
						},
						null,
						2,
					),
				},
			],
		};
	});

	// -- Tools --

	server.tool(
		"get_costs",
		"Get AI tool cost summary for a time period",
		{
			period: z.enum(["today", "week", "month", "all"]).default("today"),
			tool: z
				.string()
				.optional()
				.describe("Filter by specific tool (e.g., claude_code, cursor)"),
			project: z.string().optional().describe("Filter by project name"),
		},
		async ({ period, tool, project }) => {
			const since = new Date();
			switch (period) {
				case "today":
					since.setHours(0, 0, 0, 0);
					break;
				case "week":
					since.setDate(since.getDate() - 7);
					break;
				case "month":
					since.setDate(since.getDate() - 30);
					break;
				case "all":
					since.setFullYear(2020);
					break;
			}

			const records = queryRecords({
				tool: tool as AiTool | undefined,
				project,
				since,
			});

			const summary = aggregateCosts(records);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								period,
								total_cost_usd: summary.total_cost_usd,
								formatted_cost: formatMoney(summary.total_cost_usd),
								total_sessions: summary.total_sessions,
								total_tokens:
									summary.total_input_tokens + summary.total_output_tokens,
								by_tool: summary.by_tool,
								by_model: summary.by_model,
								by_project: summary.by_project,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.tool(
		"budget_check",
		"Check current budget status and spending alerts",
		{},
		async () => {
			const config = readConfig();
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const dayStart = new Date(now);
			dayStart.setHours(0, 0, 0, 0);

			const monthRecords = queryRecords({ since: monthStart });
			const dayRecords = queryRecords({ since: dayStart });

			const monthCost = monthRecords.reduce((s, r) => s + r.cost_usd, 0);
			const dayCost = dayRecords.reduce((s, r) => s + r.cost_usd, 0);

			const alerts: string[] = [];
			if (config.budget.monthly_usd && monthCost >= config.budget.monthly_usd) {
				alerts.push(
					`Monthly budget exceeded: ${formatMoney(monthCost)} / ${formatMoney(config.budget.monthly_usd)}`,
				);
			} else if (config.budget.monthly_usd) {
				const pct = (monthCost / config.budget.monthly_usd) * 100;
				if (pct >= config.budget.warn_at_percent) {
					alerts.push(
						`Monthly budget warning: ${formatMoney(monthCost)} / ${formatMoney(config.budget.monthly_usd)} (${pct.toFixed(0)}%)`,
					);
				}
			}
			if (config.budget.daily_usd && dayCost >= config.budget.daily_usd) {
				alerts.push(
					`Daily budget exceeded: ${formatMoney(dayCost)} / ${formatMoney(config.budget.daily_usd)}`,
				);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								monthly_spent: formatMoney(monthCost),
								monthly_budget: config.budget.monthly_usd
									? formatMoney(config.budget.monthly_usd)
									: "not set",
								daily_spent: formatMoney(dayCost),
								daily_budget: config.budget.daily_usd
									? formatMoney(config.budget.daily_usd)
									: "not set",
								alerts,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.tool(
		"track_usage",
		"Trigger a scan of AI tool usage data",
		{
			tool: z.string().optional().describe("Scan only a specific tool"),
		},
		async ({ tool }) => {
			const { trackCommand } = await import("../commands/track.js");
			await trackCommand({ tool });

			return {
				content: [
					{
						type: "text" as const,
						text: "Usage scan completed. Query get_costs to see updated data.",
					},
				],
			};
		},
	);

	// -- Start Server --

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

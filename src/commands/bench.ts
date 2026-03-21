import { stepCountIs, streamText } from "ai";
import crypto from "crypto";
import path from "path";
import { recordAiUsage } from "../lib/ai/cost-recorder.js";
import { getModelDisplayName } from "../lib/ai/model-router.js";
import { createKovaRegistry } from "../lib/ai/provider-registry.js";
import { buildSystemPrompt } from "../lib/ai/system-prompt.js";
import { createCodingTools } from "../lib/ai/tools.js";
import { readConfig } from "../lib/config-store.js";
import { colors, MODEL_TIERS } from "../lib/constants.js";
import { readProviderCredentials } from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";

export interface BenchOptions {
	models?: string;
	noTools?: boolean;
}

interface BenchResult {
	model: string;
	displayName: string;
	responseTime: number;
	inputTokens: number;
	outputTokens: number;
	cost: number;
	responsePreview: string;
	error?: string;
}

export async function benchCommand(
	prompt: string,
	options: BenchOptions,
): Promise<void> {
	const config = readConfig();
	const creds = readProviderCredentials();
	const registry = await createKovaRegistry(creds);

	if (!registry) {
		logger.error("No AI providers configured. Run: kova provider add <name>");
		process.exitCode = 1;
		return;
	}

	// Parse model list
	let modelIds: string[];
	if (options.models) {
		modelIds = options.models.split(",").map((m) => {
			const trimmed = m.trim();
			const tier = MODEL_TIERS[trimmed];
			return tier ? `${tier.provider}:${tier.sdkId}` : trimmed;
		});
	} else {
		// Default: compare routing models
		const routing = config.orchestration?.routing ?? {
			simple: "anthropic:claude-haiku-4-5-20251001",
			moderate: "anthropic:claude-sonnet-4-20250514",
			complex: "anthropic:claude-opus-4-20250115",
		};
		modelIds = [routing.simple, routing.moderate, routing.complex];
	}

	const workingDir = process.cwd();
	const projectName = path.basename(workingDir);
	const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

	logger.header("kova bench");
	logger.info(
		`Prompt: "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);
	logger.info(`Models: ${modelIds.map(getModelDisplayName).join(", ")}`);
	console.log();

	const results: BenchResult[] = [];

	for (const modelId of modelIds) {
		const displayName = getModelDisplayName(modelId);
		process.stdout.write(`  Running ${displayName}...`);

		const startTime = Date.now();

		try {
			const result = streamText({
				model: registry.languageModel(modelId as `${string}:${string}`),
				system: buildSystemPrompt(workingDir),
				prompt,
				tools: options.noTools ? undefined : createCodingTools(workingDir),
				stopWhen: stepCountIs(10),
				maxOutputTokens: config.orchestration?.max_tokens ?? 4096,
				temperature: config.orchestration?.temperature ?? 0,
			});

			let fullResponse = "";
			for await (const chunk of result.textStream) {
				fullResponse += chunk;
			}

			const durationMs = Date.now() - startTime;
			const usage = await result.usage;
			const inputTokens = usage.inputTokens ?? 0;
			const outputTokens = usage.outputTokens ?? 0;

			const record = recordAiUsage({
				modelId: modelId.split(":")[1] ?? modelId,
				usage: { inputTokens, outputTokens },
				sessionId,
				project: projectName,
				durationMs,
			});

			results.push({
				model: modelId,
				displayName,
				responseTime: durationMs,
				inputTokens,
				outputTokens,
				cost: record.cost_usd,
				responsePreview: fullResponse.slice(0, 200).replace(/\n/g, " "),
			});

			process.stdout.write(` done (${(durationMs / 1000).toFixed(1)}s)\n`);
		} catch (err) {
			const durationMs = Date.now() - startTime;
			const message = err instanceof Error ? err.message : String(err);
			results.push({
				model: modelId,
				displayName,
				responseTime: durationMs,
				inputTokens: 0,
				outputTokens: 0,
				cost: 0,
				responsePreview: "",
				error: message.slice(0, 100),
			});
			process.stdout.write(` error\n`);
		}
	}

	// Display comparison table
	console.log();
	logger.header("Results");

	const rows: [string, string][] = [];
	for (const r of results) {
		if (r.error) {
			rows.push([r.displayName, `Error: ${r.error}`]);
		} else {
			rows.push([
				r.displayName,
				`${colors.brand("$" + r.cost.toFixed(4))} | ${(r.responseTime / 1000).toFixed(1)}s | ${(r.inputTokens + r.outputTokens).toLocaleString()} tokens`,
			]);
		}
	}
	logger.table(rows);

	// Response previews
	console.log();
	for (const r of results) {
		if (!r.error && r.responsePreview) {
			logger.info(`${colors.bold(r.displayName)}:`);
			logger.info(
				colors.dim(
					`  ${r.responsePreview}${r.responsePreview.length >= 200 ? "..." : ""}`,
				),
			);
			console.log();
		}
	}

	// Summary
	const successResults = results.filter((r) => !r.error);
	if (successResults.length > 1) {
		const cheapest = successResults.reduce((a, b) => (a.cost < b.cost ? a : b));
		const fastest = successResults.reduce((a, b) =>
			a.responseTime < b.responseTime ? a : b,
		);
		logger.info(
			`Cheapest: ${colors.brand(cheapest.displayName)} ($${cheapest.cost.toFixed(4)})`,
		);
		logger.info(
			`Fastest: ${colors.brand(fastest.displayName)} (${(fastest.responseTime / 1000).toFixed(1)}s)`,
		);
	}
}

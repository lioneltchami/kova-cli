import { stepCountIs, streamText } from "ai";
import crypto from "crypto";
import path from "path";
import { createBudgetGuard } from "../lib/ai/budget-guard.js";
import {
  formatContext,
  loadFiles,
  loadGlob,
} from "../lib/ai/context-loader.js";
import { recordAiUsage } from "../lib/ai/cost-recorder.js";
import { withFallback } from "../lib/ai/fallback.js";
import {
  classifyComplexity,
  getModelDisplayName,
  selectModel,
  tierToComplexity,
} from "../lib/ai/model-router.js";
import { createKovaRegistry } from "../lib/ai/provider-registry.js";
import { buildSystemPrompt } from "../lib/ai/system-prompt.js";
import { createCodingTools } from "../lib/ai/tools.js";
import { readConfig } from "../lib/config-store.js";
import { colors } from "../lib/constants.js";
import { readProviderCredentials } from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";

export interface RunOptions {
  model?: string;
  provider?: string;
  tier?: string;
  dryRun?: boolean;
  autoApply?: boolean;
  context?: string[];
  include?: string[];
  budget?: string;
}

export async function runCommand(
  prompt: string,
  options: RunOptions,
): Promise<void> {
  const config = readConfig();

  // Determine model (works without provider for dry-run)
  let modelId: string;
  if (options.model) {
    modelId = options.model;
  } else if (options.tier) {
    const complexity = tierToComplexity(options.tier);
    modelId = selectModel(complexity, config.orchestration);
  } else {
    const complexity = classifyComplexity(prompt);
    modelId = selectModel(complexity, config.orchestration);
    if (!options.dryRun) {
      logger.info(
        `Complexity: ${complexity} -> ${getModelDisplayName(modelId)}`,
      );
    }
  }

  // Load file context
  let fileContext = "";
  if (options.context?.length || options.include?.length) {
    const contextFiles = options.context
      ? loadFiles(options.context, process.cwd())
      : { files: [], totalBytes: 0, truncated: false };

    const globContext = options.include
      ? await loadGlob(options.include, process.cwd())
      : { files: [], totalBytes: 0, truncated: false };

    // Merge both contexts
    const merged = {
      files: [...contextFiles.files, ...globContext.files],
      totalBytes: contextFiles.totalBytes + globContext.totalBytes,
      truncated: contextFiles.truncated || globContext.truncated,
    };

    fileContext = formatContext(merged);

    if (merged.files.length > 0 && !options.dryRun) {
      logger.info(
        `Context: ${merged.files.length} files (${(merged.totalBytes / 1024).toFixed(0)} KB)`,
      );
    }
  }

  if (options.dryRun) {
    logger.header("Dry Run");
    const tableRows: [string, string][] = [
      ["Prompt", prompt],
      ["Model", modelId],
      ["Complexity", classifyComplexity(prompt)],
      ["Working Dir", process.cwd()],
    ];
    if (fileContext) {
      tableRows.push([
        "Context Files",
        String(options.context?.length ?? 0) +
          " files + " +
          String(options.include?.length ?? 0) +
          " globs",
      ]);
    }
    logger.table(tableRows);
    return;
  }

  const creds = readProviderCredentials();
  const registry = await createKovaRegistry(creds);

  if (!registry) {
    logger.error("No AI providers configured. Run: kova provider add <name>");
    logger.info("Supported providers: anthropic, openai, google, openrouter");
    process.exitCode = 1;
    return;
  }

  const workingDir = process.cwd();
  const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const projectName = path.basename(workingDir);

  logger.header("kova run");
  logger.info(`Model: ${colors.brand(getModelDisplayName(modelId))}`);
  logger.info(`Project: ${projectName}`);
  console.log();

  const budgetUsd = options.budget
    ? parseFloat(options.budget)
    : config.orchestration?.session_budget;
  const budgetGuard = createBudgetGuard(budgetUsd);

  const startTime = Date.now();

  const fallbackEnabled = config.orchestration?.fallback !== false;

  try {
    const { result, modelId: finalModelId } = await withFallback(
      modelId,
      async (currentModelId) => {
        return streamText({
          model: registry.languageModel(
            currentModelId as `${string}:${string}`,
          ),
          system:
            buildSystemPrompt(workingDir) +
            (fileContext ? "\n\n" + fileContext : ""),
          prompt,
          tools: createCodingTools(workingDir),
          stopWhen: stepCountIs(25),
          maxOutputTokens: config.orchestration?.max_tokens ?? 8192,
          temperature: config.orchestration?.temperature ?? 0,
          onStepFinish(event) {
            for (const tc of event.toolCalls) {
              const input = tc.input as Record<string, unknown>;
              const filePath =
                input.filePath ?? input.dirPath ?? input.command ?? "";
              logger.progress("done", tc.toolName, String(filePath));
            }
          },
        });
      },
      fallbackEnabled,
    );

    // Stream text output to terminal
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log();

    const durationMs = Date.now() - startTime;
    const usage = await result.usage;

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    // Record cost (use finalModelId in case fallback switched)
    const record = recordAiUsage({
      modelId: finalModelId.split(":")[1] ?? finalModelId,
      usage: { inputTokens, outputTokens },
      sessionId,
      project: projectName,
      durationMs,
    });

    // Check budget
    if (budgetGuard) {
      const withinBudget = budgetGuard.recordSpend(record.cost_usd);
      if (!withinBudget) {
        logger.error("Session budget exceeded.");
      }
    }

    // Summary
    console.log();
    logger.table([
      ["Cost", colors.brand(`$${record.cost_usd.toFixed(4)}`)],
      [
        "Tokens",
        `${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`,
      ],
      ["Duration", `${(durationMs / 1000).toFixed(1)}s`],
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Run failed: ${message}`);
    process.exitCode = 1;
  }
}

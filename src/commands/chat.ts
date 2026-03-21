import { type ModelMessage, stepCountIs, streamText } from "ai";
import chalk from "chalk";
import crypto from "crypto";
import path from "path";
import readline from "readline";
import { createBudgetGuard } from "../lib/ai/budget-guard.js";
import { recordAiUsage } from "../lib/ai/cost-recorder.js";
import { withFallback } from "../lib/ai/fallback.js";
import {
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

export interface ChatOptions {
  model?: string;
  provider?: string;
  tier?: string;
  budget?: string;
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  const config = readConfig();
  const creds = readProviderCredentials();
  const registry = await createKovaRegistry(creds);

  if (!registry) {
    logger.error("No AI providers configured. Run: kova provider add <name>");
    logger.info("Supported providers: anthropic, openai, google, openrouter");
    process.exitCode = 1;
    return;
  }

  // Determine model
  let modelId: string;
  if (options.model) {
    modelId = options.model;
  } else if (options.tier) {
    const complexity = tierToComplexity(options.tier);
    modelId = selectModel(complexity, config.orchestration);
  } else {
    modelId = selectModel("moderate", config.orchestration);
  }

  const workingDir = process.cwd();
  const messages: ModelMessage[] = [];
  const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const projectName = path.basename(workingDir);
  const session = { costUsd: 0 };

  const budgetUsd = options.budget
    ? parseFloat(options.budget)
    : config.orchestration?.session_budget;
  const budgetGuard = createBudgetGuard(budgetUsd);

  logger.header("kova chat");
  logger.info(`Model: ${colors.brand(getModelDisplayName(modelId))}`);
  logger.info(`Project: ${projectName}`);
  logger.info(
    "Type 'exit' or Ctrl+C to quit. '/model <id>' to switch. '/clear' to reset. '/cost' for session total.",
  );
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.brand("kova> "),
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "exit" || input === "quit") {
      rl.close();
      return;
    }

    // Handle /model command
    if (input.startsWith("/model ")) {
      modelId = input.slice(7).trim();
      logger.info(`Switched to: ${getModelDisplayName(modelId)}`);
      rl.prompt();
      return;
    }

    // Handle /clear command
    if (input === "/clear") {
      messages.length = 0;
      logger.info("Conversation cleared.");
      rl.prompt();
      return;
    }

    // Handle /cost command
    if (input === "/cost") {
      logger.info(
        `Session cost: ${colors.brand("$" + session.costUsd.toFixed(4))}`,
      );
      logger.info(`Turns: ${Math.floor(messages.length / 2)}`);
      if (budgetGuard) {
        const status = budgetGuard.check();
        logger.info(
          `Budget: $${status.spent.toFixed(4)} / $${status.budget.toFixed(2)} (${status.percent.toFixed(0)}%)`,
        );
      }
      rl.prompt();
      return;
    }

    messages.push({ role: "user", content: input });

    const startTime = Date.now();
    try {
      const fallbackEnabled = config.orchestration?.fallback !== false;

      const { result } = await withFallback(
        modelId,
        async (currentModelId) => {
          return streamText({
            model: registry.languageModel(
              currentModelId as `${string}:${string}`,
            ),
            system: buildSystemPrompt(workingDir),
            messages,
            tools: createCodingTools(workingDir),
            stopWhen: stepCountIs(15),
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

      let fullResponse = "";
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      console.log("\n");

      messages.push({ role: "assistant", content: fullResponse });

      const durationMs = Date.now() - startTime;
      const usage = await result.usage;

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      // Record cost
      const record = recordAiUsage({
        modelId: modelId.split(":")[1] ?? modelId,
        usage: { inputTokens, outputTokens },
        sessionId,
        project: projectName,
        durationMs,
      });

      session.costUsd += record.cost_usd;

      // Check budget
      if (budgetGuard) {
        const withinBudget = budgetGuard.recordSpend(record.cost_usd);
        if (!withinBudget) {
          logger.error("Session budget exceeded. Ending chat.");
          rl.close();
          return;
        }
      }

      logger.info(
        chalk.dim(
          `$${record.cost_usd.toFixed(4)} | ${(inputTokens + outputTokens).toLocaleString()} tokens | ${(durationMs / 1000).toFixed(1)}s`,
        ),
      );
      console.log();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${message}`);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    if (session.costUsd > 0) {
      logger.info(
        `Total session cost: ${colors.brand("$" + session.costUsd.toFixed(4))}`,
      );
    }
    logger.success("Chat session ended.");
  });
}

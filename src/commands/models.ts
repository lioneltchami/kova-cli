import chalk from "chalk";
import { getModelDisplayName } from "../lib/ai/model-router.js";
import { readConfig } from "../lib/config-store.js";
import {
  colors,
  DEFAULT_ROUTING,
  MODEL_TIERS,
  TOKEN_COSTS,
} from "../lib/constants.js";
import { listConfiguredProviders } from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";
import type { AiProvider } from "../types.js";

export function modelsCommand(): void {
  const configured = listConfiguredProviders();
  const config = readConfig();
  const routing = config.orchestration?.routing ?? DEFAULT_ROUTING;

  logger.header("Available Models");
  console.log();

  // Header row
  console.log(
    chalk.bold(
      "  Model".padEnd(22) +
        "Provider".padEnd(12) +
        "Tier".padEnd(10) +
        "Input $/1M".padEnd(14) +
        "Output $/1M".padEnd(14) +
        "Status",
    ),
  );
  console.log("  " + "-".repeat(78));

  // List all models from MODEL_TIERS
  for (const [modelName, info] of Object.entries(MODEL_TIERS)) {
    const costs = TOKEN_COSTS[modelName];
    const inputCost = costs ? `$${costs.input.toFixed(2)}` : "N/A";
    const outputCost = costs ? `$${costs.output.toFixed(2)}` : "N/A";
    const isConfigured = configured.includes(info.provider as AiProvider);
    const status = isConfigured
      ? colors.success("Ready")
      : colors.dim("No key");

    const tierColor =
      info.tier === "cheap"
        ? colors.success
        : info.tier === "mid"
          ? colors.warning
          : colors.error;

    console.log(
      "  " +
        colors.bold(modelName.padEnd(20)) +
        info.provider.padEnd(12) +
        tierColor(info.tier.padEnd(10)) +
        inputCost.padEnd(14) +
        outputCost.padEnd(14) +
        status,
    );
  }

  // Current routing config
  console.log();
  logger.header("Current Routing");
  console.log(
    `  simple   -> ${colors.brand(getModelDisplayName(routing.simple))}`,
  );
  console.log(
    `  moderate -> ${colors.brand(getModelDisplayName(routing.moderate))}`,
  );
  console.log(
    `  complex  -> ${colors.brand(getModelDisplayName(routing.complex))}`,
  );
  console.log();

  if (configured.length === 0) {
    logger.warn("No providers configured. Run: kova provider add <name>");
  }
}

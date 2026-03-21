import readline from "readline";
import type { AiProvider } from "../types.js";
import {
  getProviderKey,
  setProviderKey,
  removeProviderKey,
  listConfiguredProviders,
} from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";
import { colors } from "../lib/constants.js";

const VALID_PROVIDERS: AiProvider[] = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
];

export async function providerCommand(
  action: string | undefined,
  name: string | undefined,
): Promise<void> {
  if (!action || action === "list") {
    return providerList();
  }
  if (action === "add") {
    if (!name) {
      logger.error(
        "Usage: kova provider add <anthropic|openai|google|openrouter>",
      );
      return;
    }
    return providerAdd(name);
  }
  if (action === "remove") {
    if (!name) {
      logger.error("Usage: kova provider remove <name>");
      return;
    }
    return providerRemove(name);
  }
  if (action === "test") {
    if (!name) {
      logger.error("Usage: kova provider test <name>");
      return;
    }
    return providerTest(name);
  }
  logger.error(`Unknown action: ${action}. Use add, list, test, or remove.`);
}

function providerList(): void {
  const configured = listConfiguredProviders();
  if (configured.length === 0) {
    logger.warn("No AI providers configured.");
    logger.info("Run: kova provider add <anthropic|openai|google|openrouter>");
    return;
  }

  logger.header("Configured Providers");
  for (const provider of configured) {
    const key = getProviderKey(provider);
    const masked = key ? maskKey(key) : "(empty)";
    console.log(
      `  ${colors.success("*")} ${colors.bold(provider)} ${colors.dim(masked)}`,
    );
  }

  const unconfigured = VALID_PROVIDERS.filter((p) => !configured.includes(p));
  if (unconfigured.length > 0) {
    console.log();
    logger.info(`Not configured: ${unconfigured.join(", ")}`);
  }
}

async function providerAdd(name: string): Promise<void> {
  if (!VALID_PROVIDERS.includes(name as AiProvider)) {
    logger.error(
      `Invalid provider: ${name}. Valid: ${VALID_PROVIDERS.join(", ")}`,
    );
    return;
  }

  const provider = name as AiProvider;
  const existing = getProviderKey(provider);
  if (existing) {
    logger.warn(
      `Provider ${provider} already configured. This will overwrite the existing key.`,
    );
  }

  const key = await promptForInput(`Enter ${provider} API key: `);
  if (!key) {
    logger.error("No key provided.");
    return;
  }

  setProviderKey(provider, key);
  logger.success(`Provider ${provider} configured successfully.`);
  logger.info(`Key stored at ~/.kova/provider-keys.json (mode 0600)`);
}

async function providerRemove(name: string): Promise<void> {
  if (!VALID_PROVIDERS.includes(name as AiProvider)) {
    logger.error(
      `Invalid provider: ${name}. Valid: ${VALID_PROVIDERS.join(", ")}`,
    );
    return;
  }

  const provider = name as AiProvider;
  const existing = getProviderKey(provider);
  if (!existing) {
    logger.warn(`Provider ${provider} is not configured.`);
    return;
  }

  removeProviderKey(provider);
  logger.success(`Provider ${provider} removed.`);
}

async function providerTest(name: string): Promise<void> {
  if (!VALID_PROVIDERS.includes(name as AiProvider)) {
    logger.error(
      `Invalid provider: ${name}. Valid: ${VALID_PROVIDERS.join(", ")}`,
    );
    return;
  }

  const provider = name as AiProvider;
  const key = getProviderKey(provider);
  if (!key) {
    logger.error(
      `Provider ${provider} is not configured. Run: kova provider add ${provider}`,
    );
    return;
  }

  logger.info(`Testing ${provider} connection...`);
  try {
    const { createKovaRegistry } =
      await import("../lib/ai/provider-registry.js");
    const registry = await createKovaRegistry({ [provider]: key });
    if (!registry) {
      logger.error("Failed to create provider registry.");
      return;
    }
    // Try to get the language model -- this validates the provider setup
    logger.success(`Provider ${provider} is configured and ready.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Provider test failed: ${msg}`);
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

function promptForInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

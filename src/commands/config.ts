import {
  addBoundary,
  addRule,
  loadConfig,
  setConfigValue,
} from "../lib/config.js";
import * as logger from "../lib/logger.js";
import type { KovaConfig } from "../types.js";

function flattenConfig(config: KovaConfig): [string, string][] {
  const rows: [string, string][] = [];

  // project
  rows.push(["project.name", config.project.name]);
  rows.push(["project.language", config.project.language]);
  rows.push(["project.framework", config.project.framework]);
  rows.push(["project.package_manager", config.project.package_manager]);

  // models
  rows.push(["models.auto", String(config.models.auto)]);
  rows.push(["models.trivial", config.models.trivial]);
  rows.push(["models.moderate", config.models.moderate]);
  rows.push(["models.complex", config.models.complex]);
  rows.push(["models.planning", config.models.planning]);

  // quality
  rows.push(["quality.test", config.quality.test ?? "(not set)"]);
  rows.push(["quality.lint", config.quality.lint ?? "(not set)"]);
  rows.push(["quality.typecheck", config.quality.typecheck ?? "(not set)"]);
  rows.push(["quality.build", config.quality.build ?? "(not set)"]);
  rows.push([
    "quality.validate_after_each_task",
    String(config.quality.validate_after_each_task),
  ]);
  rows.push([
    "quality.validate_at_end",
    String(config.quality.validate_at_end),
  ]);

  // execution
  rows.push(["execution.default_mode", config.execution.default_mode]);
  rows.push([
    "execution.max_parallel_agents",
    String(config.execution.max_parallel_agents),
  ]);
  rows.push([
    "execution.enable_resume",
    String(config.execution.enable_resume),
  ]);
  rows.push([
    "execution.enable_agent_teams",
    String(config.execution.enable_agent_teams),
  ]);
  rows.push([
    "execution.task_timeout_seconds",
    String(config.execution.task_timeout_seconds),
  ]);

  // usage_tracking
  rows.push(["usage_tracking.enabled", String(config.usage_tracking.enabled)]);
  rows.push(["usage_tracking.plan", config.usage_tracking.plan]);
  rows.push([
    "usage_tracking.warn_at_percent",
    String(config.usage_tracking.warn_at_percent),
  ]);
  rows.push([
    "usage_tracking.pause_at_percent",
    String(config.usage_tracking.pause_at_percent),
  ]);

  // boundaries
  if (config.boundaries.never_touch.length > 0) {
    rows.push([
      "boundaries.never_touch",
      config.boundaries.never_touch.join(", "),
    ]);
  }

  // rules
  if (config.rules.length > 0) {
    rows.push(["rules", `(${config.rules.length} rules)`]);
  }

  return rows;
}

export async function configCommand(
  action?: string,
  args?: string[],
): Promise<void> {
  const projectDir = process.cwd();

  // No action: display full config
  if (!action) {
    const config = await loadConfig(projectDir);
    if (!config) {
      logger.error("No kova.yaml found. Run 'kova init' first.");
      process.exit(1);
    }

    logger.header("Kova Configuration");
    logger.table(flattenConfig(config));

    if (config.rules.length > 0) {
      console.log();
      logger.info("Rules:");
      for (const rule of config.rules) {
        logger.info("  - " + rule);
      }
    }

    if (config.boundaries.never_touch.length > 0) {
      console.log();
      logger.info("Protected patterns (never_touch):");
      for (const pattern of config.boundaries.never_touch) {
        logger.info("  - " + pattern);
      }
    }

    console.log();
    return;
  }

  if (action === "set") {
    const key = args?.[0];
    const value = args?.[1];

    if (!key || value === undefined) {
      logger.error("Usage: kova config set <key> <value>");
      logger.info("Example: kova config set models.trivial haiku");
      process.exit(1);
    }

    try {
      await setConfigValue(projectDir, key, value);
      logger.success(`Set ${key} = ${value}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      if (message.includes("No kova.yaml")) {
        logger.info("Run 'kova init' first to create a kova.yaml.");
      }
      process.exit(1);
    }
    return;
  }

  if (action === "add-rule") {
    const rule = args?.[0];
    if (!rule) {
      logger.error("Usage: kova config add-rule <rule>");
      logger.info(
        'Example: kova config add-rule "Never modify migration files directly"',
      );
      process.exit(1);
    }

    try {
      await addRule(projectDir, rule);
      logger.success(`Added rule: ${rule}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exit(1);
    }
    return;
  }

  if (action === "add-boundary") {
    const boundary = args?.[0];
    if (!boundary) {
      logger.error("Usage: kova config add-boundary <pattern>");
      logger.info('Example: kova config add-boundary "secrets/**"');
      process.exit(1);
    }

    try {
      await addBoundary(projectDir, boundary);
      logger.success(`Added boundary: ${boundary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exit(1);
    }
    return;
  }

  // Unknown action
  logger.error(`Unknown config action: ${action}`);
  logger.info("Available actions: set, add-rule, add-boundary");
  logger.info("Run 'kova config' (no arguments) to view all settings.");
  process.exit(1);
}

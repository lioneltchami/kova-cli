import { aiderCollector } from "../lib/collectors/aider.js";
import { amazonQCollector } from "../lib/collectors/amazon-q.js";
import { boltCollector } from "../lib/collectors/bolt.js";
import { claudeCodeCollector } from "../lib/collectors/claude-code.js";
import { clineCollector } from "../lib/collectors/cline.js";
import { continueDevCollector } from "../lib/collectors/continue-dev.js";
import { copilotCollector } from "../lib/collectors/copilot.js";
import { cursorCollector } from "../lib/collectors/cursor.js";
import { devinCollector } from "../lib/collectors/devin.js";
import { lovableCollector } from "../lib/collectors/lovable.js";
import type { Collector } from "../lib/collectors/types.js";
import { windsurfCollector } from "../lib/collectors/windsurf.js";
import { readConfig } from "../lib/config-store.js";
import { getDailyCosts } from "../lib/cost-calculator.js";
import { isLoggedIn } from "../lib/dashboard.js";
import { parseSinceDate } from "../lib/date-parser.js";
import { formatMoney } from "../lib/formatter.js";
import {
  appendRecords,
  getLastScanTimestamp,
  updateLastScan,
} from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { AiTool } from "../types.js";

export interface TrackOptions {
  since?: string;
  tool?: string;
  daemon?: boolean;
  autoSync?: boolean;
}

// Map tool name strings to their collectors
const COLLECTORS: Record<AiTool, Collector | null> = {
  claude_code: claudeCodeCollector,
  cursor: cursorCollector,
  copilot: copilotCollector,
  devin: devinCollector,
  windsurf: windsurfCollector,
  aider: aiderCollector,
  continue_dev: continueDevCollector,
  cline: clineCollector,
  amazon_q: amazonQCollector,
  bolt: boltCollector,
  lovable: lovableCollector,
};

async function runScan(options: TrackOptions): Promise<void> {
  const config = readConfig();

  // Determine the since date: explicit flag takes precedence, then last scan
  let since: Date | undefined;
  if (options.since) {
    const parsed = parseSinceDate(options.since);
    if (parsed === null) {
      logger.warn(`Invalid date for --since: "${options.since}". Ignoring.`);
    } else {
      since = parsed;
    }
  } else {
    const lastScan = getLastScanTimestamp();
    if (lastScan) {
      since = lastScan;
    }
  }

  // Determine which tools to scan
  const toolsToScan: AiTool[] = options.tool
    ? ([options.tool] as AiTool[]).filter((t) =>
        config.tracking.tools.includes(t),
      )
    : config.tracking.tools;

  if (toolsToScan.length === 0) {
    logger.warn("No enabled tools matched. Check your config or --tool flag.");
    return;
  }

  let totalScannedFiles = 0;
  let totalNewRecords = 0;
  const allRecords: import("../types.js").UsageRecord[] = [];

  for (const tool of toolsToScan) {
    const collector = COLLECTORS[tool];
    if (!collector) {
      logger.debug(`No collector available for tool: ${tool}`);
      continue;
    }

    const available = await collector.isAvailable();
    if (!available) {
      logger.debug(`Collector for ${tool} is not available on this machine.`);
      continue;
    }

    logger.debug(`Collecting usage from: ${tool}`);
    const result = await collector.collect(since);

    totalScannedFiles += result.scanned_paths.length;
    allRecords.push(...result.records);

    for (const err of result.errors) {
      logger.debug(`Collector error (${tool}): ${err}`);
    }
  }

  const added = appendRecords(allRecords);
  totalNewRecords += added;

  updateLastScan();

  // Compute today's spend from the newly added records
  const today = new Date().toISOString().slice(0, 10);
  const dailyCosts = getDailyCosts(allRecords);
  const todaySpend = dailyCosts[today] ?? 0;

  logger.success(
    `Scanned ${totalScannedFiles} files. Found ${totalNewRecords} new usage records. Spend today: ${formatMoney(todaySpend)}`,
  );

  // Auto-sync after scan if requested and user is logged in
  if (options.autoSync && isLoggedIn()) {
    logger.debug("Auto-sync: uploading usage records to dashboard...");
    try {
      const { syncCommand } = await import("./sync.js");
      await syncCommand({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`Auto-sync failed (non-blocking): ${msg}`);
    }
  }

  // Show hints for unconfigured tools
  for (const tool of toolsToScan) {
    const collector = COLLECTORS[tool];
    if (collector && !(await collector.isAvailable())) {
      logger.info(
        `Tip: configure ${tool} with 'kova config set-key ${tool} <key>'`,
      );
      break; // Only show one hint per scan
    }
  }
}

export async function trackCommand(options: TrackOptions = {}): Promise<void> {
  if (!options.daemon) {
    await runScan(options);
    return;
  }

  // Daemon mode: run continuously at configured interval
  const config = readConfig();
  const intervalMs = (config.tracking.scan_interval_minutes ?? 60) * 60 * 1000;

  logger.info(
    `Daemon mode: scanning every ${config.tracking.scan_interval_minutes} minute(s). Press Ctrl+C to stop.`,
  );

  // Run immediately on start
  await runScan(options);

  const timer = setInterval(() => {
    runScan(options).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Scan error: ${msg}`);
    });
  }, intervalMs);

  // Allow the process to exit when no other work is pending
  timer.unref();

  // Handle SIGINT (Ctrl+C) to stop cleanly
  process.on("SIGINT", () => {
    clearInterval(timer);
    logger.info("Daemon stopped.");
    process.exit(0);
  });

  // Keep process alive
  await new Promise<void>(() => {
    // Never resolves -- daemon runs until SIGINT
  });
}

import {
  checkSubscription,
  isLoggedIn,
  readCredentials,
  storeCredentials,
} from "../lib/dashboard.js";
import { parseSinceDate } from "../lib/date-parser.js";
import { formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import { uploadUsage } from "../lib/uploader.js";

export interface SyncOptions {
  since?: string;
  dryRun?: boolean;
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  if (!isLoggedIn()) {
    logger.info("Please run 'kova login <api-key>' first.");
    return;
  }

  // Plan enforcement: free plan cannot use cloud sync
  const creds = readCredentials();
  if (creds?.plan === "free") {
    let liveResult: { plan: string; active: boolean } | null = null;
    try {
      liveResult = await checkSubscription();
    } catch {
      // Network error -- allow sync to proceed (offline-tolerant)
      liveResult = null;
    }

    if (liveResult !== null) {
      if (liveResult.plan === "free" || !liveResult.active) {
        logger.warn("Cloud sync requires a Kova Pro subscription.");
        logger.info("Upgrade at: kova.dev/pricing");
        logger.info("Already subscribed? Run: kova login <new-api-key>");
        return;
      }
      // Live check returned pro/enterprise -- update cached credentials
      const updatedCreds = {
        ...creds,
        plan: liveResult.plan as "free" | "pro" | "team" | "enterprise",
        cachedAt: new Date().toISOString(),
      };
      storeCredentials(updatedCreds);
    }
    // If liveResult is null (network error), fall through and allow sync
  }

  let since: Date | undefined;
  if (options.since) {
    const parsed = parseSinceDate(options.since);
    if (parsed === null) {
      logger.warn(`Invalid date for --since: "${options.since}". Ignoring.`);
    } else {
      since = parsed;
    }
  }

  const records = queryRecords({ since });

  if (records.length === 0) {
    logger.info("No usage records to sync. Run 'kova track' first.");
    return;
  }

  const totalCost = records.reduce((sum, r) => sum + r.cost_usd, 0);

  if (options.dryRun) {
    logger.info(
      `Dry run: ${records.length} records would be synced (total ${formatMoney(totalCost)}).`,
    );
    return;
  }

  logger.info(`Uploading ${records.length} records...`);

  const result = await uploadUsage(records);

  if (result.success) {
    logger.success(
      `Synced ${result.accepted} records (${formatMoney(totalCost)}) to Kova dashboard.`,
    );
    if (result.duplicates > 0) {
      logger.info(
        `${result.duplicates} duplicate record(s) skipped (already uploaded).`,
      );
    }
    logger.info("View your data at kova.dev/dashboard");
  } else {
    logger.warn(
      "Some records failed to upload. Check your connection and try again.",
    );
  }
}

import { isLoggedIn } from "../lib/dashboard.js";
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

  let since: Date | undefined;
  if (options.since) {
    const parsed = new Date(options.since);
    if (isNaN(parsed.getTime())) {
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

  const success = await uploadUsage(records);

  if (success) {
    logger.success(
      `Synced ${records.length} records (${formatMoney(totalCost)}) to Kova dashboard.`,
    );
    logger.info("View your data at kova.dev/dashboard");
  } else {
    logger.warn(
      "Some records failed to upload. Check your connection and try again.",
    );
  }
}

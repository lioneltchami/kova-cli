import { isLoggedIn, readCredentials } from "../lib/dashboard.js";
import * as logger from "../lib/logger.js";

export async function accountCommand(): Promise<void> {
  if (!isLoggedIn()) {
    logger.header("Kova Account");
    logger.table([
      ["plan", "Free"],
      ["status", "not logged in"],
    ]);
    console.log();
    logger.info("Upgrade to Pro for team cost dashboard and budget alerts.");
    logger.info("Get started at kova.dev/dashboard");
    logger.info("Then run: kova login <your-api-key>");
    return;
  }

  const creds = readCredentials();
  if (!creds) {
    logger.error("Could not read credentials.");
    return;
  }

  const keyPrefix = creds.apiKey.slice(0, 12) + "...";

  logger.header("Kova Account");
  logger.table([
    ["plan", creds.plan],
    ["email", creds.email || "(not cached)"],
    ["api key", keyPrefix],
    ["dashboard", creds.dashboardUrl || "kova.dev/dashboard"],
  ]);
  console.log();
  logger.info("Manage your account at kova.dev/dashboard/settings");
}

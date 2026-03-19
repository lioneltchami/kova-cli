import { isLoggedIn, removeCredentials } from "../lib/dashboard.js";
import * as logger from "../lib/logger.js";

export async function logoutCommand(): Promise<void> {
  if (!isLoggedIn()) {
    logger.info("Not logged in.");
    return;
  }

  removeCredentials();
  logger.success("Logged out successfully.");
  logger.info("Your local credentials have been removed.");
}

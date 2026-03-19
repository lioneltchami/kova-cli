import { DASHBOARD_API_URL } from "../lib/constants.js";
import {
  checkSubscription,
  isLoggedIn,
  storeCredentials,
} from "../lib/dashboard.js";
import * as logger from "../lib/logger.js";
import type { DashboardCredentials } from "../types.js";

export interface LoginOptions {
  key?: string;
}

export async function loginCommand(
  apiKey: string | undefined,
  _options: LoginOptions = {},
): Promise<void> {
  if (!apiKey) {
    logger.info("Get your API key from kova.dev/dashboard/settings");
    logger.info("Then run: kova login <your-api-key>");
    return;
  }

  if (isLoggedIn()) {
    logger.info("Already logged in. Updating credentials...");
  }

  // Build a temporary credentials object pointing to the dashboard URL
  // so checkSubscription() can use it
  const tempCreds: DashboardCredentials = {
    apiKey,
    dashboardUrl: DASHBOARD_API_URL.replace("/api/v1", ""),
    userId: "",
    email: "",
    plan: "free",
    cachedAt: new Date().toISOString(),
  };

  // Temporarily store so checkSubscription reads the right key
  storeCredentials(tempCreds);

  logger.info("Validating API key...");

  const subscription = await checkSubscription();

  if (subscription) {
    const creds: DashboardCredentials = {
      apiKey,
      dashboardUrl: DASHBOARD_API_URL.replace("/api/v1", ""),
      userId: "",
      email: "",
      plan: subscription.plan as DashboardCredentials["plan"],
      cachedAt: new Date().toISOString(),
    };
    storeCredentials(creds);
    logger.success(`Logged in successfully.`);
    logger.info(`Plan: ${subscription.plan}`);
    logger.info(`Dashboard: kova.dev/dashboard`);
  } else {
    // Network failure or invalid key -- store anyway so user can work offline
    // The key will be validated on the next API call
    logger.warn(
      "Could not validate API key (network unavailable or key invalid).",
    );
    logger.info(
      "Credentials stored. They will be validated on the next build upload.",
    );
    logger.info(
      "If your key is invalid, dashboard uploads will silently fail.",
    );
  }
}

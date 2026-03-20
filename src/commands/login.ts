import { DASHBOARD_API_URL } from "../lib/constants.js";
import {
  checkSubscription,
  isLoggedIn,
  removeCredentials,
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

  let subscription: { plan: string; active: boolean } | null = null;
  let networkError = false;

  try {
    subscription = await checkSubscription();
  } catch {
    // Unexpected error from checkSubscription itself (should not normally throw)
    networkError = true;
  }

  // checkSubscription returns null on both network error and auth error.
  // Distinguish by attempting a direct fetch to detect 401 vs connection failure.
  if (subscription === null && !networkError) {
    // Try a quick auth probe to determine if null was auth failure or network failure
    const creds = tempCreds;
    let probeIsAuthError = false;
    try {
      const probeResponse = await fetch(
        `${creds.dashboardUrl}/api/v1/subscription`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      // A 401 or 403 is definitively an auth failure
      if (probeResponse.status === 401 || probeResponse.status === 403) {
        probeIsAuthError = true;
      }
      // Any other non-ok response (500, etc.) we treat as network/server issue
    } catch {
      // Connection failure -- treat as network error (offline tolerance)
      networkError = true;
    }

    if (probeIsAuthError) {
      // Remove credentials since the key is definitively invalid
      removeCredentials();
      logger.error(
        "API key is invalid or unauthorized. Credentials were not stored.",
      );
      logger.info("Get your API key from kova.dev/dashboard/settings");
      return;
    }
  }

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
    // Network failure -- keep credentials stored for offline tolerance
    logger.warn(
      "Could not validate API key (network unavailable or server error).",
    );
    logger.info(
      "Credentials stored. They will be validated on the next build upload.",
    );
    logger.info(
      "If your key is invalid, dashboard uploads will silently fail.",
    );
  }
}

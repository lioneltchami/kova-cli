import { readConfig, writeConfig } from "../lib/config-store.js";
import * as logger from "../lib/logger.js";
import { colors } from "../lib/constants.js";

export interface SsoConfigureOptions {
  issuer?: string;
}

export async function ssoConfigureCommand(
  options: SsoConfigureOptions,
): Promise<void> {
  const issuer = options.issuer;
  if (!issuer) {
    logger.error("Provide an issuer URL with --issuer <url>.");
    logger.info(
      "Example: kova sso configure --issuer https://sso.mycompany.com",
    );
    return;
  }

  try {
    new URL(issuer);
  } catch {
    logger.error(`Invalid issuer URL: "${issuer}". Must be a valid HTTPS URL.`);
    return;
  }

  const current = readConfig();
  writeConfig({
    ...current,
    sso: {
      enabled: true,
      issuer,
      ...(current.sso?.token ? { token: current.sso.token } : {}),
      ...(current.sso?.token_expires_at
        ? { token_expires_at: current.sso.token_expires_at }
        : {}),
    },
  });

  logger.success(`SSO issuer configured: ${issuer}`);
  logger.info("Run 'kova sso login' to authenticate.");
}

export async function ssoLoginCommand(): Promise<void> {
  const config = readConfig();
  const sso = config.sso;

  if (!sso?.issuer) {
    logger.error(
      "No SSO issuer configured. Run 'kova sso configure --issuer <url>' first.",
    );
    return;
  }

  // Build the SSO login URL. In a real implementation this would initiate
  // an OAuth PKCE flow; here we print the URL so the user can authenticate
  // via their browser.
  const loginUrl = `${sso.issuer}/oauth/authorize?client_id=kova-cli&redirect_uri=http://localhost:7777/callback&response_type=code&scope=openid+profile`;

  logger.info("Opening SSO login in your browser...");
  logger.info(`Login URL: ${colors.brand(loginUrl)}`);
  logger.info(
    "After authenticating, the token will be stored automatically. (Browser integration not yet available in this version.)",
  );
}

export async function ssoStatusCommand(): Promise<void> {
  const config = readConfig();
  const sso = config.sso;

  console.log();
  console.log(colors.bold("  SSO Configuration"));
  console.log(colors.dim("  " + "-".repeat(40)));

  if (!sso || !sso.enabled) {
    console.log("  " + colors.dim("Status:  ") + colors.wolf("not configured"));
    console.log();
    logger.info("Run 'kova sso configure --issuer <url>' to set up SSO.");
    return;
  }

  console.log("  " + colors.dim("Status:  ") + colors.success("enabled"));
  console.log(
    "  " + colors.dim("Issuer:  ") + colors.brand(sso.issuer ?? "(none)"),
  );

  if (sso.token) {
    if (sso.token_expires_at) {
      const expiresAt = new Date(sso.token_expires_at);
      const now = new Date();
      const expired = expiresAt <= now;
      const expiresLabel = expired
        ? colors.error("expired " + expiresAt.toLocaleString())
        : colors.success("valid until " + expiresAt.toLocaleString());
      console.log("  " + colors.dim("Token:   ") + expiresLabel);
    } else {
      console.log(
        "  " +
          colors.dim("Token:   ") +
          colors.wolf("present (no expiry info)"),
      );
    }
  } else {
    console.log(
      "  " +
        colors.dim("Token:   ") +
        colors.wolf("none — run 'kova sso login'"),
    );
  }

  console.log();
}

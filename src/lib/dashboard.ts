import fs from "fs";
import os from "os";
import path from "path";
import type { DashboardCredentials } from "../types.js";
import * as logger from "./logger.js";

export function getCredentialsPath(): string {
  return path.join(os.homedir(), ".kova", "credentials.json");
}

export function storeCredentials(creds: DashboardCredentials): void {
  const dir = path.dirname(getCredentialsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCredentialsPath(), JSON.stringify(creds, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function readCredentials(): DashboardCredentials | null {
  try {
    return JSON.parse(
      fs.readFileSync(getCredentialsPath(), "utf-8"),
    ) as DashboardCredentials;
  } catch {
    return null;
  }
}

export function removeCredentials(): void {
  try {
    fs.unlinkSync(getCredentialsPath());
  } catch {
    /* ok */
  }
}

export function isLoggedIn(): boolean {
  return readCredentials() !== null;
}

export async function checkSubscription(): Promise<{
  plan: string;
  active: boolean;
} | null> {
  const creds = readCredentials();
  if (!creds?.apiKey) return null;

  try {
    const response = await fetch(`${creds.dashboardUrl}/api/v1/subscription`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as { plan: string; active: boolean };
  } catch {
    logger.debug("Subscription check failed (non-blocking).");
    return null;
  }
}

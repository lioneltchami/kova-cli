import fs from "fs";
import os from "os";
import path from "path";

interface UpdateCheckCache {
  lastCheck: string;
  latestVersion: string;
}

let pendingResult: string | null = null;

export function getCachePath(): string {
  return path.join(os.homedir(), ".kova", "update-check.json");
}

export function readCache(): UpdateCheckCache | null {
  try {
    const raw = fs.readFileSync(getCachePath(), "utf-8");
    return JSON.parse(raw) as UpdateCheckCache;
  } catch {
    return null;
  }
}

export function writeCache(cache: UpdateCheckCache): void {
  const dir = path.dirname(getCachePath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCachePath(), JSON.stringify(cache), "utf-8");
}

export function isCacheValid(cache: UpdateCheckCache): boolean {
  const lastCheck = new Date(cache.lastCheck).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return now - lastCheck < twentyFourHours;
}

function compareVersions(current: string, latest: string): boolean {
  // Returns true if latest > current (simple semver comparison)
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForUpdate(
  currentVersion: string,
): Promise<string | null> {
  if (process.env["KOVA_NO_UPDATE_CHECK"] === "1") {
    return null;
  }

  // Check cache first
  const cache = readCache();
  if (cache && isCacheValid(cache)) {
    return compareVersions(currentVersion, cache.latestVersion)
      ? cache.latestVersion
      : null;
  }

  // Fetch from npm registry
  try {
    const response = await fetch("https://registry.npmjs.org/kova-cli/latest", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { version?: string };
    const latestVersion = data.version;

    if (!latestVersion) return null;

    // Write cache
    try {
      writeCache({ lastCheck: new Date().toISOString(), latestVersion });
    } catch {
      // Cache write failure is non-fatal
    }

    return compareVersions(currentVersion, latestVersion)
      ? latestVersion
      : null;
  } catch {
    return null;
  }
}

export function checkForUpdateBackground(currentVersion: string): void {
  void checkForUpdate(currentVersion).then((result) => {
    if (result) {
      pendingResult = result;
    }
  });
}

export function getUpdateResult(): string | null {
  return pendingResult;
}

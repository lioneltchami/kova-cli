import fs from "node:fs";
import path from "node:path";
import { KOVA_DATA_DIR } from "./constants.js";

const SYNCED_FILE = "synced-ids.json";

function getSyncedFilePath(): string {
  return path.join(KOVA_DATA_DIR, SYNCED_FILE);
}

export function getSyncedIds(): Set<string> {
  const filePath = getSyncedFilePath();
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return new Set(JSON.parse(data) as string[]);
  } catch {
    return new Set();
  }
}

export function markAsSynced(ids: string[]): void {
  const existing = getSyncedIds();
  for (const id of ids) existing.add(id);
  // Keep only last 50k IDs to prevent unbounded growth
  const arr = [...existing];
  const trimmed = arr.length > 50_000 ? arr.slice(arr.length - 50_000) : arr;
  const filePath = getSyncedFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(trimmed), { mode: 0o600 });
}

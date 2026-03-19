import fs from "fs";
import path from "path";
import type { AiTool, UsageDatabase, UsageRecord } from "../types.js";
import { KOVA_DATA_DIR, USAGE_FILE } from "./constants.js";

export function getUsageDatabasePath(): string {
  return path.join(KOVA_DATA_DIR, USAGE_FILE);
}

export function readUsageDatabase(): UsageDatabase {
  const dbPath = getUsageDatabasePath();
  try {
    const raw = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.records)
    ) {
      return { version: 1, last_scan: null, records: [] };
    }
    return parsed as UsageDatabase;
  } catch {
    return { version: 1, last_scan: null, records: [] };
  }
}

export function writeUsageDatabase(db: UsageDatabase): void {
  const dbPath = getUsageDatabasePath();
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = dbPath + ".tmp." + process.pid.toString();
  const content = JSON.stringify(db, null, 2);

  try {
    fs.writeFileSync(tmpPath, content, "utf-8");
    try {
      // Atomic rename (POSIX) - preferred approach
      fs.renameSync(tmpPath, dbPath);
    } catch {
      // Windows fallback: copy then delete temp file
      fs.copyFileSync(tmpPath, dbPath);
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // If cleanup fails, not critical
      }
    }
  } catch (err) {
    // Clean up temp file on write failure
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

export function appendRecords(records: UsageRecord[]): number {
  if (records.length === 0) return 0;

  const db = readUsageDatabase();
  const existingIds = new Set(db.records.map((r) => r.id));

  let added = 0;
  for (const record of records) {
    if (!existingIds.has(record.id)) {
      db.records.push(record);
      existingIds.add(record.id);
      added++;
    }
  }

  if (added > 0) {
    writeUsageDatabase(db);
  }

  return added;
}

export function queryRecords(options: {
  tool?: AiTool;
  since?: Date;
  until?: Date;
  project?: string;
}): UsageRecord[] {
  const db = readUsageDatabase();
  let results = db.records;

  if (options.tool !== undefined) {
    results = results.filter((r) => r.tool === options.tool);
  }

  if (options.since !== undefined) {
    const since = options.since;
    results = results.filter((r) => new Date(r.timestamp) >= since);
  }

  if (options.until !== undefined) {
    const until = options.until;
    results = results.filter((r) => new Date(r.timestamp) <= until);
  }

  if (options.project !== undefined) {
    const project = options.project;
    results = results.filter((r) => r.project === project);
  }

  return results;
}

export function getLastScanTimestamp(): Date | null {
  const db = readUsageDatabase();
  if (!db.last_scan) return null;
  return new Date(db.last_scan);
}

export function updateLastScan(): void {
  const db = readUsageDatabase();
  db.last_scan = new Date().toISOString();
  writeUsageDatabase(db);
}

export function pruneOldRecords(olderThan: Date): number {
  const db = readUsageDatabase();
  const before = db.records.length;
  db.records = db.records.filter((r) => new Date(r.timestamp) >= olderThan);
  const removed = before - db.records.length;

  if (removed > 0) {
    writeUsageDatabase(db);
  }

  return removed;
}

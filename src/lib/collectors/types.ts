import type { UsageRecord } from "../../types.js";

export interface CollectorResult {
  tool: string;
  records: UsageRecord[];
  errors: string[];
  scanned_paths: string[];
}

export interface Collector {
  name: string;
  isAvailable(): Promise<boolean>;
  collect(since?: Date): Promise<CollectorResult>;
}

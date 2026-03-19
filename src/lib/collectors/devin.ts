import crypto from "crypto";
import type { UsageRecord } from "../../types.js";
import { DEVIN_ACU_COST_TEAMS } from "../constants.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

const DEVIN_API_BASE = "https://api.devin.ai/v3/enterprise/consumption/daily";
const TIMEOUT_MS = 15_000;

interface AcusByProduct {
  devin?: number;
  cascade?: number;
  terminal?: number;
}

interface DailyConsumptionEntry {
  date?: number; // unix timestamp
  acus?: number;
  acus_by_product?: AcusByProduct;
}

interface DevinResponse {
  total_acus?: number;
  consumption_by_date?: DailyConsumptionEntry[];
}

function makeId(date: string, acus: number): string {
  return crypto
    .createHash("sha256")
    .update(`devin:${date}:${acus}`)
    .digest("hex")
    .slice(0, 16);
}

export const devinCollector: Collector = {
  name: "devin",

  async isAvailable(): Promise<boolean> {
    return getToolKey("devin") !== null;
  },

  async collect(since?: Date): Promise<CollectorResult> {
    const errors: string[] = [];
    const records: UsageRecord[] = [];

    const key = getToolKey("devin");
    if (!key) {
      return { tool: "devin", records: [], errors: [], scanned_paths: [] };
    }

    const now = new Date();
    const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeAfter = Math.floor((since ?? defaultSince).getTime() / 1000);
    const timeBefore = Math.floor(now.getTime() / 1000);

    const url = `${DEVIN_API_BASE}?time_after=${timeAfter}&time_before=${timeBefore}`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Devin API network error: ${msg}`);
      return { tool: "devin", records: [], errors, scanned_paths: [] };
    }

    if (response.status === 401) {
      errors.push(
        "Devin API returned 401 Unauthorized. Check your service user token.",
      );
      return { tool: "devin", records: [], errors, scanned_paths: [] };
    }

    if (response.status === 403) {
      errors.push(
        "Devin API returned 403 Forbidden. Ensure your token has enterprise consumption access.",
      );
      return { tool: "devin", records: [], errors, scanned_paths: [] };
    }

    if (!response.ok) {
      errors.push(`Devin API returned HTTP ${response.status}.`);
      return { tool: "devin", records: [], errors, scanned_paths: [] };
    }

    let data: DevinResponse;
    try {
      data = (await response.json()) as DevinResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Devin API JSON parse error: ${msg}`);
      return { tool: "devin", records: [], errors, scanned_paths: [] };
    }

    const entries = data?.consumption_by_date ?? [];

    for (const entry of entries) {
      const unixDate = entry.date ?? 0;
      const acus = entry.acus ?? 0;
      const acusByProduct = entry.acus_by_product ?? {};

      // Convert unix timestamp to ISO date string
      const dateIso = new Date(unixDate * 1000).toISOString();
      const cost = acus * DEVIN_ACU_COST_TEAMS;
      const id = makeId(dateIso, acus);

      records.push({
        id,
        tool: "devin",
        model: "unknown",
        session_id: "",
        project: null,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: cost,
        timestamp: dateIso,
        duration_ms: null,
        metadata: {
          acus: String(acus),
          products: JSON.stringify(acusByProduct),
        },
      });
    }

    return {
      tool: "devin",
      records,
      errors,
      scanned_paths: [url],
    };
  },
};

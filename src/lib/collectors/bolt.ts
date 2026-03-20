import type { UsageRecord } from "../../types.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

/**
 * Bolt.new collector stub.
 *
 * Bolt does not currently expose a public billing/usage API. This collector
 * acts as a placeholder and will return empty results until Bolt provides
 * an API endpoint or local data files to parse.
 *
 * Configure a Bolt API key for future use:
 *   kova config set-key bolt <api-key>
 */
export const boltCollector: Collector = {
  name: "bolt",

  async isAvailable(): Promise<boolean> {
    return getToolKey("bolt") !== null;
  },

  async collect(_since?: Date): Promise<CollectorResult> {
    const key = getToolKey("bolt");

    if (!key) {
      return {
        tool: "bolt",
        records: [] as UsageRecord[],
        errors: [],
        scanned_paths: [],
      };
    }

    // API not yet available -- return empty with informational message.
    return {
      tool: "bolt",
      records: [] as UsageRecord[],
      errors: [
        "Bolt.new usage API is not yet publicly available. " +
          "Cost data cannot be retrieved at this time. " +
          "Your API key is stored and will be used when the API becomes available.",
      ],
      scanned_paths: [],
    };
  },
};

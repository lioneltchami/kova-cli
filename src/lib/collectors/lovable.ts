import type { UsageRecord } from "../../types.js";
import { getToolKey } from "../credential-manager.js";
import type { Collector, CollectorResult } from "./types.js";

/**
 * Lovable collector stub.
 *
 * Lovable does not currently expose a public billing/usage API. This collector
 * acts as a placeholder and will return empty results until Lovable provides
 * an API endpoint or local data files to parse.
 *
 * Configure a Lovable API key for future use:
 *   kova config set-key lovable <api-key>
 */
export const lovableCollector: Collector = {
	name: "lovable",

	async isAvailable(): Promise<boolean> {
		return getToolKey("lovable") !== null;
	},

	async collect(_since?: Date): Promise<CollectorResult> {
		const key = getToolKey("lovable");

		if (!key) {
			return {
				tool: "lovable",
				records: [] as UsageRecord[],
				errors: [],
				scanned_paths: [],
			};
		}

		// API not yet available -- return empty with informational message.
		return {
			tool: "lovable",
			records: [] as UsageRecord[],
			errors: [
				"Lovable usage API is not yet publicly available. " +
					"Cost data cannot be retrieved at this time. " +
					"Your API key is stored and will be used when the API becomes available.",
			],
			scanned_paths: [],
		};
	},
};

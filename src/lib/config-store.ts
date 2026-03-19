import fs from "fs";
import path from "path";
import type { KovaFinOpsConfig } from "../types.js";
import { CONFIG_FILE, KOVA_DATA_DIR } from "./constants.js";

export function getConfigPath(): string {
	return path.join(KOVA_DATA_DIR, CONFIG_FILE);
}

export function getDefaultConfig(): KovaFinOpsConfig {
	return {
		budget: {
			monthly_usd: null,
			daily_usd: null,
			warn_at_percent: 80,
		},
		tracking: {
			tools: ["claude_code"],
			auto_sync: false,
			scan_interval_minutes: 60,
		},
		display: {
			currency: "usd",
			show_tokens: true,
			show_model_breakdown: true,
		},
	};
}

export function readConfig(): KovaFinOpsConfig {
	const configPath = getConfigPath();
	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		return JSON.parse(raw) as KovaFinOpsConfig;
	} catch {
		return getDefaultConfig();
	}
}

export function writeConfig(config: KovaFinOpsConfig): void {
	const configPath = getConfigPath();
	const dir = path.dirname(configPath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function updateConfig(partial: Partial<KovaFinOpsConfig>): void {
	const current = readConfig();

	const merged: KovaFinOpsConfig = {
		budget: {
			...current.budget,
			...(partial.budget ?? {}),
		},
		tracking: {
			...current.tracking,
			...(partial.tracking ?? {}),
		},
		display: {
			...current.display,
			...(partial.display ?? {}),
		},
	};

	writeConfig(merged);
}

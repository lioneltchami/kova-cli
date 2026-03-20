import { exec } from "node:child_process";
import { readCredentials } from "../lib/dashboard.js";
import * as logger from "../lib/logger.js";

export async function dashboardCommand(): Promise<void> {
	const creds = readCredentials();
	const url = creds?.dashboardUrl ?? "https://kova.dev/dashboard";

	logger.info(`Opening ${url}`);

	const cmd =
		process.platform === "win32"
			? `start ${url}`
			: process.platform === "darwin"
				? `open ${url}`
				: `xdg-open ${url}`;

	exec(cmd, (err) => {
		if (err) {
			logger.info(`Open manually: ${url}`);
		}
	});
}

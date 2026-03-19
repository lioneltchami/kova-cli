import chalk from "chalk";
import os from "os";
import path from "path";

export const VERSION = "0.2.0";
export const DASHBOARD_API_URL = "https://kova.dev/api/v1";

export const KOVA_DATA_DIR = path.join(os.homedir(), ".kova");
export const USAGE_FILE = "usage.json";
export const CONFIG_FILE = "config.json";
export const CLAUDE_CODE_DIR = path.join(os.homedir(), ".claude");

export const colors = {
  brand: chalk.hex("#4361EE"),
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold,
  wolf: chalk.hex("#C0C0C8"),
};

// Cost per 1M tokens in USD (approximate 2026 pricing)
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  o1: { input: 15.0, output: 60.0 },
  o3: { input: 10.0, output: 40.0 },
  "gemini-pro": { input: 1.25, output: 5.0 },
  "gemini-flash": { input: 0.075, output: 0.3 },
};

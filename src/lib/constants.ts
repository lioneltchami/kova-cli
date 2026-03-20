import chalk from "chalk";
import os from "os";
import path from "path";

export const VERSION = "0.4.0";
export const DASHBOARD_API_URL = "https://kova.dev/api/v1";

export const KOVA_DATA_DIR = path.join(os.homedir(), ".kova");
export const USAGE_FILE = "usage.json";
export const CONFIG_FILE = "config.json";
export const CLAUDE_CODE_DIR = path.join(os.homedir(), ".claude");

// Cursor state database paths by platform
export const CURSOR_STATE_DB_PATHS: Record<string, string> = {
  darwin: path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Cursor",
    "User",
    "globalStorage",
    "state.vscdb",
  ),
  win32: path.join(
    process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming"),
    "Cursor",
    "User",
    "globalStorage",
    "state.vscdb",
  ),
  linux: path.join(
    os.homedir(),
    ".config",
    "Cursor",
    "User",
    "globalStorage",
    "state.vscdb",
  ),
};

// Copilot chat session paths by platform
export const COPILOT_CHAT_PATHS: Record<string, string> = {
  darwin: path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Code",
    "User",
    "globalStorage",
    "github.copilot-chat",
  ),
  win32: path.join(
    process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming"),
    "Code",
    "User",
    "globalStorage",
    "github.copilot-chat",
  ),
  linux: path.join(
    os.homedir(),
    ".config",
    "Code",
    "User",
    "globalStorage",
    "github.copilot-chat",
  ),
};

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
  // Claude models
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
  // OpenAI models
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-5": { input: 1.25, output: 10.0 },
  "gpt-5-mini": { input: 0.4, output: 1.6 },
  o1: { input: 15.0, output: 60.0 },
  o3: { input: 10.0, output: 40.0 },
  // Google models
  "gemini-pro": { input: 1.25, output: 5.0 },
  "gemini-flash": { input: 0.075, output: 0.3 },
  // Windsurf models
  "swe-1.5": { input: 0, output: 0 },
  "swe-1.5-fast": { input: 0.5, output: 2.0 },
};

// Cursor pool rates (per 1M tokens)
export const CURSOR_POOL_RATES = {
  cache_read: 0.25,
  input: 1.25,
  output: 6.0,
  cache_write: 1.25,
};

// Devin ACU costs
export const DEVIN_ACU_COST_CORE = 2.25;
export const DEVIN_ACU_COST_TEAMS = 2.0;

// Windsurf credit rates ($/credit)
export const WINDSURF_CREDIT_RATE_PRO = 0.02;
export const WINDSURF_CREDIT_RATE_TEAMS = 0.04;

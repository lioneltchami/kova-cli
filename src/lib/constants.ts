import chalk from "chalk";
import os from "os";
import path from "path";

export const VERSION = "1.0.0";
export const DASHBOARD_API_URL = "https://kova.dev/api/v1";

export const KOVA_DATA_DIR = path.join(os.homedir(), ".kova");
export const USAGE_FILE = "usage.json";
export const CONFIG_FILE = "config.json";
export const CLAUDE_CODE_DIR =
  process.env["CLAUDE_HOME"] ?? path.join(os.homedir(), ".claude");

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

// Aider chat history locations (checked in order)
export const AIDER_CHAT_HISTORY_NAMES = [".aider.chat.history.md"];
export const AIDER_REPORTS_DIR = ".aider/reports";

// Search roots for Aider files (home directory and current working directory).
// Exported as a function so tests can override via constants mock.
export const AIDER_SEARCH_ROOTS: string[] = [os.homedir(), process.cwd()];

// Continue.dev session directory
export const CONTINUE_SESSIONS_DIR = path.join(
  os.homedir(),
  ".continue",
  "sessions",
);

// Cline (saoudrizwan.claude-dev) VS Code globalStorage paths by platform
export const CLINE_STORAGE_PATHS: Record<string, string> = {
  darwin: path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Code",
    "User",
    "globalStorage",
    "saoudrizwan.claude-dev",
  ),
  win32: path.join(
    process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming"),
    "Code",
    "User",
    "globalStorage",
    "saoudrizwan.claude-dev",
  ),
  linux: path.join(
    os.homedir(),
    ".config",
    "Code",
    "User",
    "globalStorage",
    "saoudrizwan.claude-dev",
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

// Amazon Q Developer per-request pricing (approximate 2026)
// Amazon Q Developer Pro is $19/user/month as a flat fee; inline suggestions
// and chat are included. For cost tracking purposes we use a per-token
// estimate based on the underlying Bedrock model pricing.
export const AMAZON_Q_TOKEN_COSTS = {
  input: 3.0, // per 1M tokens (approximation based on Claude Sonnet)
  output: 15.0,
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

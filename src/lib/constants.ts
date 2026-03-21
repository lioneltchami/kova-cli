import chalk from "chalk";
import os from "os";
import path from "path";

export const VERSION = "2.1.0";
export const DASHBOARD_API_URL = "https://kova.dev/api/v1";

export const KOVA_DATA_DIR = path.join(os.homedir(), ".kova");
export const USAGE_FILE = "usage.json";
export const CONFIG_FILE = "config.json";
export const PROVIDER_CREDENTIALS_FILE = "provider-keys.json";
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
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  o3: { input: 10.0, output: 40.0 },
  "o4-mini": { input: 0.55, output: 2.2 },
  // Google models
  "gemini-pro": { input: 1.25, output: 5.0 },
  "gemini-flash": { input: 0.075, output: 0.3 },
  // Windsurf models
  "swe-1.5": { input: 0, output: 0 },
  "swe-1.5-fast": { input: 0.5, output: 2.0 },
};

export const MODEL_TIERS: Record<
  string,
  { tier: string; provider: string; sdkId: string }
> = {
  haiku: {
    tier: "cheap",
    provider: "anthropic",
    sdkId: "claude-haiku-4-5-20251001",
  },
  sonnet: {
    tier: "mid",
    provider: "anthropic",
    sdkId: "claude-sonnet-4-20250514",
  },
  opus: {
    tier: "strong",
    provider: "anthropic",
    sdkId: "claude-opus-4-20250115",
  },
  "gpt-4.1-nano": { tier: "cheap", provider: "openai", sdkId: "gpt-4.1-nano" },
  "gpt-4.1-mini": { tier: "cheap", provider: "openai", sdkId: "gpt-4.1-mini" },
  "gpt-4.1": { tier: "mid", provider: "openai", sdkId: "gpt-4.1" },
  "gpt-4o": { tier: "mid", provider: "openai", sdkId: "gpt-4o" },
  o3: { tier: "strong", provider: "openai", sdkId: "o3" },
  "o4-mini": { tier: "mid", provider: "openai", sdkId: "o4-mini" },
  "gemini-flash": {
    tier: "cheap",
    provider: "google",
    sdkId: "gemini-2.5-flash",
  },
  "gemini-pro": { tier: "mid", provider: "google", sdkId: "gemini-2.5-pro" },
};

export const DEFAULT_ROUTING = {
  simple: "anthropic:claude-haiku-4-5-20251001",
  moderate: "anthropic:claude-sonnet-4-20250514",
  complex: "anthropic:claude-opus-4-20250115",
};

// Model fallback chain: when a model fails, try the next one down
export const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  "anthropic:claude-opus-4-20250115": [
    "anthropic:claude-sonnet-4-20250514",
    "anthropic:claude-haiku-4-5-20251001",
  ],
  "anthropic:claude-sonnet-4-20250514": ["anthropic:claude-haiku-4-5-20251001"],
  "openai:o3": ["openai:gpt-4o", "openai:gpt-4.1-mini"],
  "openai:gpt-4o": ["openai:gpt-4.1-mini", "openai:gpt-4.1-nano"],
  "openai:gpt-4.1": ["openai:gpt-4.1-mini", "openai:gpt-4.1-nano"],
  "google:gemini-2.5-pro": ["google:gemini-2.5-flash"],
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

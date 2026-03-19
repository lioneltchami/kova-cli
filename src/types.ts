// Supported AI coding tools
export type AiTool =
  | "claude_code"
  | "cursor"
  | "copilot"
  | "devin"
  | "windsurf";

// Supported AI models (expanded for multi-tool)
export type AiModel =
  | "haiku"
  | "sonnet"
  | "opus"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o1"
  | "o3"
  | "gpt-4.1"
  | "gpt-5"
  | "gpt-5-mini"
  | "gemini-pro"
  | "gemini-flash"
  | "swe-1.5"
  | "swe-1.5-fast"
  | "unknown";

// Per-tool API key storage (keyed by AiTool)
export type ToolCredentials = Partial<Record<AiTool, string>>;

export interface UsageRecord {
  id: string;
  tool: AiTool;
  model: AiModel;
  session_id: string;
  project: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  timestamp: string;
  duration_ms: number | null;
  metadata: Record<string, string>;
}

export interface CostSummary {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_sessions: number;
  by_tool: Partial<Record<AiTool, ToolCostBreakdown>>;
  by_model: Record<string, ModelCostBreakdown>;
  by_project: Record<string, number>;
  by_day: Record<string, number>;
  period: { from: string; to: string };
}

export interface ToolCostBreakdown {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  sessions: number;
  models_used: string[];
}

export interface ModelCostBreakdown {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  requests: number;
}

export interface UsageDatabase {
  version: 1;
  last_scan: string | null;
  records: UsageRecord[];
}

export interface KovaFinOpsConfig {
  budget: {
    monthly_usd: number | null;
    daily_usd: number | null;
    warn_at_percent: number;
  };
  tracking: {
    tools: AiTool[];
    auto_sync: boolean;
    scan_interval_minutes: number;
  };
  display: {
    currency: "usd";
    show_tokens: boolean;
    show_model_breakdown: boolean;
  };
}

export interface BudgetAlert {
  type: "daily_warn" | "daily_exceeded" | "monthly_warn" | "monthly_exceeded";
  budget_usd: number;
  spent_usd: number;
  percent: number;
  period: string;
  triggered_at: string;
}

export interface UsageUploadPayload {
  cli_version: string;
  records: Array<{
    tool: AiTool;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    timestamp: string;
    project: string | null;
  }>;
  period: { from: string; to: string };
  os: string;
  node_version: string;
}

export interface DashboardCredentials {
  apiKey: string;
  dashboardUrl: string;
  userId: string;
  email: string;
  plan: "free" | "pro" | "team" | "enterprise";
  cachedAt: string;
}

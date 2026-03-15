// Model and plan types
export type ModelTier = "haiku" | "sonnet" | "opus";
export type PlanType = "pro" | "max5" | "max20" | "api";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked";

// Project detection result
export interface DetectedProject {
  language: string | null;
  framework: string | null;
  packageManager: string | null;
  database: string | null;
  auth: string | null;
  payments: string | null;
  commands: {
    test: string | null;
    lint: string | null;
    build: string | null;
    typecheck: string | null;
    dev: string | null;
  };
}

// Kova configuration (kova.yaml)
export interface KovaConfig {
  project: {
    name: string;
    language: string;
    framework: string;
    package_manager: string;
  };
  models: {
    auto: boolean;
    trivial: ModelTier;
    moderate: ModelTier;
    complex: ModelTier;
    planning: ModelTier;
  };
  quality: {
    test: string | null;
    lint: string | null;
    typecheck: string | null;
    build: string | null;
    validate_after_each_task: boolean;
    validate_at_end: boolean;
  };
  agents: Record<string, string>;
  boundaries: {
    never_touch: string[];
  };
  rules: string[];
  execution: {
    default_mode: "build" | "team-build";
    max_parallel_agents: number;
    enable_resume: boolean;
    enable_agent_teams: boolean;
    task_timeout_seconds: number;
  };
  notifications: {
    on_build_complete: {
      discord: string | null;
      slack: string | null;
      custom: string | null;
    };
  };
  usage_tracking: {
    enabled: boolean;
    plan: PlanType;
    show_per_task: boolean;
    show_build_summary: boolean;
    show_cost_estimate: boolean;
    warn_at_percent: number;
    pause_at_percent: number;
  };
  plan_validation: {
    required_sections: string[];
    require_dependencies: boolean;
    require_acceptance_criteria: boolean;
  };
}

// Plan task (parsed from plan markdown)
export interface PlanTask {
  id: string;
  name: string;
  depends_on: string[];
  assigned_to: string;
  agent_type: string;
  parallel: boolean;
  description: string;
  files: string[];
  model: ModelTier | null;
}

// Checkpoint task entry
export interface CheckpointTask {
  status: TaskStatus;
  agent_type: string | null;
  model: ModelTier | null;
  agent_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_s: number | null;
  tokens: {
    input: number;
    output: number;
    total: number;
  } | null;
}

// Token usage tracking
export interface TokenUsage {
  total_input: number;
  total_output: number;
  total_combined: number;
  cost_estimate_usd: number;
  per_task: Record<string, { input: number; output: number; model: ModelTier }>;
  session_start: string;
  plan_type: PlanType;
  window_allocation: number;
}

// Checkpoint file (.progress.json)
export interface CheckpointFile {
  plan: string;
  started_at: string;
  status: "in_progress" | "completed" | "failed";
  tasks: Record<string, CheckpointTask>;
  token_usage: TokenUsage | null;
  validation: {
    passed: boolean;
    results: Record<string, boolean>;
  } | null;
}

// Scaffold options
export interface ScaffoldOptions {
  force?: boolean;
  merge?: boolean;
}

// Webhook notification payload
export interface WebhookPayload {
  event: "build_start" | "build_complete" | "build_fail";
  plan: string;
  status: string;
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  duration_seconds: number;
  models_used: Record<string, number>;
  timestamp: string;
}

// Notification configuration
export interface NotificationConfig {
  discord: string | null;
  slack: string | null;
  custom: string | null;
}

import chalk from "chalk";
import type { KovaConfig, PlanType } from "../types.js";

export const VERSION = "0.1.0";
export const KOVA_CONFIG_FILE = "kova.yaml";
export const CLAUDE_DIR = ".claude";
export const TASKS_DIR = ".claude/tasks";

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

export const PLAN_ALLOCATIONS: Record<PlanType, number> = {
	pro: 44000,
	max5: 88000,
	max20: 220000,
	api: Infinity,
};

// Cost per 1M tokens in USD (approximate 2026 pricing)
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
	haiku: { input: 0.25, output: 1.25 },
	sonnet: { input: 3.0, output: 15.0 },
	opus: { input: 15.0, output: 75.0 },
};

export const DEFAULT_CONFIG: KovaConfig = {
	project: {
		name: "",
		language: "TypeScript",
		framework: "",
		package_manager: "npm",
	},
	models: {
		auto: true,
		trivial: "haiku",
		moderate: "sonnet",
		complex: "opus",
		planning: "opus",
	},
	quality: {
		test: null,
		lint: null,
		typecheck: null,
		build: null,
		validate_after_each_task: false,
		validate_at_end: true,
	},
	agents: {
		frontend: "frontend-specialist",
		backend: "backend-engineer",
		database: "supabase-specialist",
		testing: "quality-engineer",
		security: "security-auditor",
		performance: "performance-optimizer",
	},
	boundaries: {
		never_touch: ["*.lock", ".env*", "node_modules/**"],
	},
	rules: [],
	execution: {
		default_mode: "build",
		max_parallel_agents: 4,
		enable_resume: true,
		enable_agent_teams: false,
		task_timeout_seconds: 300,
	},
	notifications: {
		on_build_complete: {
			discord: null,
			slack: null,
			custom: null,
		},
	},
	usage_tracking: {
		enabled: true,
		plan: "max5",
		show_per_task: true,
		show_build_summary: true,
		show_cost_estimate: true,
		warn_at_percent: 80,
		pause_at_percent: 95,
	},
	plan_validation: {
		required_sections: [
			"Task Description",
			"Objective",
			"Relevant Files",
			"Step by Step Tasks",
			"Acceptance Criteria",
			"Team Orchestration",
		],
		require_dependencies: true,
		require_acceptance_criteria: true,
	},
};

export const PLAN_TEMPLATE_NAMES = [
	"feature",
	"bugfix",
	"refactor",
	"migration",
	"security",
	"performance",
] as const;

export type PlanTemplateName = (typeof PLAN_TEMPLATE_NAMES)[number];

// Template files that get scaffolded to .claude/
export const TEMPLATE_FILES = [
	"commands/team-plan.md",
	"commands/build.md",
	"commands/team-build.md",
	"skills/session-management/SKILL.md",
	"skills/sub-agent-invocation/SKILL.md",
	"hooks/Validators/validate-new-file.mjs",
	"hooks/Validators/validate-file-contains.mjs",
	"hooks/FormatterHook/formatter.mjs",
	"hooks/SkillActivationHook/skill-activation-prompt.mjs",
	"agents/agent-rules.json",
	"skills/skill-rules.json",
	"settings.json",
];

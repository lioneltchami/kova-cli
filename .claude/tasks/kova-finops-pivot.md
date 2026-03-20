# Plan: Kova CLI Pivot to AI Dev FinOps Dashboard

## Task Description

Pivot Kova CLI from an AI coding orchestration wrapper into an **AI Dev FinOps platform** -- a self-serve tool that tracks what developers and engineering teams spend across AI coding tools (Claude Code, Cursor, GitHub Copilot, Devin, Windsurf), broken down by developer, project, tool, and time period.

The CLI becomes a lightweight **local collector agent** that reads usage data from AI coding tools installed on the developer's machine, computes costs, and optionally syncs to the Kova cloud dashboard for team-wide visibility.

**Why this pivot:** Research across 80+ sources confirms:

- No unified AI coding tool cost dashboard exists at the mid-market price point
- 78% of IT leaders hit with unexpected AI charges; 57% track costs via spreadsheets
- Jellyfish (the closest competitor) charges $95K/year and focuses on productivity, not cost attribution
- The multi-tool view is structurally defensible -- no single AI vendor can build it

## Objective

When this plan is complete, the Kova CLI will:

1. Parse Claude Code usage data from local JSONL files and compute accurate cost breakdowns
2. Display per-session, per-model, daily, and monthly cost summaries in the terminal
3. Support budget alerts that warn developers before they hit spending thresholds
4. Upload anonymized usage data to the Kova cloud dashboard (optional, requires login)
5. Run as a background daemon that continuously monitors usage
6. Have a full test suite covering all new functionality
7. Be publishable to npm as `kova-cli` v0.2.0 with the new positioning

## Problem Statement

Developers using AI coding tools (Claude Code, Cursor, Copilot) have no unified way to track what they spend. Each tool has siloed analytics. Engineering managers cannot answer "what did our team spend on AI tools this month?" without manual spreadsheet work. The existing solutions (Jellyfish at $95K/year, Faros AI at enterprise pricing) are inaccessible to small and mid-market teams.

## Solution Approach

**Phase 1 (this plan)**: Build the Claude Code cost tracker MVP in the CLI. This is the highest-value, lowest-complexity starting point because Claude Code stores detailed JSONL usage data locally. No API keys or external integrations needed -- just read local files.

**Phase 2 (future)**: Add Cursor and Copilot collectors. Build the web dashboard for team-wide views.

**Phase 3 (future)**: Add budget management, anomaly detection, cost optimization recommendations, compliance audit exports.

### Architecture

```
Developer Machine                    Kova Cloud (Future)
+------------------+                +------------------+
| kova track       | ---upload----> | Supabase DB      |
|   reads JSONL    |                | Next.js Dashboard|
|   computes costs |                | Team aggregation |
|   local storage  |                | Budget alerts    |
+------------------+                +------------------+
```

**Privacy-first**: The CLI only sends token counts, model names, timestamps, and computed costs. Never source code, prompts, or file paths.

## Relevant Files

### Existing Files to KEEP (reusable infrastructure)

- `src/index.ts` -- CLI entry point, Commander.js setup (strip old commands, add new ones)
- `src/types.ts` -- Type definitions (strip orchestration types, add FinOps types)
- `src/lib/constants.ts` -- VERSION, DASHBOARD_API_URL, TOKEN_COSTS, colors (keep cost tables, strip orchestration constants)
- `src/lib/logger.ts` -- Chalk-colored console output (keep as-is)
- `src/lib/error-handler.ts` -- Levenshtein suggestions, wrapCommandAction (keep as-is)
- `src/lib/update-checker.ts` -- npm update check (keep as-is)
- `src/lib/dashboard.ts` -- Credentials management (keep auth, replace uploadBuild with uploadUsage)
- `src/commands/login.ts` -- Login command (keep as-is)
- `src/commands/logout.ts` -- Logout command (keep as-is)
- `src/commands/account.ts` -- Account command (keep, update messaging)
- `src/commands/completions.ts` -- Shell completions wrapper (update command registry)
- `src/lib/completions.ts` -- Shell completion generators (update command list)
- `package.json` -- Update description, keywords, version
- `tsup.config.ts` -- Keep as-is
- `vitest.config.ts` -- Keep as-is
- `bin/kova.js` -- Keep as-is

### Existing Files to REMOVE (orchestration-specific)

- `src/commands/init.ts` -- Scaffolding wizard (not needed)
- `src/commands/plan.ts` -- Plan creation (not needed)
- `src/commands/build.ts` -- Build execution (not needed)
- `src/commands/team-build.ts` -- Team build (not needed)
- `src/commands/run.ts` -- Plan+build combo (not needed)
- `src/commands/status.ts` -- Build status (replaced by `kova costs`)
- `src/commands/config.ts` -- kova.yaml config (replaced by `kova config` for FinOps settings)
- `src/commands/update.ts` -- Template updates (not needed)
- `src/commands/pr.ts` -- PR creation (not needed)
- `src/lib/checkpoint.ts` -- Build checkpoints (not needed)
- `src/lib/scaffold.ts` -- Project scaffolding (not needed)
- `src/lib/subprocess.ts` -- Claude CLI invocation (not needed)
- `src/lib/model-selector.ts` -- Model selection (not needed)
- `src/lib/token-tracker.ts` -- Build token tracking (replaced by usage collector)
- `src/lib/notifications.ts` -- Webhook notifications (replaced by budget alerts)
- `src/lib/plan-templates.ts` -- Plan templates (not needed)
- `src/lib/detect.ts` -- Project detection (not needed)
- `src/lib/interactive.ts` -- Interactive wizard (not needed)
- `src/lib/github.ts` -- Git/GitHub helpers (not needed)
- `src/lib/live-progress.ts` -- Live progress display (not needed)
- `src/lib/config.ts` -- kova.yaml management (replaced by simpler config)

### New Files to CREATE

- `src/lib/collectors/claude-code.ts` -- Parse Claude Code JSONL usage files
- `src/lib/collectors/types.ts` -- Shared collector types (UsageRecord, CollectorResult)
- `src/lib/cost-calculator.ts` -- Compute USD costs from token counts + model
- `src/lib/local-store.ts` -- Read/write local usage database (~/.kova/usage.json)
- `src/lib/uploader.ts` -- Sync local usage data to Kova cloud API
- `src/lib/formatter.ts` -- Format usage data for terminal display (tables, charts)
- `src/lib/config-store.ts` -- Read/write ~/.kova/config.json (budgets, alert thresholds)
- `src/commands/track.ts` -- `kova track` -- scan and record usage data
- `src/commands/costs.ts` -- `kova costs` -- display cost summary
- `src/commands/budget.ts` -- `kova budget` -- set/view budget alerts
- `src/commands/sync.ts` -- `kova sync` -- upload local data to cloud
- `src/commands/report.ts` -- `kova report` -- generate cost report (CSV/JSON)
- `tests/collectors/claude-code.test.ts` -- Claude Code collector tests
- `tests/cost-calculator.test.ts` -- Cost calculation tests
- `tests/local-store.test.ts` -- Local storage tests
- `tests/formatter.test.ts` -- Formatter tests
- `tests/config-store.test.ts` -- Config store tests
- `tests/commands/track.test.ts` -- Track command tests
- `tests/commands/costs.test.ts` -- Costs command tests
- `tests/commands/budget.test.ts` -- Budget command tests
- `tests/commands/sync.test.ts` -- Sync command tests
- `tests/commands/report.test.ts` -- Report command tests
- `tests/integration/track-to-costs.test.ts` -- End-to-end flow test

## Implementation Phases

### Phase 1: Foundation (Tasks 1-3)

Strip the CLI of orchestration code, update types and constants for FinOps, establish the new data models and local storage layer. This creates the clean foundation everything else builds on.

### Phase 2: Core Implementation (Tasks 4-7)

Build the Claude Code collector (JSONL parser), cost calculator, terminal formatter, and the primary CLI commands (`kova track`, `kova costs`, `kova budget`). This is the core product -- after this phase, a developer can install Kova and immediately see their Claude Code spending.

### Phase 3: Cloud & Polish (Tasks 8-10)

Build the cloud sync command, update shell completions, update the entry point with new commands, write integration tests, and validate everything works end-to-end. After this phase, the CLI is publishable.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
  - This is critical. Your job is to act as a high level director of the team, not a builder.
  - Your role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task\* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task\* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-foundation
  - Role: Strip orchestration code, update types/constants/package.json, create new data models and local storage layer
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-collectors
  - Role: Build Claude Code JSONL collector, cost calculator, and formatter modules
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-commands
  - Role: Build all new CLI commands (track, costs, budget, sync, report) and update index.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write comprehensive test suite for all new modules and commands
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Strip Orchestration and Update Package Identity

- **Task ID**: strip-orchestration
- **Depends On**: none
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read ALL existing source files first to understand the full codebase before making changes
- Remove all orchestration command files: `src/commands/init.ts`, `src/commands/plan.ts`, `src/commands/build.ts`, `src/commands/team-build.ts`, `src/commands/run.ts`, `src/commands/status.ts`, `src/commands/config.ts`, `src/commands/update.ts`, `src/commands/pr.ts`
- Remove all orchestration lib files: `src/lib/checkpoint.ts`, `src/lib/scaffold.ts`, `src/lib/subprocess.ts`, `src/lib/model-selector.ts`, `src/lib/token-tracker.ts`, `src/lib/notifications.ts`, `src/lib/plan-templates.ts`, `src/lib/detect.ts`, `src/lib/interactive.ts`, `src/lib/github.ts`, `src/lib/live-progress.ts`, `src/lib/config.ts`
- Remove all old test files: everything in `tests/` EXCEPT `tests/auth-commands.test.ts`, `tests/dashboard.test.ts`, `tests/error-handler.test.ts`, `tests/update-checker.test.ts`
- Update `package.json`:
  - Version: `"0.2.0"`
  - Description: `"AI dev tool cost tracker - Know what your AI tools actually cost."`
  - Keywords: `["ai", "developer-tools", "cost-tracking", "finops", "claude-code", "cursor", "copilot", "analytics", "cli"]`
  - Remove `@inquirer/prompts` from dependencies (no longer needed for interactive wizard)
  - Remove `cosmiconfig` from dependencies (no longer needed for kova.yaml)
  - Remove `yaml` from dependencies (no longer needed)
  - Remove `glob` from dependencies (no longer needed for checkpoint discovery)
  - Keep: `commander`, `chalk`, `execa` (may need for future tool integrations)
- Update `src/lib/constants.ts`:
  - Change VERSION to `"0.2.0"`
  - Keep `DASHBOARD_API_URL`, `colors`, `TOKEN_COSTS`
  - Remove: `KOVA_CONFIG_FILE`, `CLAUDE_DIR`, `TASKS_DIR`, `PLAN_ALLOCATIONS`, `DEFAULT_CONFIG`, `PLAN_TEMPLATE_NAMES`, `TEMPLATE_FILES`
  - Add: `KOVA_DATA_DIR` pointing to `~/.kova/`
  - Add: `USAGE_FILE` = `"usage.json"`
  - Add: `CONFIG_FILE` = `"config.json"`
  - Add: Claude Code JSONL paths for each platform (Linux: `~/.claude/projects/`, macOS: same, Windows: similar)
- Update `src/index.ts`:
  - Remove ALL orchestration command registrations (init, plan, run, build, team-build, status, config, update, pr)
  - Keep: login, logout, account, completions, version
  - Add placeholder registrations for: track, costs, budget, sync, report (will be implemented in later tasks)
  - Update program description to: `"AI dev tool cost tracker - Know what your AI tools actually cost."`
  - Update banner text in logger.ts to match new positioning
- Update `src/lib/logger.ts`:
  - Change banner text from "AI coding orchestration CLI" to "AI dev tool cost tracker"
  - Change tagline from "Plan the hunt. Run the pack." to "Know what your AI tools actually cost."
- Verify the project builds with `npm run build` after all removals
- Verify remaining tests pass with `npm run test`

### 2. Define New Type System

- **Task ID**: new-types
- **Depends On**: strip-orchestration
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read the current `src/types.ts` to understand what was kept vs removed
- Replace all orchestration types in `src/types.ts` with FinOps types. Keep `DashboardCredentials` and `BuildUploadPayload` (rename to `UsageUploadPayload`). Remove all others (ModelTier, PlanType, TaskStatus, DetectedProject, KovaConfig, PlanTask, CheckpointTask, TokenUsage, CheckpointFile, ScaffoldOptions, WebhookPayload, NotificationConfig).
- Add these new types:

```typescript
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
  | "opus" // Claude models
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o1"
  | "o3" // OpenAI models
  | "gemini-pro"
  | "gemini-flash" // Google models
  | "unknown";

// A single usage record from any tool
export interface UsageRecord {
  id: string; // UUID
  tool: AiTool; // Which AI tool
  model: AiModel; // Which model was used
  session_id: string; // Tool-specific session identifier
  project: string | null; // Project directory name (not full path)
  input_tokens: number;
  output_tokens: number;
  cost_usd: number; // Computed cost
  timestamp: string; // ISO 8601
  duration_ms: number | null; // Session/request duration
  metadata: Record<string, string>; // Tool-specific metadata
}

// Aggregated cost summary
export interface CostSummary {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_sessions: number;
  by_tool: Record<AiTool, ToolCostBreakdown>;
  by_model: Record<string, ModelCostBreakdown>;
  by_project: Record<string, number>; // project -> cost_usd
  by_day: Record<string, number>; // YYYY-MM-DD -> cost_usd
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

// Local usage database structure
export interface UsageDatabase {
  version: 1;
  last_scan: string | null; // ISO 8601
  records: UsageRecord[];
}

// Kova local configuration
export interface KovaFinOpsConfig {
  budget: {
    monthly_usd: number | null; // Monthly budget in USD
    daily_usd: number | null; // Daily budget in USD
    warn_at_percent: number; // Alert at this % of budget (default 80)
  };
  tracking: {
    tools: AiTool[]; // Which tools to track (default: all detected)
    auto_sync: boolean; // Auto-upload to cloud on each scan
    scan_interval_minutes: number; // For daemon mode (default: 15)
  };
  display: {
    currency: "usd"; // Future: multi-currency
    show_tokens: boolean; // Show token counts in output
    show_model_breakdown: boolean; // Show per-model breakdown
  };
}

// Budget alert
export interface BudgetAlert {
  type: "daily_warn" | "daily_exceeded" | "monthly_warn" | "monthly_exceeded";
  budget_usd: number;
  spent_usd: number;
  percent: number;
  period: string; // YYYY-MM-DD or YYYY-MM
  triggered_at: string;
}

// Cloud upload payload (replaces BuildUploadPayload)
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

// Keep DashboardCredentials as-is from existing code
```

- Create `src/lib/collectors/types.ts` with the collector interface:

```typescript
import type { UsageRecord } from "../../types.js";

export interface CollectorResult {
  tool: string;
  records: UsageRecord[];
  errors: string[];
  scanned_paths: string[];
}

export interface Collector {
  name: string;
  isAvailable(): Promise<boolean>;
  collect(since?: Date): Promise<CollectorResult>;
}
```

- Verify `npm run build` succeeds
- Verify `npm run lint` passes

### 3. Build Local Storage and Config Layer

- **Task ID**: local-storage
- **Depends On**: new-types
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read the existing `src/lib/dashboard.ts` for credential storage patterns (reuse the same ~/.kova/ directory pattern)
- Create `src/lib/local-store.ts`:
  - `getUsageDatabasePath(): string` -- returns `~/.kova/usage.json`
  - `readUsageDatabase(): UsageDatabase` -- reads and parses, returns empty DB if missing
  - `writeUsageDatabase(db: UsageDatabase): void` -- atomic write (temp file + rename, same pattern as old checkpoint.ts)
  - `appendRecords(records: UsageRecord[]): number` -- reads DB, deduplicates by id, appends new records, writes, returns count of new records added
  - `queryRecords(options: { tool?: AiTool, since?: Date, until?: Date, project?: string }): UsageRecord[]` -- filter records
  - `getLastScanTimestamp(): Date | null` -- reads last_scan from DB
  - `updateLastScan(): void` -- sets last_scan to now
  - `pruneOldRecords(olderThan: Date): number` -- remove records older than date, return count removed
- Create `src/lib/config-store.ts`:
  - `getConfigPath(): string` -- returns `~/.kova/config.json`
  - `readConfig(): KovaFinOpsConfig` -- reads config, returns defaults if missing
  - `writeConfig(config: KovaFinOpsConfig): void` -- writes config
  - `getDefaultConfig(): KovaFinOpsConfig` -- returns sensible defaults:
    - budget: { monthly_usd: null, daily_usd: null, warn_at_percent: 80 }
    - tracking: { tools: ["claude_code"], auto_sync: false, scan_interval_minutes: 15 }
    - display: { currency: "usd", show_tokens: true, show_model_breakdown: true }
  - `updateConfig(partial: Partial<KovaFinOpsConfig>): void` -- deep merge with existing config
- Verify `npm run build` succeeds

### 4. Build Claude Code Collector

- **Task ID**: claude-code-collector
- **Depends On**: local-storage
- **Assigned To**: builder-collectors
- **Agent Type**: backend-engineer
- **Parallel**: false
- IMPORTANT: Before writing any code, research Claude Code's JSONL usage file format. Read files in `~/.claude/` directory to understand the actual structure. The collector MUST handle the real file format, not an assumed one.
- Read the existing `src/lib/constants.ts` for TOKEN_COSTS (reuse for cost computation)
- Read the ccusage open-source project approach for reference (https://github.com/ryoppippi/ccusage) -- understand what fields are in the JSONL files
- Create `src/lib/collectors/claude-code.ts` implementing the `Collector` interface:
  - `name = "claude_code"`
  - `isAvailable()`: Check if `~/.claude/` directory exists
  - `collect(since?: Date)`:
    - Scan `~/.claude/projects/*/` for JSONL usage/conversation files
    - Parse each JSONL file line by line (each line is a JSON object)
    - Extract: model used, input tokens, output tokens, timestamp, session ID
    - Map Claude model names to AiModel type (claude-3-haiku -> haiku, claude-3.5-sonnet -> sonnet, claude-3-opus -> opus, claude-sonnet-4 -> sonnet, etc.)
    - Compute cost_usd using TOKEN_COSTS from constants.ts
    - Extract project name from the directory path (just the folder name, not the full path)
    - Generate deterministic UUID for each record (hash of tool + session_id + timestamp) to enable deduplication
    - Skip records older than `since` parameter
    - Return CollectorResult with records and any parsing errors
  - Handle edge cases:
    - Empty or corrupted JSONL lines (skip with warning)
    - Missing fields (use defaults: unknown model, 0 tokens)
    - Files currently being written to (handle EBUSY/EACCES gracefully)
    - Very large files (stream line-by-line, don't read entire file into memory)
    - Windows path differences
- Verify `npm run build` succeeds

### 5. Build Cost Calculator and Formatter

- **Task ID**: cost-calculator-formatter
- **Depends On**: new-types
- **Assigned To**: builder-collectors
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside claude-code-collector after new-types is done)
- Create `src/lib/cost-calculator.ts`:
  - `computeCost(model: AiModel, inputTokens: number, outputTokens: number): number` -- returns USD cost
  - `aggregateCosts(records: UsageRecord[], period?: { from: Date, to: Date }): CostSummary` -- compute full breakdown
  - `getDailyCosts(records: UsageRecord[]): Record<string, number>` -- group by day
  - `getMonthlyCosts(records: UsageRecord[]): Record<string, number>` -- group by month
  - `getToolCosts(records: UsageRecord[]): Record<AiTool, ToolCostBreakdown>` -- group by tool
  - `getModelCosts(records: UsageRecord[]): Record<string, ModelCostBreakdown>` -- group by model
  - `getProjectCosts(records: UsageRecord[]): Record<string, number>` -- group by project
  - Use TOKEN_COSTS from constants.ts for Claude models
  - Add Cursor/Copilot/Devin cost tables (can be approximate, will be refined later):
    - cursor: roughly $0.003-0.01 per request (credit-based, approximate)
    - copilot: roughly $0.003 per suggestion (seat-based, prorated)
  - Handle unknown models gracefully (return 0 cost with warning)
- Create `src/lib/formatter.ts`:
  - `formatCostSummary(summary: CostSummary): string` -- full terminal output with sections
  - `formatDailyTable(dailyCosts: Record<string, number>): string` -- daily breakdown table
  - `formatToolComparison(toolCosts: Record<AiTool, ToolCostBreakdown>): string` -- side-by-side tool costs
  - `formatModelBreakdown(modelCosts: Record<string, ModelCostBreakdown>): string` -- per-model table
  - `formatBudgetStatus(config: KovaFinOpsConfig, currentSpend: number, period: string): string` -- budget bar with %, colors
  - `formatSparkline(values: number[]): string` -- tiny ASCII chart for daily trend
  - Use chalk colors from constants.ts for consistent branding
  - Use the same table formatting pattern as existing logger.ts (padded columns)
  - All money values formatted as `$X.XX` with 2 decimal places
  - Large token counts formatted with commas (1,234,567)
- Verify `npm run build` succeeds

### 6. Build Core CLI Commands (track, costs, budget)

- **Task ID**: core-commands
- **Depends On**: claude-code-collector, cost-calculator-formatter, local-storage
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read ALL existing command files (login.ts, logout.ts, account.ts) to match patterns exactly
- Read `src/lib/logger.ts` and `src/lib/error-handler.ts` to use established patterns
- Create `src/commands/track.ts` -- the primary data collection command:
  - `kova track` -- scan all enabled tools, record new usage data
  - `kova track --since <date>` -- only collect usage since this date
  - `kova track --tool <tool>` -- only collect from specific tool
  - `kova track --daemon` -- run continuously at configured interval (default 15 min)
  - Flow:
    1. Read config to get enabled tools
    2. For each enabled tool, instantiate collector
    3. Run collector.collect(since=lastScanTimestamp)
    4. Append new records to local store
    5. Update last_scan timestamp
    6. If auto_sync enabled, trigger upload
    7. Print summary: "Found X new usage records (Y from Claude Code). Total spend today: $Z.ZZ"
  - Daemon mode: use setInterval, log each scan summary, handle SIGINT gracefully
  - Use `wrapCommandAction` from error-handler.ts
- Create `src/commands/costs.ts` -- the primary viewing command:
  - `kova costs` -- show current month summary
  - `kova costs --today` -- show today only
  - `kova costs --week` -- show last 7 days
  - `kova costs --month [YYYY-MM]` -- show specific month
  - `kova costs --tool <tool>` -- filter by tool
  - `kova costs --project <name>` -- filter by project
  - `kova costs --detailed` -- show per-session breakdown
  - `kova costs --json` -- output as JSON (for piping to other tools)
  - Flow:
    1. Read local store
    2. Filter records by date range and options
    3. Aggregate costs
    4. Format and display using formatter
    5. If budget is set, show budget status bar at the bottom
  - Default output (no flags) shows: month total, daily sparkline, top 3 models by cost, budget status
- Create `src/commands/budget.ts` -- budget management:
  - `kova budget` -- show current budget and status
  - `kova budget set --monthly <amount>` -- set monthly budget
  - `kova budget set --daily <amount>` -- set daily budget
  - `kova budget clear` -- remove budget
  - `kova budget --warn-at <percent>` -- set warning threshold (default 80%)
  - Flow: read/write config-store, display budget status using formatter
- Verify `npm run build` succeeds

### 7. Build Cloud Sync and Report Commands

- **Task ID**: sync-report-commands
- **Depends On**: core-commands
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read `src/lib/dashboard.ts` to understand the existing upload pattern
- Create `src/lib/uploader.ts`:
  - `uploadUsage(records: UsageRecord[]): Promise<boolean>` -- POST to `/api/v1/usage`
  - Reuse the same auth pattern as existing `uploadBuild` (read credentials, Bearer token, fire-and-forget option)
  - Batch records in chunks of 500 to avoid payload size issues
  - Return true if all batches succeeded
- Update `src/lib/dashboard.ts`:
  - Remove `uploadBuild` function (replaced by uploader.ts)
  - Keep `storeCredentials`, `readCredentials`, `removeCredentials`, `isLoggedIn`, `checkSubscription`
- Create `src/commands/sync.ts`:
  - `kova sync` -- upload all unsynced usage data to cloud
  - `kova sync --since <date>` -- upload only records since date
  - `kova sync --dry-run` -- show what would be uploaded without uploading
  - Flow:
    1. Check login status (require login for sync)
    2. Read local store
    3. Filter to unsynced records (track sync status in metadata)
    4. Upload via uploader.ts
    5. Mark records as synced
    6. Print summary: "Synced X records covering $Y.YY in usage"
- Create `src/commands/report.ts`:
  - `kova report` -- generate a cost report for the current month
  - `kova report --format csv` -- output as CSV
  - `kova report --format json` -- output as JSON
  - `kova report --output <path>` -- write to file instead of stdout
  - `kova report --month <YYYY-MM>` -- specific month
  - CSV columns: date, tool, model, project, input_tokens, output_tokens, cost_usd
  - JSON format: full CostSummary object
- Verify `npm run build` succeeds

### 8. Update Entry Point and Shell Completions

- **Task ID**: update-entry-point
- **Depends On**: sync-report-commands
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Parallel**: false
- Update `src/index.ts`:
  - Remove ALL old command registrations (init, plan, run, build, team-build, status, config, update, pr)
  - Add new command registrations with lazy imports:
    - `kova track` -- scan and record AI tool usage
    - `kova costs` -- view cost breakdown and analytics
    - `kova budget` -- manage spending budgets and alerts
    - `kova sync` -- upload usage data to Kova cloud
    - `kova report` -- generate cost reports (CSV/JSON)
    - Keep: `kova login`, `kova logout`, `kova account`, `kova completions`, `kova version`
  - Update program description
- Update `src/lib/completions.ts`:
  - Replace `getCommandRegistry()` with new command list (10 commands: track, costs, budget, sync, report, login, logout, account, completions, version)
  - Update all completion generators (bash, zsh, fish) to reflect new commands and their options
- Update `src/commands/account.ts`:
  - Change upsell messaging from "cloud build history and token analytics" to "team cost dashboard and budget alerts"
  - Change URL references from pricing to dashboard
- Verify `npm run build` succeeds

### 9. Write Comprehensive Test Suite

- **Task ID**: write-tests
- **Depends On**: update-entry-point
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Parallel**: false
- Read ALL new source files before writing any tests
- Read existing test files that were kept (auth-commands, dashboard, error-handler, update-checker) to match test patterns exactly
- Use vitest with the same patterns: `describe/it` blocks, `vi.mock`, `vi.spyOn`, temp directories for file tests
- Write `tests/collectors/claude-code.test.ts`:
  - Test isAvailable() with existing/missing ~/.claude/ directory
  - Test collect() with sample JSONL data (create fixture strings)
  - Test parsing various Claude model name formats
  - Test cost computation accuracy (known inputs -> expected costs)
  - Test deduplication (same record collected twice = 1 record)
  - Test handling of corrupted JSONL lines
  - Test --since filtering
  - Test empty directory handling
  - Aim for 15+ test cases
- Write `tests/cost-calculator.test.ts`:
  - Test computeCost for each model tier
  - Test aggregateCosts with mixed tool/model records
  - Test getDailyCosts grouping
  - Test getMonthlyCosts grouping
  - Test getToolCosts breakdown
  - Test getProjectCosts breakdown
  - Test edge cases: empty records, unknown models, zero tokens
  - Aim for 15+ test cases
- Write `tests/local-store.test.ts`:
  - Test read/write cycle
  - Test appendRecords with deduplication
  - Test queryRecords with all filter combinations
  - Test atomic write (temp file pattern)
  - Test handling of missing/corrupted database file
  - Test pruneOldRecords
  - Aim for 12+ test cases
- Write `tests/config-store.test.ts`:
  - Test readConfig with defaults
  - Test writeConfig/readConfig round-trip
  - Test updateConfig partial merge
  - Test getDefaultConfig values
  - Aim for 8+ test cases
- Write `tests/formatter.test.ts`:
  - Test formatCostSummary output structure
  - Test formatDailyTable alignment
  - Test formatBudgetStatus at various %
  - Test formatSparkline with various data
  - Test money formatting ($X.XX)
  - Test large number formatting (commas)
  - Aim for 10+ test cases
- Write `tests/commands/track.test.ts`:
  - Test track with mock collector
  - Test --since flag
  - Test --tool filter
  - Test summary output
  - Aim for 8+ test cases
- Write `tests/commands/costs.test.ts`:
  - Test default (current month) view
  - Test --today, --week, --month filters
  - Test --tool, --project filters
  - Test --json output format
  - Test --detailed output
  - Test with empty database
  - Aim for 10+ test cases
- Write `tests/commands/budget.test.ts`:
  - Test budget display
  - Test set monthly/daily
  - Test clear
  - Test warn-at threshold
  - Aim for 8+ test cases
- Write `tests/commands/sync.test.ts`:
  - Test sync with mock uploader
  - Test --dry-run
  - Test login requirement
  - Aim for 6+ test cases
- Write `tests/commands/report.test.ts`:
  - Test CSV output format
  - Test JSON output format
  - Test --output file writing
  - Test --month filter
  - Aim for 6+ test cases
- Write `tests/integration/track-to-costs.test.ts`:
  - End-to-end: create mock JSONL files -> run track -> verify local store -> run costs -> verify output
  - Test the full happy path
  - Test budget alert triggering
  - Aim for 5+ test cases
- Run `npm run test` and verify all tests pass
- Target: 120+ new tests minimum

### 10. Final Validation

- **Task ID**: validate-all
- **Depends On**: write-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `npm run build` -- verify zero errors
- Run `npm run lint` -- verify zero type errors
- Run `npm run test` -- verify all tests pass
- Verify no orchestration code remains (grep for "plan", "build", "team-build", "scaffold", "checkpoint" in src/)
- Verify all new commands are registered in index.ts
- Verify shell completions include all new commands
- Verify package.json has correct version (0.2.0), description, and keywords
- Verify no references to old commands in any remaining file
- Verify TOKEN_COSTS table is accurate
- Verify the CLI can be invoked: `node dist/index.js --help` shows correct commands
- Verify `node dist/index.js costs --help` shows correct options
- Verify `node dist/index.js track --help` shows correct options
- Report pass/fail for each criterion
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. `npm run build` succeeds with zero errors
2. `npm run lint` passes with zero type errors
3. `npm run test` passes with 120+ tests, zero failures
4. `kova --help` shows exactly 10 commands: track, costs, budget, sync, report, login, logout, account, completions, version
5. `kova track` successfully reads Claude Code JSONL files from `~/.claude/` and records usage
6. `kova costs` displays accurate cost breakdown with daily, model, and project groupings
7. `kova budget set --monthly 100` sets a budget that is displayed in `kova costs` output
8. `kova report --format csv` produces valid CSV output
9. `kova report --format json` produces valid JSON matching CostSummary type
10. `kova sync` requires login and uploads usage data to the dashboard API
11. No references to old orchestration commands exist in the codebase
12. All new types are properly exported from `src/types.ts`
13. Shell completions (bash/zsh/fish) include all 10 commands with correct options
14. Cost calculations are accurate: verified against known token counts and model pricing
15. Local store handles deduplication correctly (same record collected twice = stored once)

## Validation Commands

Execute these commands to validate the task is complete:

- `npm run build` - Verify the project builds without TypeScript errors
- `npm run lint` - Verify type checking passes
- `npm run test` - Run the full test suite, expect 120+ tests passing
- `node dist/index.js --help` - Verify CLI shows correct commands and description
- `node dist/index.js track --help` - Verify track command options
- `node dist/index.js costs --help` - Verify costs command options
- `node dist/index.js budget --help` - Verify budget command options
- `node dist/index.js report --help` - Verify report command options
- `node dist/index.js sync --help` - Verify sync command options

## Notes

- **Privacy is paramount**: The CLI must NEVER send source code, file contents, prompts, or full file paths to the cloud. Only token counts, model names, project names (folder name only), timestamps, and computed costs.
- **Offline-first**: All core features (track, costs, budget, report) work without network. Only `sync` and `login` require network.
- **Claude Code JSONL format**: The exact format of Claude Code's local JSONL files may vary. The collector should be defensive -- log warnings for unparseable lines but never crash. If the JSONL format cannot be determined, fall back to reading conversation metadata files.
- **Deterministic IDs**: Usage record IDs must be deterministic (hash-based) so that running `kova track` multiple times doesn't create duplicates.
- **Future extensibility**: The `Collector` interface is designed so Cursor, Copilot, and other collectors can be added without changing the core architecture.
- **Token cost accuracy**: Use the TOKEN_COSTS table from constants.ts for Claude models. For future tools (Cursor credits, Copilot seats), costs will be approximate until those tools expose better data.
- **This plan covers CLI only**: The web dashboard changes (kova-website repo) are a separate future plan.

# Plan: Kova v2.1 -- Short-term, Medium-term, and MCP Server Features

## Task Description

Implement 8 features for Kova CLI v2.1: 3 short-term (Claude Code hook, run improvements, session history), 4 medium-term (smart fallback, orchestrator budgets, multi-file context, bench command), and 1 longer-term (MCP server). Bump version to 2.1.0.

## Objective

When complete:

1. A Claude Code hook auto-records tool usage to Kova's cost pipeline
2. `kova run` supports `--context <file>` (repeatable) and `--include <glob>` for file context
3. `kova history` shows past AI sessions with filtering by tool, project, and time range
4. Smart model fallback retries on 429/5xx errors, stepping down tiers
5. `kova run`/`kova chat` support `--budget <usd>` session caps with warnings
6. `kova run --include "src/**/*.ts"` feeds matching files as context
7. `kova bench` compares models side-by-side on the same prompt
8. `kova mcp` starts an MCP server exposing cost data to AI tools
9. All tests pass, zero type errors, build succeeds
10. Version is 2.1.0

## Problem Statement

Kova v2.0 has a capable orchestrator and cost tracking, but lacks integration hooks (you must manually run `kova track`), session visibility, resilience (no fallback on errors), budget guardrails for AI sessions, and programmatic access via MCP. These features close the gap between a standalone CLI and an always-on cost intelligence layer.

## Solution Approach

Build features in dependency order: foundational changes first (types, config schema), then independent features in parallel, then integration features that depend on multiple foundations. The MCP server wraps existing data functions with minimal new logic.

## Relevant Files

### Existing files to modify

- `src/types.ts` -- Add new config fields (session_budget, fallback), extend OrchestrationConfig
- `src/lib/constants.ts` -- Bump VERSION to 2.1.0, add MODEL_FALLBACK_CHAIN
- `src/lib/config-store.ts` -- Add new orchestration fields to deep merge
- `src/lib/ai/model-router.ts` -- Add `getNextFallbackModel()` function
- `src/lib/ai/system-prompt.ts` -- Accept optional file context parameter
- `src/commands/run.ts` -- Add --context, --include, --budget flags; integrate fallback and budget
- `src/commands/chat.ts` -- Add --budget flag; integrate budget checking
- `src/commands/config-cmd.ts` -- Add orchestration.fallback, orchestration.session_budget keys
- `src/index.ts` -- Register history, bench, mcp commands
- `package.json` -- Bump to 2.1.0, add @modelcontextprotocol/sdk dependency

### New files to create

- `src/commands/history.ts` -- Session history command
- `src/commands/bench.ts` -- Model benchmarking command
- `src/commands/mcp.ts` -- MCP server command (starts stdio server)
- `src/lib/ai/fallback.ts` -- Smart model fallback with retry logic
- `src/lib/ai/context-loader.ts` -- File context loading (glob, individual files)
- `src/lib/ai/budget-guard.ts` -- Session budget tracking and enforcement
- `src/mcp/server.ts` -- MCP server setup with resources and tools
- `src/mcp/resources.ts` -- MCP resource handlers (costs, budget, usage)
- `src/mcp/tools.ts` -- MCP tool handlers (get_costs, track, budget_check)
- `templates/claude-hook.json` -- Claude Code PostToolUse hook template
- `tests/commands/history.test.ts`
- `tests/commands/bench.test.ts`
- `tests/commands/mcp.test.ts`
- `tests/lib/ai/fallback.test.ts`
- `tests/lib/ai/context-loader.test.ts`
- `tests/lib/ai/budget-guard.test.ts`
- `tests/mcp/server.test.ts`

## Implementation Phases

### Phase 1: Foundation

- Version bump to 2.1.0
- Extend types (OrchestrationConfig with fallback, session_budget)
- Add MODEL_FALLBACK_CHAIN to constants
- Update config-store deep merge for new fields
- Create context-loader utility (used by both run improvements and multi-file context)
- Create budget-guard utility (used by both run and chat)
- Create fallback utility (used by both run and chat)

### Phase 2: Core Implementation

- Session history command
- Run command improvements (--context, --include, --budget, fallback integration)
- Chat command improvements (--budget, fallback integration)
- Bench command
- Claude Code hook template
- MCP server with resources and tools

### Phase 3: Integration & Polish

- Register all new commands in index.ts
- Config-cmd support for new keys
- Tests for all new code
- Build, typecheck, run full test suite

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
  - Name: foundation-engineer
  - Role: Types, constants, config schema, version bump, and shared utilities (context-loader, budget-guard, fallback)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: feature-builder-a
  - Role: History command, run improvements (--context, --include, --budget, fallback), chat improvements
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: feature-builder-b
  - Role: Bench command, Claude Code hook template
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: mcp-engineer
  - Role: MCP server implementation (server, resources, tools, command)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: test-writer
  - Role: Write and fix tests for all new features
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

### 1. Foundation: Version Bump and Type Extensions

- **Task ID**: foundation-types
- **Depends On**: none
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

1. Bump `VERSION` in `src/lib/constants.ts` from `"2.0.0"` to `"2.1.0"`
2. Bump `"version"` in `package.json` from `"2.0.0"` to `"2.1.0"`
3. Add to `src/lib/constants.ts`:

```typescript
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
```

4. Extend `OrchestrationConfig` in `src/types.ts`:

```typescript
export interface OrchestrationConfig {
  default_provider: AiProvider;
  default_model?: string;
  routing: {
    simple: string;
    moderate: string;
    complex: string;
  };
  auto_apply: boolean;
  max_tokens: number;
  temperature: number;
  // NEW v2.1 fields
  fallback: boolean; // enable smart model fallback (default: true)
  session_budget?: number; // per-session budget cap in USD (optional)
}
```

5. Update `getDefaultConfig()` in `src/lib/config-store.ts` to ensure new orchestration fields have sensible defaults when accessed.

6. Update `updateConfig` in `src/lib/config-store.ts` to properly deep-merge orchestration fields (it already handles `routing` deep merge from v2.0 polish -- ensure new scalar fields like `fallback` and `session_budget` are preserved).

7. Add new config keys to `buildPartialConfig` in `src/commands/config-cmd.ts`:

```typescript
case "orchestration.fallback": {
  const bool = parseBoolean(value);
  if (bool === null) return null;
  return { orchestration: { fallback: bool } } as any;
}
case "orchestration.session_budget": {
  const num = parseNumber(value);
  if (num === null) return null;
  return { orchestration: { session_budget: num } } as any;
}
```

And update the help text to include these keys.

### 2. Foundation: Context Loader Utility

- **Task ID**: context-loader
- **Depends On**: none
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/lib/ai/context-loader.ts`:

```typescript
import fs from "fs";
import path from "path";
import { glob } from "node:fs/promises"; // Node 22+ or use fast-glob

// For Node 18 compat, use a simple recursive readdir + minimatch approach
// or just shell out to find/glob via execa

export interface LoadedContext {
  files: { path: string; content: string; sizeBytes: number }[];
  totalBytes: number;
  truncated: boolean;
}

const MAX_CONTEXT_BYTES = 500_000; // ~500KB, roughly 125K tokens

/**
 * Load specific files by path.
 */
export function loadFiles(
  filePaths: string[],
  workingDir: string,
): LoadedContext {
  const files: LoadedContext["files"] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const filePath of filePaths) {
    const fullPath = path.resolve(workingDir, filePath);
    // Security: must be within workingDir
    if (!fullPath.startsWith(workingDir)) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const sizeBytes = Buffer.byteLength(content, "utf-8");

      if (totalBytes + sizeBytes > MAX_CONTEXT_BYTES) {
        truncated = true;
        break;
      }

      files.push({ path: filePath, content, sizeBytes });
      totalBytes += sizeBytes;
    } catch {
      // Skip unreadable files
    }
  }

  return { files, totalBytes, truncated };
}

/**
 * Load files matching glob patterns.
 * Respects .gitignore by default. Skips node_modules, .git, dist, etc.
 */
export async function loadGlob(
  patterns: string[],
  workingDir: string,
): Promise<LoadedContext> {
  const { execaCommand } = await import("execa");

  const allFiles: string[] = [];

  for (const pattern of patterns) {
    try {
      // Use find or rg --files --glob for Node 18 compat
      const { stdout } = await execaCommand(
        `rg --files --glob "${pattern}" --max-filesize 100K`,
        { cwd: workingDir, timeout: 10_000 },
      );
      const files = stdout.split("\n").filter(Boolean);
      allFiles.push(...files);
    } catch {
      // Pattern matched nothing or rg not available
    }
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];

  return loadFiles(uniqueFiles, workingDir);
}

/**
 * Format loaded context as a string to prepend to system prompt or user message.
 */
export function formatContext(context: LoadedContext): string {
  if (context.files.length === 0) return "";

  const parts = context.files.map((f) => `--- ${f.path} ---\n${f.content}`);

  let result = `<context>\nThe following ${context.files.length} file(s) are provided as context:\n\n${parts.join("\n\n")}\n</context>`;

  if (context.truncated) {
    result += "\n\n(Note: Some files were omitted due to context size limits.)";
  }

  return result;
}
```

### 3. Foundation: Budget Guard Utility

- **Task ID**: budget-guard
- **Depends On**: none
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/lib/ai/budget-guard.ts`:

```typescript
import { colors } from "../constants.js";
import * as logger from "../logger.js";

export interface BudgetGuard {
  /** Record spending. Returns false if budget exceeded (hard stop). */
  recordSpend(amount: number): boolean;
  /** Check if budget is approaching or exceeded. */
  check(): BudgetStatus;
  /** Get total spent so far. */
  spent(): number;
}

export interface BudgetStatus {
  spent: number;
  budget: number;
  percent: number;
  warning: boolean; // >= 80% of budget
  exceeded: boolean; // >= 100% of budget
}

/**
 * Create a budget guard for a session.
 * @param budgetUsd Maximum budget in USD. If 0 or undefined, no enforcement.
 * @param warnPercent Percentage at which to warn (default 80).
 */
export function createBudgetGuard(
  budgetUsd: number | undefined,
  warnPercent = 80,
): BudgetGuard | null {
  if (!budgetUsd || budgetUsd <= 0) return null;

  let totalSpent = 0;
  let hasWarned = false;

  return {
    recordSpend(amount: number): boolean {
      totalSpent += amount;

      const percent = (totalSpent / budgetUsd) * 100;

      if (percent >= 100) {
        logger.warn(
          `Budget exceeded: ${colors.brand("$" + totalSpent.toFixed(4))} / $${budgetUsd.toFixed(2)} (${percent.toFixed(0)}%)`,
        );
        return false; // hard stop
      }

      if (percent >= warnPercent && !hasWarned) {
        hasWarned = true;
        logger.warn(
          `Approaching budget: ${colors.brand("$" + totalSpent.toFixed(4))} / $${budgetUsd.toFixed(2)} (${percent.toFixed(0)}%)`,
        );
      }

      return true; // continue
    },

    check(): BudgetStatus {
      const percent = budgetUsd > 0 ? (totalSpent / budgetUsd) * 100 : 0;
      return {
        spent: totalSpent,
        budget: budgetUsd,
        percent,
        warning: percent >= warnPercent,
        exceeded: percent >= 100,
      };
    },

    spent(): number {
      return totalSpent;
    },
  };
}
```

### 4. Foundation: Smart Fallback Utility

- **Task ID**: fallback-util
- **Depends On**: foundation-types
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false (needs the types and constants from task 1)

Create `src/lib/ai/fallback.ts`:

```typescript
import type { ProviderRegistry } from "ai";
import { MODEL_FALLBACK_CHAIN } from "../constants.js";
import { getModelDisplayName } from "./model-router.js";
import * as logger from "../logger.js";

export interface FallbackResult {
  modelId: string;
  attempt: number;
}

/**
 * Determine if an error is retryable (rate limit or server error).
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();

  // Rate limit
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  // Server errors
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("internal server error")
  ) {
    return true;
  }

  // Overloaded
  if (message.includes("overloaded") || message.includes("capacity")) {
    return true;
  }

  return false;
}

/**
 * Get the next fallback model for a given model ID.
 * Returns null if no fallback available.
 */
export function getNextFallbackModel(
  currentModelId: string,
  attemptedModels: Set<string>,
): string | null {
  const chain = MODEL_FALLBACK_CHAIN[currentModelId];
  if (!chain) return null;

  for (const fallback of chain) {
    if (!attemptedModels.has(fallback)) {
      return fallback;
    }
  }

  return null;
}

/**
 * Execute a function with smart model fallback.
 * @param initialModelId The first model to try
 * @param fn The function to execute (receives modelId, returns result)
 * @param enabled Whether fallback is enabled
 */
export async function withFallback<T>(
  initialModelId: string,
  fn: (modelId: string) => Promise<T>,
  enabled: boolean,
): Promise<{ result: T; modelId: string }> {
  const attemptedModels = new Set<string>();
  let currentModelId = initialModelId;

  while (true) {
    attemptedModels.add(currentModelId);

    try {
      const result = await fn(currentModelId);
      return { result, modelId: currentModelId };
    } catch (err) {
      if (!enabled || !isRetryableError(err)) {
        throw err;
      }

      const nextModel = getNextFallbackModel(currentModelId, attemptedModels);
      if (!nextModel) {
        throw err; // No more fallbacks, rethrow original error
      }

      logger.warn(
        `${getModelDisplayName(currentModelId)} unavailable, falling back to ${getModelDisplayName(nextModel)}`,
      );

      // Brief delay before retry (1s)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      currentModelId = nextModel;
    }
  }
}
```

### 5. Session History Command

- **Task ID**: history-cmd
- **Depends On**: none
- **Assigned To**: feature-builder-a
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/commands/history.ts`:

```typescript
import { queryRecords } from "../lib/local-store.js";
import { colors } from "../lib/constants.js";
import { getModelDisplayName } from "../lib/ai/model-router.js";
import * as logger from "../lib/logger.js";
import type { AiTool } from "../types.js";

export interface HistoryOptions {
  tool?: string;
  project?: string;
  days?: string;
  limit?: string;
}

export async function historyCommand(options: HistoryOptions): Promise<void> {
  const days = options.days ? parseInt(options.days, 10) : 30;
  const limit = options.limit ? parseInt(options.limit, 10) : 50;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = queryRecords({
    tool: options.tool as AiTool | undefined,
    project: options.project,
    since,
  });

  if (records.length === 0) {
    logger.info("No usage records found for the given filters.");
    logger.info("Try: kova history --days 90 or kova track to scan for usage.");
    return;
  }

  // Group by session
  const sessions = new Map<string, typeof records>();
  for (const record of records) {
    const key = record.session_id || record.id; // solo records use their own id
    const group = sessions.get(key) ?? [];
    group.push(record);
    sessions.set(key, group);
  }

  logger.header("Session History");
  logger.info(
    `Showing last ${days} days${options.tool ? ` (tool: ${options.tool})` : ""}${options.project ? ` (project: ${options.project})` : ""}\n`,
  );

  // Build summary rows from sessions, sorted by most recent first
  const summaries = [...sessions.entries()]
    .map(([sessionId, recs]) => {
      const totalCost = recs.reduce((sum, r) => sum + r.cost_usd, 0);
      const totalInputTokens = recs.reduce((sum, r) => sum + r.input_tokens, 0);
      const totalOutputTokens = recs.reduce(
        (sum, r) => sum + r.output_tokens,
        0,
      );
      const totalDuration = recs.reduce(
        (sum, r) => sum + (r.duration_ms ?? 0),
        0,
      );
      const models = [...new Set(recs.map((r) => r.model))];
      const tools = [...new Set(recs.map((r) => r.tool))];
      const projects = [...new Set(recs.map((r) => r.project).filter(Boolean))];
      const timestamp = recs.reduce(
        (latest, r) => (r.timestamp > latest ? r.timestamp : latest),
        recs[0].timestamp,
      );

      return {
        sessionId: sessionId.slice(0, 8),
        timestamp,
        tool: tools.join(", "),
        model: models.map((m) => m).join(", "),
        project: projects.join(", ") || "-",
        cost: totalCost,
        tokens: totalInputTokens + totalOutputTokens,
        duration: totalDuration,
        turns: recs.length,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  // Display as table
  const rows: [string, string][] = [];
  for (const s of summaries) {
    const date = s.timestamp.slice(0, 10);
    const time = s.timestamp.slice(11, 16);
    const durationStr =
      s.duration > 0 ? `${(s.duration / 1000).toFixed(0)}s` : "-";

    rows.push([
      `${date} ${time}`,
      `${colors.brand("$" + s.cost.toFixed(4))} | ${s.model} | ${s.project} | ${s.tokens.toLocaleString()} tok | ${durationStr} | ${s.turns} turns`,
    ]);
  }

  logger.table(rows);

  // Summary
  const totalCost = summaries.reduce((sum, s) => sum + s.cost, 0);
  console.log();
  logger.info(
    `Total: ${colors.brand("$" + totalCost.toFixed(4))} across ${summaries.length} sessions`,
  );
}
```

Register in `src/index.ts`:

```typescript
program
  .command("history")
  .description("View past AI session history with costs")
  .option(
    "--tool <tool>",
    "Filter by tool (e.g., kova_orchestrator, claude_code)",
  )
  .option("--project <name>", "Filter by project name")
  .option("--days <n>", "Look back N days (default: 30)")
  .option("--limit <n>", "Max sessions to show (default: 50)")
  .action(
    wrapCommandAction(async (options) => {
      const { historyCommand } = await import("./commands/history.js");
      await historyCommand(
        options as import("./commands/history.js").HistoryOptions,
      );
    }),
  );
```

### 6. Run Command Improvements

- **Task ID**: run-improvements
- **Depends On**: context-loader, budget-guard, fallback-util
- **Assigned To**: feature-builder-a
- **Agent Type**: backend-engineer
- **Parallel**: false

Modify `src/commands/run.ts`:

1. Add new options to `RunOptions`:

```typescript
export interface RunOptions {
  model?: string;
  provider?: string;
  tier?: string;
  dryRun?: boolean;
  autoApply?: boolean;
  context?: string[]; // NEW: --context file paths (repeatable)
  include?: string[]; // NEW: --include glob patterns (repeatable)
  budget?: string; // NEW: --budget <usd> session cap
}
```

2. After model selection and before dry-run check, load context:

```typescript
import {
  loadFiles,
  loadGlob,
  formatContext,
} from "../lib/ai/context-loader.js";
import { createBudgetGuard } from "../lib/ai/budget-guard.js";
import { withFallback } from "../lib/ai/fallback.js";

// Load file context
let fileContext = "";
if (options.context?.length || options.include?.length) {
  const contextFiles = options.context
    ? loadFiles(options.context, workingDir)
    : { files: [], totalBytes: 0, truncated: false };

  const globContext = options.include
    ? await loadGlob(options.include, workingDir)
    : { files: [], totalBytes: 0, truncated: false };

  // Merge both contexts
  const merged = {
    files: [...contextFiles.files, ...globContext.files],
    totalBytes: contextFiles.totalBytes + globContext.totalBytes,
    truncated: contextFiles.truncated || globContext.truncated,
  };

  fileContext = formatContext(merged);

  if (merged.files.length > 0 && !options.dryRun) {
    logger.info(
      `Context: ${merged.files.length} files (${(merged.totalBytes / 1024).toFixed(0)} KB)`,
    );
  }
}
```

3. In dry-run output, show context file count if any.

4. Create budget guard:

```typescript
const budgetUsd = options.budget
  ? parseFloat(options.budget)
  : config.orchestration?.session_budget;
const budgetGuard = createBudgetGuard(budgetUsd);
```

5. Wrap the streamText call with `withFallback`:

```typescript
const fallbackEnabled = config.orchestration?.fallback !== false;

const { result, modelId: finalModelId } = await withFallback(
  modelId,
  async (currentModelId) => {
    return streamText({
      model: registry.languageModel(currentModelId as `${string}:${string}`),
      system:
        buildSystemPrompt(workingDir) +
        (fileContext ? "\n\n" + fileContext : ""),
      prompt,
      tools: createCodingTools(workingDir),
      stopWhen: stepCountIs(25),
      maxOutputTokens: config.orchestration?.max_tokens ?? 8192,
      temperature: config.orchestration?.temperature ?? 0,
      onStepFinish(event) {
        for (const tc of event.toolCalls) {
          const input = tc.input as Record<string, unknown>;
          const filePath =
            input.filePath ?? input.dirPath ?? input.command ?? "";
          logger.progress("done", tc.toolName, String(filePath));
        }
      },
    });
  },
  fallbackEnabled,
);
```

6. After recording cost, check budget:

```typescript
if (budgetGuard) {
  const withinBudget = budgetGuard.recordSpend(record.cost_usd);
  if (!withinBudget) {
    logger.error("Session budget exceeded. Stopping.");
    // For run command, this is after the single execution, so just inform
  }
}
```

7. Register new options in `src/index.ts`:

```typescript
.option("--context <file>", "Attach file as context (repeatable)", collect, [])
.option("--include <glob>", "Include files matching glob as context (repeatable)", collect, [])
.option("--budget <usd>", "Session budget cap in USD")
```

Add a `collect` helper:

```typescript
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
```

### 7. Chat Command Improvements

- **Task ID**: chat-improvements
- **Depends On**: budget-guard, fallback-util
- **Assigned To**: feature-builder-a
- **Agent Type**: backend-engineer
- **Parallel**: false (depends on budget-guard and fallback being done)

Modify `src/commands/chat.ts`:

1. Add `budget` option to `ChatOptions`:

```typescript
export interface ChatOptions {
  model?: string;
  provider?: string;
  tier?: string;
  budget?: string; // NEW
}
```

2. Create budget guard after session setup:

```typescript
const budgetUsd = options.budget
  ? parseFloat(options.budget)
  : config.orchestration?.session_budget;
const budgetGuard = createBudgetGuard(budgetUsd);
```

3. Wrap the streamText call in the line handler with `withFallback`:

```typescript
const fallbackEnabled = config.orchestration?.fallback !== false;

const { result } = await withFallback(
  modelId,
  async (currentModelId) => {
    return streamText({ ... });
  },
  fallbackEnabled,
);
```

4. After recording cost, check budget:

```typescript
if (budgetGuard) {
  const withinBudget = budgetGuard.recordSpend(record.cost_usd);
  if (!withinBudget) {
    logger.error("Session budget exceeded. Ending chat.");
    rl.close();
    return;
  }
}
```

5. Update `/cost` handler to include budget info:

```typescript
if (input === "/cost") {
  logger.info(
    `Session cost: ${colors.brand("$" + session.costUsd.toFixed(4))}`,
  );
  logger.info(`Turns: ${Math.floor(messages.length / 2)}`);
  if (budgetGuard) {
    const status = budgetGuard.check();
    logger.info(
      `Budget: $${status.spent.toFixed(4)} / $${status.budget.toFixed(2)} (${status.percent.toFixed(0)}%)`,
    );
  }
  rl.prompt();
  return;
}
```

6. Register --budget in index.ts for chat command.

### 8. Bench Command

- **Task ID**: bench-cmd
- **Depends On**: foundation-types
- **Assigned To**: feature-builder-b
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/commands/bench.ts`:

```typescript
import { streamText, stepCountIs } from "ai";
import crypto from "crypto";
import path from "path";
import { recordAiUsage } from "../lib/ai/cost-recorder.js";
import { getModelDisplayName } from "../lib/ai/model-router.js";
import { createKovaRegistry } from "../lib/ai/provider-registry.js";
import { buildSystemPrompt } from "../lib/ai/system-prompt.js";
import { createCodingTools } from "../lib/ai/tools.js";
import { readConfig } from "../lib/config-store.js";
import { colors, MODEL_TIERS } from "../lib/constants.js";
import { readProviderCredentials } from "../lib/credential-manager.js";
import * as logger from "../lib/logger.js";

export interface BenchOptions {
  models?: string; // comma-separated model short names
  noTools?: boolean; // disable tools for pure text comparison
}

interface BenchResult {
  model: string;
  displayName: string;
  responseTime: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  responsePreview: string;
  error?: string;
}

export async function benchCommand(
  prompt: string,
  options: BenchOptions,
): Promise<void> {
  const config = readConfig();
  const creds = readProviderCredentials();
  const registry = await createKovaRegistry(creds);

  if (!registry) {
    logger.error("No AI providers configured. Run: kova provider add <name>");
    process.exitCode = 1;
    return;
  }

  // Parse model list
  let modelIds: string[];
  if (options.models) {
    modelIds = options.models.split(",").map((m) => {
      const trimmed = m.trim();
      const tier = MODEL_TIERS[trimmed];
      return tier ? `${tier.provider}:${tier.sdkId}` : trimmed;
    });
  } else {
    // Default: compare routing models
    const routing = config.orchestration?.routing ?? {
      simple: "anthropic:claude-haiku-4-5-20251001",
      moderate: "anthropic:claude-sonnet-4-20250514",
      complex: "anthropic:claude-opus-4-20250115",
    };
    modelIds = [routing.simple, routing.moderate, routing.complex];
  }

  const workingDir = process.cwd();
  const projectName = path.basename(workingDir);
  const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  logger.header("kova bench");
  logger.info(
    `Prompt: "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
  );
  logger.info(`Models: ${modelIds.map(getModelDisplayName).join(", ")}`);
  console.log();

  const results: BenchResult[] = [];

  for (const modelId of modelIds) {
    const displayName = getModelDisplayName(modelId);
    process.stdout.write(`  Running ${displayName}...`);

    const startTime = Date.now();

    try {
      const result = streamText({
        model: registry.languageModel(modelId as `${string}:${string}`),
        system: buildSystemPrompt(workingDir),
        prompt,
        tools: options.noTools ? undefined : createCodingTools(workingDir),
        stopWhen: stepCountIs(10),
        maxOutputTokens: config.orchestration?.max_tokens ?? 4096,
        temperature: config.orchestration?.temperature ?? 0,
      });

      let fullResponse = "";
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      const durationMs = Date.now() - startTime;
      const usage = await result.usage;
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      const record = recordAiUsage({
        modelId: modelId.split(":")[1] ?? modelId,
        usage: { inputTokens, outputTokens },
        sessionId,
        project: projectName,
        durationMs,
      });

      results.push({
        model: modelId,
        displayName,
        responseTime: durationMs,
        inputTokens,
        outputTokens,
        cost: record.cost_usd,
        responsePreview: fullResponse.slice(0, 200).replace(/\n/g, " "),
      });

      process.stdout.write(` done (${(durationMs / 1000).toFixed(1)}s)\n`);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        model: modelId,
        displayName,
        responseTime: durationMs,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        responsePreview: "",
        error: message.slice(0, 100),
      });
      process.stdout.write(` error\n`);
    }
  }

  // Display comparison table
  console.log();
  logger.header("Results");

  const rows: [string, string][] = [];
  for (const r of results) {
    if (r.error) {
      rows.push([r.displayName, colors.error(`Error: ${r.error}`)]);
    } else {
      rows.push([
        r.displayName,
        `${colors.brand("$" + r.cost.toFixed(4))} | ${(r.responseTime / 1000).toFixed(1)}s | ${(r.inputTokens + r.outputTokens).toLocaleString()} tokens`,
      ]);
    }
  }
  logger.table(rows);

  // Response previews
  console.log();
  for (const r of results) {
    if (!r.error && r.responsePreview) {
      logger.info(`${colors.bold(r.displayName)}:`);
      logger.info(
        colors.dim(
          `  ${r.responsePreview}${r.responsePreview.length >= 200 ? "..." : ""}`,
        ),
      );
      console.log();
    }
  }

  // Summary
  const successResults = results.filter((r) => !r.error);
  if (successResults.length > 1) {
    const cheapest = successResults.reduce((a, b) => (a.cost < b.cost ? a : b));
    const fastest = successResults.reduce((a, b) =>
      a.responseTime < b.responseTime ? a : b,
    );
    logger.info(
      `Cheapest: ${colors.brand(cheapest.displayName)} ($${cheapest.cost.toFixed(4)})`,
    );
    logger.info(
      `Fastest: ${colors.brand(fastest.displayName)} (${(fastest.responseTime / 1000).toFixed(1)}s)`,
    );
  }
}
```

Register in `src/index.ts`:

```typescript
program
  .command("bench <prompt>")
  .description("Benchmark a prompt against multiple models")
  .option(
    "--models <list>",
    "Comma-separated model names (e.g., sonnet,gpt-4o,gemini-pro)",
  )
  .option("--no-tools", "Disable tools for pure text comparison")
  .action(
    wrapCommandAction(async (prompt, options) => {
      const { benchCommand } = await import("./commands/bench.js");
      await benchCommand(
        prompt as string,
        options as import("./commands/bench.js").BenchOptions,
      );
    }),
  );
```

### 9. Claude Code Hook Template

- **Task ID**: claude-hook
- **Depends On**: none
- **Assigned To**: feature-builder-b
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `templates/claude-hook.json` -- a Claude Code hooks config that users can copy to their project's `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "kova track --tool claude_code --quiet 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

Add a new subcommand to the existing CLI: `kova hook install` that:

1. Reads the template
2. Checks if `.claude/settings.json` exists in the current project
3. If exists, merges the hook config (preserving existing hooks)
4. If not, creates `.claude/settings.json` with the hook config
5. Shows success message

Create `src/commands/hook.ts`:

```typescript
import fs from "fs";
import path from "path";
import * as logger from "../lib/logger.js";

export async function hookCommand(action?: string): Promise<void> {
  if (action !== "install") {
    logger.header("Kova Hook");
    logger.info("Usage: kova hook install");
    logger.info(
      "Installs a Claude Code hook that auto-tracks usage after each session.",
    );
    return;
  }

  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  const hookConfig = {
    hooks: {
      Stop: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command:
                "kova track --tool claude_code --quiet 2>/dev/null || true",
            },
          ],
        },
      ],
    },
  };

  // Ensure .claude directory exists
  fs.mkdirSync(claudeDir, { recursive: true });

  if (fs.existsSync(settingsPath)) {
    // Merge with existing settings
    try {
      const existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      existing.hooks = existing.hooks ?? {};
      existing.hooks.Stop = existing.hooks.Stop ?? [];

      // Check if our hook is already installed
      const alreadyInstalled = existing.hooks.Stop.some((entry: any) =>
        entry.hooks?.some((h: any) => h.command?.includes("kova track")),
      );

      if (alreadyInstalled) {
        logger.info("Kova hook is already installed in this project.");
        return;
      }

      existing.hooks.Stop.push(hookConfig.hooks.Stop[0]);
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(existing, null, 2),
        "utf-8",
      );
    } catch {
      // If we can't parse existing, create fresh
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(hookConfig, null, 2),
        "utf-8",
      );
    }
  } else {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(hookConfig, null, 2),
      "utf-8",
    );
  }

  logger.success("Kova hook installed!");
  logger.info("Claude Code will now auto-track usage after each session.");
  logger.info(`Hook added to: ${settingsPath}`);
}
```

Register in `src/index.ts`:

```typescript
program
  .command("hook [action]")
  .description("Manage Claude Code integration hooks")
  .action(
    wrapCommandAction(async (action) => {
      const { hookCommand } = await import("./commands/hook.js");
      await hookCommand(action as string | undefined);
    }),
  );
```

### 10. MCP Server Implementation

- **Task ID**: mcp-server
- **Depends On**: foundation-types
- **Assigned To**: mcp-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

First, install the MCP SDK. In `package.json`, add to dependencies:

```json
"@modelcontextprotocol/sdk": "^1.12.1"
```

Create `src/mcp/server.ts`:

```typescript
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { aggregateCosts, getDailyCosts } from "../lib/cost-calculator.js";
import { readConfig } from "../lib/config-store.js";
import { formatMoney } from "../lib/formatter.js";
import { queryRecords } from "../lib/local-store.js";
import { VERSION } from "../lib/constants.js";
import type { AiTool } from "../types.js";

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "kova",
    version: VERSION,
  });

  // ── Resources ──────────────────────────────────────────────

  server.resource("costs-today", "kova://costs/today", async (uri) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = queryRecords({ since: today });
    const summary = aggregateCosts(records);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              period: "today",
              total_cost_usd: summary.total_cost_usd,
              total_sessions: summary.total_sessions,
              total_input_tokens: summary.total_input_tokens,
              total_output_tokens: summary.total_output_tokens,
              by_tool: summary.by_tool,
              by_model: summary.by_model,
            },
            null,
            2,
          ),
        },
      ],
    };
  });

  server.resource("costs-week", "kova://costs/week", async (uri) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const records = queryRecords({ since: weekAgo });
    const summary = aggregateCosts(records);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              period: "last_7_days",
              total_cost_usd: summary.total_cost_usd,
              total_sessions: summary.total_sessions,
              by_day: summary.by_day,
              by_tool: summary.by_tool,
              by_model: summary.by_model,
            },
            null,
            2,
          ),
        },
      ],
    };
  });

  server.resource("budget-status", "kova://budget/status", async (uri) => {
    const config = readConfig();
    const now = new Date();

    // Monthly
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRecords = queryRecords({ since: monthStart });
    const monthCost = monthRecords.reduce((sum, r) => sum + r.cost_usd, 0);

    // Daily
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayRecords = queryRecords({ since: dayStart });
    const dayCost = dayRecords.reduce((sum, r) => sum + r.cost_usd, 0);

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              monthly: {
                budget_usd: config.budget.monthly_usd,
                spent_usd: monthCost,
                percent: config.budget.monthly_usd
                  ? (monthCost / config.budget.monthly_usd) * 100
                  : null,
              },
              daily: {
                budget_usd: config.budget.daily_usd,
                spent_usd: dayCost,
                percent: config.budget.daily_usd
                  ? (dayCost / config.budget.daily_usd) * 100
                  : null,
              },
              warn_at_percent: config.budget.warn_at_percent,
            },
            null,
            2,
          ),
        },
      ],
    };
  });

  // ── Tools ──────────────────────────────────────────────────

  server.tool(
    "get_costs",
    "Get AI tool cost summary for a time period",
    {
      period: z.enum(["today", "week", "month", "all"]).default("today"),
      tool: z
        .string()
        .optional()
        .describe("Filter by specific tool (e.g., claude_code, cursor)"),
      project: z.string().optional().describe("Filter by project name"),
    },
    async ({ period, tool, project }) => {
      const since = new Date();
      switch (period) {
        case "today":
          since.setHours(0, 0, 0, 0);
          break;
        case "week":
          since.setDate(since.getDate() - 7);
          break;
        case "month":
          since.setDate(since.getDate() - 30);
          break;
        case "all":
          since.setFullYear(2020);
          break;
      }

      const records = queryRecords({
        tool: tool as AiTool | undefined,
        project,
        since,
      });

      const summary = aggregateCosts(records);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                total_cost_usd: summary.total_cost_usd,
                formatted_cost: formatMoney(summary.total_cost_usd),
                total_sessions: summary.total_sessions,
                total_tokens:
                  summary.total_input_tokens + summary.total_output_tokens,
                by_tool: summary.by_tool,
                by_model: summary.by_model,
                by_project: summary.by_project,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "budget_check",
    "Check current budget status and spending alerts",
    {},
    async () => {
      const config = readConfig();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      const monthRecords = queryRecords({ since: monthStart });
      const dayRecords = queryRecords({ since: dayStart });

      const monthCost = monthRecords.reduce((s, r) => s + r.cost_usd, 0);
      const dayCost = dayRecords.reduce((s, r) => s + r.cost_usd, 0);

      const alerts: string[] = [];
      if (config.budget.monthly_usd && monthCost >= config.budget.monthly_usd) {
        alerts.push(
          `Monthly budget exceeded: ${formatMoney(monthCost)} / ${formatMoney(config.budget.monthly_usd)}`,
        );
      } else if (config.budget.monthly_usd) {
        const pct = (monthCost / config.budget.monthly_usd) * 100;
        if (pct >= config.budget.warn_at_percent) {
          alerts.push(
            `Monthly budget warning: ${formatMoney(monthCost)} / ${formatMoney(config.budget.monthly_usd)} (${pct.toFixed(0)}%)`,
          );
        }
      }
      if (config.budget.daily_usd && dayCost >= config.budget.daily_usd) {
        alerts.push(
          `Daily budget exceeded: ${formatMoney(dayCost)} / ${formatMoney(config.budget.daily_usd)}`,
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                monthly_spent: formatMoney(monthCost),
                monthly_budget: config.budget.monthly_usd
                  ? formatMoney(config.budget.monthly_usd)
                  : "not set",
                daily_spent: formatMoney(dayCost),
                daily_budget: config.budget.daily_usd
                  ? formatMoney(config.budget.daily_usd)
                  : "not set",
                alerts,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "track_usage",
    "Trigger a scan of AI tool usage data",
    {
      tool: z.string().optional().describe("Scan only a specific tool"),
    },
    async ({ tool }) => {
      // Dynamic import to avoid loading all collectors at startup
      const { trackCommand } = await import("../commands/track.js");
      await trackCommand({ tool, quiet: true });

      return {
        content: [
          {
            type: "text" as const,
            text: "Usage scan completed. Query get_costs to see updated data.",
          },
        ],
      };
    },
  );

  // ── Start Server ──────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

Create `src/commands/mcp.ts`:

```typescript
import * as logger from "../lib/logger.js";

export async function mcpCommand(): Promise<void> {
  // When run as MCP server, we should not write to stdout (it's the transport)
  // Log to stderr instead
  const originalWrite = process.stdout.write.bind(process.stdout);

  const { startMcpServer } = await import("../mcp/server.js");
  await startMcpServer();
}
```

Register in `src/index.ts`:

```typescript
program
  .command("mcp")
  .description("Start Kova as an MCP server (stdio transport)")
  .action(
    wrapCommandAction(async () => {
      const { mcpCommand } = await import("./commands/mcp.js");
      await mcpCommand();
    }),
  );
```

Also add to `tsup.config.ts` an additional entry point or ensure the MCP server can be invoked as `kova mcp`.

### 11. Register All Commands and Version Bump

- **Task ID**: register-commands
- **Depends On**: history-cmd, run-improvements, chat-improvements, bench-cmd, claude-hook, mcp-server
- **Assigned To**: feature-builder-a
- **Agent Type**: backend-engineer
- **Parallel**: false

1. Ensure all new commands are registered in `src/index.ts` (history, bench, hook, mcp)
2. Ensure new options are registered for run (--context, --include, --budget) and chat (--budget)
3. Add the `collect` helper function for repeatable options
4. Run `npm install` if @modelcontextprotocol/sdk was added to package.json
5. Run `npx tsc --noEmit` and fix any type errors
6. Run `npm run build` and verify success

### 12. Write Tests

- **Task ID**: write-tests
- **Depends On**: register-commands
- **Assigned To**: test-writer
- **Agent Type**: quality-engineer
- **Parallel**: false

Create test files for all new code:

**`tests/lib/ai/context-loader.test.ts`** (~10 tests):

- `loadFiles` loads existing files correctly
- `loadFiles` skips files outside workingDir (path traversal)
- `loadFiles` skips unreadable files
- `loadFiles` respects MAX_CONTEXT_BYTES limit and sets truncated flag
- `loadGlob` finds files matching patterns (mock execa)
- `loadGlob` deduplicates files
- `formatContext` formats file content with headers
- `formatContext` returns empty string for no files
- `formatContext` includes truncation notice

**`tests/lib/ai/budget-guard.test.ts`** (~8 tests):

- `createBudgetGuard` returns null for undefined/zero budget
- `recordSpend` returns true when within budget
- `recordSpend` returns false when exceeded
- `recordSpend` warns at 80% threshold (once only)
- `check` returns correct BudgetStatus
- `spent` returns cumulative total
- Multiple small spends accumulate correctly

**`tests/lib/ai/fallback.test.ts`** (~8 tests):

- `isRetryableError` returns true for 429 errors
- `isRetryableError` returns true for 500/502/503 errors
- `isRetryableError` returns false for other errors
- `isRetryableError` returns false for non-Error values
- `getNextFallbackModel` returns correct fallback
- `getNextFallbackModel` skips already-attempted models
- `getNextFallbackModel` returns null when no fallbacks available
- `withFallback` calls fn with fallback model on retryable error

**`tests/commands/history.test.ts`** (~6 tests):

- Shows "no records" message when empty
- Displays sessions grouped by session_id
- Filters by --tool
- Filters by --project
- Filters by --days
- Respects --limit

**`tests/commands/bench.test.ts`** (~5 tests):

- Errors when no providers configured
- Parses --models correctly
- Uses default routing models when no --models
- Handles model errors gracefully
- Records costs for successful runs

**`tests/commands/mcp.test.ts`** (~4 tests):

- MCP server module exports startMcpServer
- Server has expected resources
- Server has expected tools
- mcpCommand does not throw

**`tests/commands/hook.test.ts`** (~5 tests):

- Shows usage when no action given
- Creates .claude/settings.json when it doesn't exist
- Merges hook into existing settings
- Detects already-installed hook
- Hook config has correct structure

Run `npm test` after and fix any failures.

### 13. Final Validation

- **Task ID**: validate-all
- **Depends On**: write-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `npx tsc --noEmit` -- zero errors
- Run `npm run build` -- success
- Run `npm test` -- all tests pass
- Run `node dist/index.js --version` -- outputs "2.1.0"
- Run `node dist/index.js history --help` -- verify help text
- Run `node dist/index.js bench --help` -- verify help text
- Run `node dist/index.js hook --help` -- verify help text
- Run `node dist/index.js mcp --help` -- verify help text
- Run `node dist/index.js run --help` -- verify --context, --include, --budget options
- Run `node dist/index.js chat --help` -- verify --budget option
- Verify `templates/claude-hook.json` exists with correct structure
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. `node dist/index.js --version` outputs "2.1.0"
2. `kova history` shows past sessions with cost, model, project, duration, grouped by session
3. `kova history --tool kova_orchestrator --days 7` filters correctly
4. `kova run --context src/index.ts "explain this"` includes file content in context
5. `kova run --include "src/**/*.ts" "refactor auth" --dry-run` shows context file count
6. `kova run --budget 0.50 "fix typo"` creates a budget guard
7. `kova chat --budget 1.00` warns at 80% and stops at 100% budget
8. `/cost` in chat shows budget info when budget is active
9. Smart fallback retries on 429/5xx, stepping down model tiers
10. `kova config set orchestration.fallback false` disables fallback
11. `kova config set orchestration.session_budget 5.00` sets default session budget
12. `kova bench "fix typo" --models sonnet,haiku` compares two models
13. `kova hook install` creates/updates .claude/settings.json with Stop hook
14. `kova mcp` starts an MCP server with resources and tools (stdio)
15. `templates/claude-hook.json` exists with correct hook structure
16. All tests pass (existing + ~46 new)
17. Build succeeds, zero type errors

## Validation Commands

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# All tests
npm test

# Version
node dist/index.js --version

# Help text for new commands
node dist/index.js history --help
node dist/index.js bench --help
node dist/index.js hook --help
node dist/index.js mcp --help

# Run options
node dist/index.js run --help

# Chat options
node dist/index.js chat --help

# Template exists
ls templates/claude-hook.json
```

## Notes

- The MCP SDK (`@modelcontextprotocol/sdk`) needs to be installed via `npm install @modelcontextprotocol/sdk`. Check the latest version on npm -- the API uses `McpServer` class with `.resource()`, `.tool()`, and `.connect()` methods.
- Context loading uses `rg --files --glob` for Node 18 compatibility instead of `node:fs/promises` glob (Node 22+). If rg is not available, fall back to a simple recursive readdir.
- The budget guard is stateful per session -- it's created once and shared across all turns in chat or the single execution in run.
- Fallback only activates on retryable errors (429, 5xx). Auth errors, invalid model errors, etc. are not retried.
- The bench command runs models sequentially (not parallel) to avoid rate limiting and to get clean timing measurements.
- The Claude Code hook uses the `Stop` event (fires when a session ends) to trigger `kova track`. The `--quiet` flag suppresses output. The `|| true` ensures non-zero exits don't break Claude Code.
- For the MCP server, logger output must go to stderr (not stdout) since stdout is the MCP transport. The `mcpCommand` should handle this redirection.
- The `collect` helper for Commander repeatable options follows the pattern: `.option("--context <file>", "desc", collect, [])` where `collect = (val, prev) => [...prev, val]`.

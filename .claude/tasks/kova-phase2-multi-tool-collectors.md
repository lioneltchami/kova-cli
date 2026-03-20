# Plan: Phase 2 -- Multi-Tool Collectors (Cursor, Copilot, Windsurf, Devin)

## Task Description

Add four new collectors to Kova CLI v0.3.0 so it can track AI coding tool costs across Cursor, GitHub Copilot, Windsurf, and Devin -- in addition to the existing Claude Code collector. This transforms Kova from a single-tool tracker into the unified AI Dev FinOps platform that no competitor offers at the mid-market level.

Each collector implements the existing `Collector` interface from `src/lib/collectors/types.ts` and plugs into the existing `track` command infrastructure. The key architectural challenge is that each tool exposes data differently: Cursor has local SQLite + unofficial API, Copilot has local JSONL + GitHub billing API, Windsurf and Devin are API-only.

## Objective

When this plan is complete:

1. `kova track` collects usage data from all 5 AI coding tools (Claude Code, Cursor, Copilot, Windsurf, Devin)
2. `kova costs` shows unified cost breakdowns across all tools with per-tool comparison
3. A new credential management system securely stores API keys for tools that require them
4. `kova config set-key <tool> <key>` allows users to configure tool-specific credentials
5. TOKEN_COSTS covers all models across all 5 tools
6. 400+ tests pass with zero failures
7. CLI is publishable as `kova-cli@0.3.0`

## Problem Statement

Kova v0.2.0 only tracks Claude Code. Developers use 2-3 AI coding tools simultaneously, with no unified cost view. The research confirmed:

- **Cursor**: Richest data source. Local SQLite DB at `state.vscdb` stores auth JWT. Personal API at `cursor.com/api/dashboard/get-filtered-usage-events` returns per-request token data with `totalCents`. Teams have an official Admin API at `api.cursor.com/teams/filtered-usage-events`.
- **GitHub Copilot**: Local VS Code JSONL session files at `globalStorage/github.copilot-chat/chatSessions/` with token counts. Billing API at `/users/{username}/settings/billing/premium_request/usage` returns dollar amounts. Seat-based pricing ($19-39/user) + premium request overage at $0.04/request.
- **Windsurf**: Enterprise-only API at `server.codeium.com/api/v1/CascadeAnalytics`. No local files. Credits in cents.
- **Devin**: Teams/Enterprise API at `api.devin.ai/v3/enterprise/consumption/daily`. No local files. ACU-based pricing ($2.00-2.25/ACU).

## Solution Approach

### Data Access Strategy Per Tool

| Tool         | Individual Mode                                                                              | Team/Enterprise Mode                                             |
| ------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Cursor**   | Read JWT from local `state.vscdb`, call `cursor.com/api/dashboard/get-filtered-usage-events` | Admin API key, call `api.cursor.com/teams/filtered-usage-events` |
| **Copilot**  | Parse local JSONL session files from VS Code `globalStorage/github.copilot-chat/`            | GitHub PAT with `manage_billing:copilot` scope, call billing API |
| **Windsurf** | Not available (display guidance to user)                                                     | Service key, call `CascadeAnalytics` endpoint                    |
| **Devin**    | Not available (display guidance to user)                                                     | `cog_` Bearer token, call consumption daily endpoint             |

### Architecture

The existing `Collector` interface works perfectly -- each collector implements `isAvailable()` and `collect(since?)`. The key addition is a **credential manager** that securely stores tool-specific API keys in `~/.kova/credentials.json` (separate from the Kova dashboard credentials in `~/.kova/credentials.json` which will be renamed to `~/.kova/dashboard-credentials.json`).

The track command's `COLLECTORS` map in `src/commands/track.ts` already has null placeholders for all 4 tools -- we just need to fill them in.

### Dependency Decision: No `better-sqlite3`

After analysis, adding `better-sqlite3` would introduce a native C++ dependency requiring node-gyp, Python, and a C compiler on every user's machine. This is unacceptable for a lightweight CLI tool.

Instead, for Cursor's `state.vscdb`: we read the raw SQLite file bytes and extract the JWT using a simple binary search for the key `cursorAuth/accessToken` followed by its value. SQLite stores data in B-tree pages with predictable key-value patterns. Alternatively, since we only need one value, we can use Node's `child_process` to call the `sqlite3` CLI if available, or use the unofficial personal API with the cookie from the user's browser.

**Revised approach**: For individual Cursor users, require them to run `kova config set-key cursor <session-token>` with their `WorkosCursorSessionToken` cookie value (one-time setup). For teams, use the Admin API key. This avoids the native dependency entirely.

## Relevant Files

### Existing Files to MODIFY

- `src/lib/constants.ts` -- Add tool-specific paths (Cursor state.vscdb, Copilot globalStorage), expand TOKEN_COSTS with Cursor/Copilot/Windsurf model rates, bump VERSION to 0.3.0
- `src/types.ts` -- Add `ToolCredentials` type, add new AiModel variants for tool-specific models (gpt-4.1, gpt-5, gpt-5-mini, claude-4.5-sonnet for Cursor naming, swe-1.5)
- `src/commands/track.ts` -- Import new collectors, fill COLLECTORS map
- `src/lib/config-store.ts` -- Add `credentials` section to `KovaFinOpsConfig`, or create separate credential store
- `src/lib/completions.ts` -- Add `config` command to completions registry with set-key subcommand
- `src/index.ts` -- Add `kova config set-key <tool> <key>` and `kova config show` commands
- `package.json` -- Bump version to 0.3.0

### New Files to CREATE

- `src/lib/credential-manager.ts` -- Secure storage for tool API keys at `~/.kova/tool-credentials.json` with 0o600 permissions
- `src/lib/collectors/cursor.ts` -- Cursor collector (personal API + Admin API)
- `src/lib/collectors/copilot.ts` -- GitHub Copilot collector (local JSONL + billing API)
- `src/lib/collectors/windsurf.ts` -- Windsurf collector (Enterprise CascadeAnalytics API)
- `src/lib/collectors/devin.ts` -- Devin collector (Teams/Enterprise consumption API)
- `src/commands/config-cmd.ts` -- `kova config` command for credential management
- `tests/credential-manager.test.ts` -- Credential manager tests
- `tests/collectors/cursor.test.ts` -- Cursor collector tests
- `tests/collectors/copilot.test.ts` -- Copilot collector tests
- `tests/collectors/windsurf.test.ts` -- Windsurf collector tests
- `tests/collectors/devin.test.ts` -- Devin collector tests
- `tests/commands/config-cmd.test.ts` -- Config command tests

## Implementation Phases

### Phase 1: Foundation (Tasks 1-2)

Build the credential manager and expand constants/types. This gives all collectors a consistent way to read API keys and a complete cost table.

### Phase 2: Core Collectors (Tasks 3-6)

Build all four collectors in parallel. Each is independent and implements the same `Collector` interface.

### Phase 3: Integration (Tasks 7-8)

Wire collectors into the track command, add the config command for credential management, update completions.

### Phase 4: Testing & Validation (Tasks 9-10)

Write comprehensive tests for all new modules and validate everything end-to-end.

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
  - Role: Build credential manager, expand types/constants, add config command
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-cursor
  - Role: Build the Cursor collector with personal API and Admin API support
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-copilot
  - Role: Build the GitHub Copilot collector with local JSONL parsing and billing API
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-api-collectors
  - Role: Build both Windsurf and Devin collectors (API-only, simpler)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-integration
  - Role: Wire all collectors into track command, update index.ts, update completions
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write comprehensive test suite for all new modules
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

### 1. Build Credential Manager and Expand Types

- **Task ID**: credential-manager
- **Depends On**: none
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read existing files first: `src/types.ts`, `src/lib/constants.ts`, `src/lib/config-store.ts`, `src/lib/dashboard.ts` (for credential storage patterns)
- Create `src/lib/credential-manager.ts`:
  - `getToolCredentialsPath(): string` -- returns `~/.kova/tool-credentials.json`
  - `readToolCredentials(): ToolCredentials` -- reads file, returns empty object if missing
  - `writeToolCredentials(creds: ToolCredentials): void` -- writes with `mode: 0o600`
  - `getToolKey(tool: AiTool): string | null` -- returns API key for a specific tool
  - `setToolKey(tool: AiTool, key: string): void` -- stores key for a tool
  - `removeToolKey(tool: AiTool): void` -- removes key for a tool
  - `listConfiguredTools(): AiTool[]` -- returns list of tools with stored keys
- Add to `src/types.ts`:
  - `ToolCredentials` type: `Partial<Record<AiTool, string>>` (tool -> API key)
  - Add new AiModel variants: `"gpt-4.1"`, `"gpt-5"`, `"gpt-5-mini"`, `"swe-1.5"`, `"swe-1.5-fast"` -- expand the union type
- Update `src/lib/constants.ts`:
  - Bump VERSION to `"0.3.0"`
  - Add Cursor state.vscdb paths:
    - `CURSOR_STATE_DB_PATHS` object with platform-specific paths (darwin, win32, linux)
  - Add Copilot chat session paths:
    - `COPILOT_CHAT_PATHS` object with platform-specific paths (darwin, win32, linux) for `globalStorage/github.copilot-chat/`
  - Expand TOKEN_COSTS with additional models:
    - `"gpt-4.1"`: { input: 2.0, output: 8.0 }
    - `"gpt-5"`: { input: 1.25, output: 10.0 }
    - `"gpt-5-mini"`: { input: 0.4, output: 1.6 }
    - `"swe-1.5"`: { input: 0, output: 0 } (free in Windsurf)
    - `"swe-1.5-fast"`: { input: 0.5, output: 2.0 } (approximate from credit rate)
  - Add Cursor-specific credit rates:
    - `CURSOR_POOL_RATES`: { cache_read: 0.25, input: 1.25, output: 6.0, cache_write: 1.25 } (per 1M tokens)
  - Add Devin ACU costs:
    - `DEVIN_ACU_COST_CORE = 2.25`
    - `DEVIN_ACU_COST_TEAMS = 2.00`
  - Add Windsurf credit rate:
    - `WINDSURF_CREDIT_RATE_PRO = 0.02` ($/credit)
    - `WINDSURF_CREDIT_RATE_TEAMS = 0.04` ($/credit)
- Update `package.json` version to `"0.3.0"`
- Run `npm run build` and `npm run test` to verify

### 2. Build Cursor Collector

- **Task ID**: cursor-collector
- **Depends On**: credential-manager
- **Assigned To**: builder-cursor
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside copilot-collector, api-collectors)
- Read first: `src/lib/collectors/claude-code.ts` (pattern to follow), `src/lib/collectors/types.ts`, `src/lib/credential-manager.ts`, `src/lib/constants.ts`
- Create `src/lib/collectors/cursor.ts` implementing the `Collector` interface:
  - `name = "cursor"`
  - `isAvailable()`:
    1. Check if a Cursor API key is stored via `getToolKey("cursor")`
    2. OR check if any of the platform-specific state.vscdb paths exist (for potential future SQLite reading)
    3. Return true if either is available
  - `collect(since?: Date)`:
    - **If Admin API key is stored** (key starts with a standard API key format):
      - POST to `https://api.cursor.com/teams/filtered-usage-events` with Basic Auth (`base64(apiKey + ":")`)
      - Request body: `{ startDate: since epoch ms, endDate: now epoch ms, page: 1, pageSize: 100 }`
      - Paginate through all results (check response for totalPages or continue until empty)
      - Parse each event: extract `timestamp`, `model`, `tokenUsage.inputTokens`, `tokenUsage.outputTokens`, `tokenUsage.totalCents`, `kind` (composer/chat/agent)
      - Map model names: contains "sonnet" -> sonnet, contains "opus" -> opus, contains "gpt-4o" -> gpt-4o, contains "gpt-4.1" -> gpt-4.1, etc.
      - If `totalCents` is available, use it directly: `cost_usd = totalCents / 100`
      - Otherwise compute from tokens using CURSOR_POOL_RATES
      - Generate deterministic IDs: `sha256("cursor:" + timestamp + ":" + model + ":" + inputTokens)`
    - **If session token is stored** (key starts with `user_` -- personal cookie):
      - Extract userId from the token (part before `::`)
      - GET `https://www.cursor.com/api/dashboard/get-filtered-usage-events` with Cookie header
      - Same parsing logic as Admin API (response format is similar)
      - Required headers: Content-Type, User-Agent, Origin, Referer
    - Handle errors: 401 (invalid key, log warning), 429 (rate limit, log warning), network failures (collect in errors array)
    - Set `tool: "cursor"` on all records
    - Rate limit: max 20 requests/minute for Admin API
  - Map Cursor model names to AiModel:
    - "claude-3.5-sonnet", "claude-4.5-sonnet", "claude-sonnet-\*" -> "sonnet"
    - "claude-4.6-opus", "claude-opus-\*" -> "opus"
    - "gpt-4o" -> "gpt-4o"
    - "gpt-4.1" -> "gpt-4.1"
    - "gpt-5" -> "gpt-5"
    - Others -> "unknown"
- Export as `cursorCollector` (same pattern as `claudeCodeCollector`)
- Run `npm run build` to verify

### 3. Build GitHub Copilot Collector

- **Task ID**: copilot-collector
- **Depends On**: credential-manager
- **Assigned To**: builder-copilot
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside cursor-collector, api-collectors)
- Read first: `src/lib/collectors/claude-code.ts` (pattern), `src/lib/collectors/types.ts`, `src/lib/credential-manager.ts`, `src/lib/constants.ts`
- Create `src/lib/collectors/copilot.ts` implementing the `Collector` interface:
  - `name = "copilot"`
  - `isAvailable()`:
    1. Check if a GitHub PAT is stored via `getToolKey("copilot")`
    2. OR check if local Copilot chat session files exist at the platform-specific COPILOT_CHAT_PATHS
    3. Return true if either is available
  - `collect(since?: Date)`:
    - **Strategy 1: Local JSONL files** (always attempt first, no API key needed):
      - Scan `globalStorage/github.copilot-chat/chatSessions/` for JSON files
      - Each file is a conversation session with messages
      - Look for response messages with `usage` field containing `prompt_tokens` and `completion_tokens`
      - Extract model, token counts, timestamp
      - Compute cost using TOKEN_COSTS
      - Generate deterministic IDs: `sha256("copilot:" + conversationId + ":" + requestId + ":" + timestamp)`
    - **Strategy 2: Billing API** (if GitHub PAT stored):
      - GET `https://api.github.com/users/{username}/settings/billing/premium_request/usage?year=YYYY&month=MM&product=Copilot`
      - Headers: `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`
      - Parse response `usageItems` array: each has `model`, `pricePerUnit` ($0.04), `grossQuantity`, `netAmount`, `date`
      - Create usage records from billing data (these have actual dollar costs)
      - Note: This gives premium request costs only, not seat costs (seat costs are flat-rate)
    - **Merge both strategies**: Local JSONL gives token-level detail for chat, billing API gives dollar amounts for premium requests. Deduplicate by timestamp+model.
    - Map Copilot model names:
      - "gpt-4o" -> "gpt-4o"
      - "gpt-4o-mini" -> "gpt-4o-mini"
      - "o1" -> "o1"
      - "o3" -> "o3"
      - Contains "claude" -> map to appropriate Claude variant
      - "default" -> "gpt-4o" (Copilot's default model)
    - Handle edge cases: session files not valid JSON (skip), billing API returns 403 (insufficient scope, log warning)
- Export as `copilotCollector`
- Run `npm run build` to verify

### 4. Build Windsurf Collector

- **Task ID**: windsurf-collector
- **Depends On**: credential-manager
- **Assigned To**: builder-api-collectors
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside cursor-collector, copilot-collector)
- Read first: `src/lib/collectors/claude-code.ts` (pattern), `src/lib/collectors/types.ts`, `src/lib/credential-manager.ts`, `src/lib/constants.ts`
- Create `src/lib/collectors/windsurf.ts` implementing the `Collector` interface:
  - `name = "windsurf"`
  - `isAvailable()`: Check if a Windsurf service key is stored via `getToolKey("windsurf")`
  - `collect(since?: Date)`:
    - POST to `https://server.codeium.com/api/v1/CascadeAnalytics`
    - Request body:
      ```json
      {
        "service_key": "<stored key>",
        "start_timestamp": "<since ISO>",
        "end_timestamp": "<now ISO>",
        "query_requests": [{ "cascade_runs": {} }]
      }
      ```
    - Parse response `queryResults[0].cascadeRuns` array
    - Each run has: `day`, `model`, `mode`, `messagesSent`, `promptsUsed`
    - `promptsUsed` is in **cents** -- divide by 100 to get credits
    - Convert credits to USD using WINDSURF_CREDIT_RATE_TEAMS ($0.04/credit as conservative default)
    - Map Windsurf model names to AiModel:
      - Contains "sonnet" -> "sonnet"
      - Contains "opus" -> "opus"
      - Contains "haiku" -> "haiku"
      - Contains "gpt-4o" -> "gpt-4o"
      - Contains "swe-1" -> "swe-1.5"
      - Contains "gemini" + "flash" -> "gemini-flash"
      - Contains "gemini" + "pro" -> "gemini-pro"
    - Generate deterministic IDs: `sha256("windsurf:" + day + ":" + model + ":" + mode + ":" + messagesSent)`
    - Handle 401 (invalid service key), 429 (rate limited), network errors
    - Note: No token-level data from Windsurf API -- only credit consumption. Set `input_tokens: 0, output_tokens: 0` and rely on `cost_usd` from credit conversion
  - For users without Enterprise: `isAvailable()` returns false, and `kova track` output mentions "Windsurf tracking requires Enterprise plan. Run: kova config set-key windsurf <service-key>"
- Export as `windsurfCollector`
- Run `npm run build` to verify

### 5. Build Devin Collector

- **Task ID**: devin-collector
- **Depends On**: credential-manager
- **Assigned To**: builder-api-collectors
- **Agent Type**: backend-engineer
- **Parallel**: true (same agent as windsurf, runs after it sequentially)
- Create `src/lib/collectors/devin.ts` implementing the `Collector` interface:
  - `name = "devin"`
  - `isAvailable()`: Check if a Devin API key is stored via `getToolKey("devin")`
  - `collect(since?: Date)`:
    - GET `https://api.devin.ai/v3/enterprise/consumption/daily`
    - Query params: `time_after=<unix_timestamp>&time_before=<unix_timestamp>`
    - Headers: `Authorization: Bearer <stored key>`
    - Parse response `consumption_by_date` array
    - Each entry has: `date` (unix timestamp), `acus`, `acus_by_product` (devin/cascade/terminal breakdown)
    - Convert ACUs to USD: `cost_usd = acus * DEVIN_ACU_COST_TEAMS` (default to Teams rate)
    - Create one UsageRecord per day with:
      - `tool: "devin"`
      - `model: "unknown"` (Devin doesn't expose which LLM it uses internally)
      - `input_tokens: 0, output_tokens: 0` (ACU-based, not token-based)
      - `cost_usd` from ACU conversion
      - `session_id` from date
      - `metadata: { acus: string, product_breakdown: JSON string }`
    - Generate deterministic IDs: `sha256("devin:" + date + ":" + acus)`
    - Handle 401, 403, network errors
    - If product breakdown available, optionally create separate records per product (devin/cascade/terminal)
  - For individual Core plan users without enterprise API: `isAvailable()` returns false
- Export as `devinCollector`
- Run `npm run build` to verify

### 6. Build Config Command for Credential Management

- **Task ID**: config-command
- **Depends On**: credential-manager
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside collectors)
- Read first: `src/commands/login.ts` (pattern), `src/commands/budget.ts` (subcommand pattern), `src/lib/credential-manager.ts`
- Create `src/commands/config-cmd.ts`:
  - `configCommand(action, args, options)`:
    - `kova config` (no action): show current configuration summary
    - `kova config set-key <tool> <key>`: validate tool name is a valid AiTool, store key via `setToolKey(tool, key)`, confirm success
    - `kova config remove-key <tool>`: remove stored key via `removeToolKey(tool)`
    - `kova config show-keys`: list all configured tools with masked key prefixes (first 8 chars + "...")
    - `kova config set <key> <value>`: set tracking/display/budget config values (e.g., `kova config set tracking.tools claude_code,cursor`)
  - Validate tool names against AiTool type
  - Show helpful messages for each tool about what kind of key is needed:
    - cursor: "Cursor Admin API key (from cursor.com/dashboard > Settings > Advanced) or session token (WorkosCursorSessionToken cookie)"
    - copilot: "GitHub PAT with manage_billing:copilot scope"
    - windsurf: "Windsurf Enterprise service key (from team settings)"
    - devin: "Devin service user token (starts with cog\_)"
- Run `npm run build` to verify

### 7. Wire Collectors and Update Entry Point

- **Task ID**: wire-collectors
- **Depends On**: cursor-collector, copilot-collector, windsurf-collector, devin-collector, config-command
- **Assigned To**: builder-integration
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read first: `src/commands/track.ts`, `src/index.ts`, `src/lib/completions.ts`
- Update `src/commands/track.ts`:
  - Import all 4 new collectors: `cursorCollector`, `copilotCollector`, `windsurfCollector`, `devinCollector`
  - Fill the COLLECTORS map:
    ```typescript
    const COLLECTORS: Record<AiTool, Collector | null> = {
      claude_code: claudeCodeCollector,
      cursor: cursorCollector,
      copilot: copilotCollector,
      windsurf: windsurfCollector,
      devin: devinCollector,
    };
    ```
  - Update the summary message to show per-tool counts when multiple tools are scanned
  - After scan, if any tools had `isAvailable() === false` and are in the config's tracking.tools list, show a one-line hint: "Tip: configure cursor with 'kova config set-key cursor <key>'"
- Update `src/index.ts`:
  - Add `config` command registration:
    ```typescript
    program
      .command("config [action] [args...]")
      .description("Manage Kova configuration and tool credentials")
      .action(
        wrapCommandAction(async (action, args) => {
          const { configCommand } = await import("./commands/config-cmd.js");
          await configCommand(action, args);
        }),
      );
    ```
- Update `src/lib/completions.ts`:
  - Add `config` command to registry with subcommands: set-key, remove-key, show-keys, set
  - Update --tool option values in track/costs completions to list all 5 tools
- Update `src/lib/config-store.ts`:
  - Change `getDefaultConfig()` to include all tools in `tracking.tools`:
    ```typescript
    tracking: {
      tools: ["claude_code", "cursor", "copilot", "windsurf", "devin"],
      ...
    }
    ```
- Run `npm run build` to verify

### 8. Write Comprehensive Test Suite

- **Task ID**: write-tests
- **Depends On**: wire-collectors
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Parallel**: false
- Read ALL new source files before writing any tests
- Read existing collector test (`tests/collectors/claude-code.test.ts`) for patterns

- **tests/credential-manager.test.ts** (10+ tests):
  - Read/write round-trip
  - File created with 0o600 permissions (Unix)
  - getToolKey returns null for unconfigured tool
  - setToolKey stores and retrieves correctly
  - removeToolKey removes key
  - listConfiguredTools returns correct list
  - Handles missing credentials file gracefully
  - Multiple tools stored simultaneously
  - Overwriting existing key
  - Empty key handling

- **tests/collectors/cursor.test.ts** (12+ tests):
  - isAvailable returns true when key stored
  - isAvailable returns false when no key
  - collect with Admin API key calls correct endpoint
  - collect parses token usage events correctly
  - collect computes cost from totalCents
  - collect maps model names correctly
  - collect generates deterministic IDs
  - collect respects since parameter
  - collect handles 401 response
  - collect handles 429 rate limit
  - collect handles network error
  - collect paginates through multiple pages

- **tests/collectors/copilot.test.ts** (12+ tests):
  - isAvailable returns true when local files exist
  - isAvailable returns true when PAT stored
  - collect parses local JSONL session files
  - collect extracts token counts from usage field
  - collect calls billing API when PAT available
  - collect maps model names correctly
  - collect generates deterministic IDs
  - collect handles missing usage field in sessions
  - collect handles billing API 403
  - collect handles invalid JSON in session files
  - collect deduplicates between local and API data
  - collect respects since parameter

- **tests/collectors/windsurf.test.ts** (8+ tests):
  - isAvailable returns false without service key
  - isAvailable returns true with service key
  - collect calls CascadeAnalytics endpoint
  - collect parses cascade runs correctly
  - collect converts promptsUsed cents to credits to USD
  - collect maps model names
  - collect handles 401 invalid key
  - collect generates deterministic IDs

- **tests/collectors/devin.test.ts** (8+ tests):
  - isAvailable returns false without API key
  - isAvailable returns true with API key
  - collect calls consumption/daily endpoint
  - collect converts ACUs to USD
  - collect generates per-day records
  - collect includes product breakdown in metadata
  - collect handles 401
  - collect generates deterministic IDs

- **tests/commands/config-cmd.test.ts** (10+ tests):
  - config with no action shows summary
  - config set-key stores credential
  - config set-key validates tool name
  - config remove-key removes credential
  - config show-keys lists configured tools with masked keys
  - config set updates tracking.tools
  - config set validates config key
  - config show-keys with no keys shows empty message
  - config set-key shows help text for each tool
  - config set-key masks the stored key in confirmation

- **Update existing tests** if needed for new version number, new config defaults

- Run `npm run test` -- target 400+ tests total, zero failures

### 9. Final Validation

- **Task ID**: validate-all
- **Depends On**: write-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `npm run build` -- verify zero errors
- Run `npm run lint` -- verify zero type errors
- Run `npm run test` -- verify 400+ tests pass
- Verify all 5 collectors are registered in track.ts COLLECTORS map
- Verify `kova --help` shows config command
- Verify `kova config --help` shows subcommands
- Verify `kova track --help` shows --tool with all 5 tool names
- Verify TOKEN_COSTS covers all new models
- Verify package.json version is 0.3.0
- Verify credential manager uses 0o600 file permissions
- Verify no hardcoded API keys or secrets in source
- Report pass/fail for each criterion
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. `npm run build` succeeds with zero errors
2. `npm run lint` passes with zero type errors
3. `npm run test` passes with 400+ tests, zero failures
4. `kova track` with Cursor configured collects usage via API
5. `kova track` with Copilot configured collects usage from local files and/or billing API
6. `kova track` with Windsurf configured collects usage via CascadeAnalytics API
7. `kova track` with Devin configured collects usage via consumption API
8. `kova config set-key cursor <key>` stores the key securely with 0o600 permissions
9. `kova config show-keys` displays configured tools with masked key prefixes
10. `kova costs` shows unified breakdown across multiple tools
11. All collectors generate deterministic IDs for deduplication
12. All collectors handle API errors gracefully (never crash, collect errors in result)
13. All new models are in TOKEN_COSTS with accurate pricing
14. package.json version is 0.3.0
15. Shell completions include all commands and --tool lists all 5 tools

## Validation Commands

Execute these commands to validate the task is complete:

- `npm run build` - Verify the project builds without TypeScript errors
- `npm run lint` - Verify type checking passes
- `npm run test` - Run the full test suite, expect 400+ tests passing
- `node dist/index.js --help` - Verify CLI shows config command
- `node dist/index.js config --help` - Verify config subcommands
- `node dist/index.js track --help` - Verify track shows all tool options

## Notes

- **No native dependencies**: We deliberately avoid `better-sqlite3` to keep Kova zero-native-dep. Cursor data access goes through their HTTP API, not SQLite directly.
- **API rate limits**: Cursor Admin API is 20 req/min. Collectors must respect this. Add a simple delay between paginated requests if needed.
- **Token expiry**: Cursor session tokens rotate. Users may need to re-run `kova config set-key cursor <new-token>` periodically. The collector should detect 401 responses and suggest this.
- **Copilot billing API scope**: The user billing endpoint requires the user's own PAT with `plan:read` scope. The org endpoint requires `manage_billing:copilot`. Document this in the help text.
- **Windsurf Enterprise-only**: Individual and Team plan users cannot use the API. The collector should clearly state this when `isAvailable()` returns false.
- **Devin billing day boundary**: Devin uses midnight PST (08:00 UTC) as the day boundary, not midnight UTC. The collector should be aware of this when parsing daily consumption data.
- **Privacy**: No collector should ever send source code, prompts, or file paths to the Kova cloud. Only token counts, model names, project names, timestamps, and computed costs.
- **Cursor totalCents**: When `totalCents` is available in the API response, use it directly rather than computing from tokens. It is the authoritative cost from Cursor's billing system.
- **Future: SQLite reading**: If we later want to read Cursor's state.vscdb for the JWT without user manual setup, we can add an optional `sql.js` (pure WASM, no native dep) dependency. This is out of scope for Phase 2.

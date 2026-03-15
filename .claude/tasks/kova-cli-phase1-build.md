# Plan: Kova CLI Phase 1 - MVP Build

## Task Description

Build the Kova CLI npm package (`kova-cli`) from scratch. This is Phase 1 (MVP) of the Kova product -- an AI coding orchestration tool that packages the team-plan + build system as a distributable npm CLI. The tool scaffolds `.claude/` directories with orchestration templates, invokes Claude Code as a subprocess for planning and building, tracks progress via checkpoints, and provides terminal UI for monitoring.

The PRD is at `C:/PROJ/kova-cli/PRD.md` (1,300+ lines, fully specified). Source template files are in `C:/PROJ/FRANCISMYLESAPP/.claude/`.

## Objective

Deliver a working, publishable npm package (`kova-cli`) with 7 CLI commands (`init`, `plan`, `build`, `team-build`, `status`, `config`, `version`), auto-detection of project types, template scaffolding, checkpoint-based progress tracking, auto model selection, token usage tracking, and a comprehensive test suite. The package must pass `npm publish --dry-run` and all tests.

## Problem Statement

The team-plan + build orchestration system exists only as project-local `.claude/` files. No one else can use it without manually copying files and understanding the skill system. Kova packages this into a single `npm install -g kova-cli` experience with auto-detection and configuration.

## Solution Approach

Build a TypeScript CLI using Commander.js for command routing, tsup for bundling, execa for subprocess management, cosmiconfig for config discovery, chalk for terminal output, and Vitest for testing. Template files from the Francis Myles project are copied into a `templates/` directory and scaffolded into target projects by the `init` command. The `plan`, `build`, and `team-build` commands invoke Claude Code CLI as a subprocess. Progress tracking uses JSON checkpoint files.

**Key design decisions:**

- No ink/React for terminal UI in MVP -- use chalk + simple console output instead (ink adds complexity and bundle size; defer to Phase 2)
- Templates are static copies of the source files, NOT dynamically generated
- Config uses cosmiconfig with `kova.yaml` as the primary format
- All paths use `path.join()` for cross-platform compatibility
- CLI startup target < 200ms (Commander.js + lazy imports)

## Relevant Files

### Source Template Files (copy from C:/PROJ/FRANCISMYLESAPP/.claude/)

- `.claude/commands/team-plan.md` (405 lines, 15K) -- Plan creation command
- `.claude/commands/build.md` (24 lines, 790B) -- Hub-and-spoke execution
- `.claude/commands/team-build.md` (273 lines, 12K) -- Agent Teams execution
- `.claude/skills/session-management/SKILL.md` (328 lines, 14K) -- Session workflow
- `.claude/skills/sub-agent-invocation/SKILL.md` (274 lines, 12K) -- Agent routing
- `.claude/hooks/Validators/validate-new-file.mjs` (144 lines, 4.3K) -- Plan file validator
- `.claude/hooks/Validators/validate-file-contains.mjs` (228 lines, 6.6K) -- Section validator
- `.claude/hooks/FormatterHook/formatter.mjs` (147 lines, 4.3K) -- Code formatter
- `.claude/hooks/SkillActivationHook/skill-activation-prompt.mjs` (250 lines, 9.7K) -- Skill recommender
- `.claude/agents/agent-rules.json` (768 lines, 27K) -- Agent activation triggers
- `.claude/skills/skill-rules.json` (1269 lines, 50K) -- Skill activation triggers
- `.claude/settings.json` (72 lines, 1.3K) -- Hook configuration

### New Files to Create

**Project Foundation:**

- `C:/PROJ/kova-cli/package.json` -- npm package config with bin field
- `C:/PROJ/kova-cli/tsconfig.json` -- TypeScript strict mode config
- `C:/PROJ/kova-cli/tsup.config.ts` -- Build configuration
- `C:/PROJ/kova-cli/vitest.config.ts` -- Test configuration
- `C:/PROJ/kova-cli/bin/kova.js` -- CLI entry point (#!/usr/bin/env node)
- `C:/PROJ/kova-cli/.gitignore` -- Standard Node.js gitignore

**Source Code (`src/`):**

- `src/index.ts` -- CLI setup with Commander.js, all command registrations
- `src/commands/init.ts` -- `kova init` implementation
- `src/commands/plan.ts` -- `kova plan` implementation
- `src/commands/build.ts` -- `kova build` implementation
- `src/commands/team-build.ts` -- `kova team-build` implementation
- `src/commands/status.ts` -- `kova status` implementation
- `src/commands/config.ts` -- `kova config` implementation
- `src/lib/detect.ts` -- Project auto-detection (language, framework, PM, DB, auth, payments)
- `src/lib/scaffold.ts` -- Copy templates to target .claude/ directory
- `src/lib/config.ts` -- Read/write kova.yaml via cosmiconfig
- `src/lib/checkpoint.ts` -- Read/write/update checkpoint JSON files
- `src/lib/subprocess.ts` -- Claude Code CLI invocation via execa
- `src/lib/model-selector.ts` -- Auto model selection based on task complexity
- `src/lib/token-tracker.ts` -- Token usage parsing and budget calculation
- `src/lib/logger.ts` -- Chalk-based colored output helper
- `src/lib/constants.ts` -- Shared constants (version, colors, plan allocations)
- `src/types.ts` -- TypeScript type definitions for all data structures

**Templates (`templates/`):**

- `templates/commands/team-plan.md` -- Copied from source
- `templates/commands/build.md` -- Copied from source
- `templates/commands/team-build.md` -- Copied from source
- `templates/skills/session-management/SKILL.md` -- Copied from source
- `templates/skills/sub-agent-invocation/SKILL.md` -- Copied from source
- `templates/hooks/Validators/validate-new-file.mjs` -- Copied from source
- `templates/hooks/Validators/validate-file-contains.mjs` -- Copied from source
- `templates/hooks/FormatterHook/formatter.mjs` -- Copied from source
- `templates/hooks/SkillActivationHook/skill-activation-prompt.mjs` -- Copied from source
- `templates/agents/agent-rules.json` -- Copied from source
- `templates/skills/skill-rules.json` -- Copied from source
- `templates/settings.json` -- Copied from source
- `templates/kova.yaml.template` -- Default kova.yaml with placeholders
- `templates/CLAUDE.md.template` -- Default CLAUDE.md with placeholders

**Tests (`tests/`):**

- `tests/detect.test.ts` -- Unit tests for project detection
- `tests/scaffold.test.ts` -- Unit tests for template scaffolding
- `tests/config.test.ts` -- Unit tests for config read/write
- `tests/checkpoint.test.ts` -- Unit tests for checkpoint management
- `tests/model-selector.test.ts` -- Unit tests for model selection
- `tests/token-tracker.test.ts` -- Unit tests for token tracking
- `tests/init.integration.test.ts` -- Integration test for full init flow

**Documentation:**

- `C:/PROJ/kova-cli/README.md` -- npm README with install, usage, examples

## Implementation Phases

### Phase 1: Foundation (Tasks 1-3)

Set up the TypeScript project, install dependencies, create the CLI entry point, define all types, and establish the build pipeline. This is the skeleton that everything else attaches to.

### Phase 2: Core Implementation (Tasks 4-8)

Build the detection engine, scaffolding system, config management, and all 7 CLI commands. Copy template files from the Francis Myles project. Implement checkpoint tracking, subprocess invocation, model selection, and token tracking.

### Phase 3: Testing and Polish (Tasks 9-11)

Write comprehensive unit and integration tests. Create the README. Run `npm publish --dry-run` to validate packaging. Fix any issues found during testing.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-foundation
  - Role: Set up the TypeScript project skeleton, package.json, tsconfig, tsup, vitest, bin entry point, types, constants, and logger
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-core
  - Role: Build the core library modules (detect.ts, scaffold.ts, config.ts, checkpoint.ts, subprocess.ts, model-selector.ts, token-tracker.ts) and copy all template files from the Francis Myles project
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-commands
  - Role: Build all 7 CLI commands (init, plan, build, team-build, status, config, version) and the main index.ts CLI router
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write all unit tests and integration tests using Vitest
  - Agent Type: quality-engineer
  - Resume: true

- Specialist
  - Name: builder-docs
  - Role: Write the README.md with install, usage, examples, and configuration docs
  - Agent Type: general-purpose
  - Resume: false

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode). Run tests, verify builds, check npm publish --dry-run.
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Project Foundation Setup

- **Task ID**: setup-foundation
- **Depends On**: none
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` (sections 6.2, 6.3, 7.1) for architecture and tech stack
- Create `C:/PROJ/kova-cli/package.json` with:
  - name: "kova-cli"
  - version: "0.1.0"
  - description: "AI coding orchestration CLI - Plan the hunt. Run the pack."
  - type: "module"
  - main: "./dist/index.js"
  - bin: { "kova": "./bin/kova.js" }
  - files: ["bin/", "dist/", "templates/", "README.md"]
  - scripts: { "build": "tsup", "dev": "tsup --watch", "test": "vitest run", "test:watch": "vitest", "lint": "tsc --noEmit", "prepublishOnly": "npm run build" }
  - keywords: ["claude", "ai", "orchestration", "multi-agent", "coding", "cli"]
  - license: "MIT"
  - engines: { "node": ">=18.0.0" }
  - Dependencies: commander, chalk, execa, cosmiconfig, yaml, glob
  - DevDependencies: typescript, tsup, vitest, @types/node
- Create `C:/PROJ/kova-cli/tsconfig.json` with strict mode, ESNext target, NodeNext module
- Create `C:/PROJ/kova-cli/tsup.config.ts` with entry src/index.ts, format esm, target node18, clean true, sourcemap true
- Create `C:/PROJ/kova-cli/vitest.config.ts`
- Create `C:/PROJ/kova-cli/bin/kova.js` with shebang, import dist/index.js
- Create `C:/PROJ/kova-cli/.gitignore` (node_modules, dist, \*.tgz)
- Create `C:/PROJ/kova-cli/src/types.ts` with ALL type definitions:
  - `DetectedProject` (language, framework, packageManager, database, auth, payments, commands)
  - `KovaConfig` (project, models, quality, agents, boundaries, rules, execution, notifications, usage_tracking, plan_validation)
  - `CheckpointFile` (plan, started_at, status, tasks map, token_usage, validation)
  - `CheckpointTask` (status, agent_type, model, agent_id, started_at, completed_at, duration_s, tokens)
  - `TokenUsage` (total_input, total_output, total_combined, cost_estimate_usd, per_task, session_start, plan_type, window_allocation)
  - `PlanTask` (id, name, depends_on, assigned_to, agent_type, parallel, description, files)
  - `ModelTier` = "haiku" | "sonnet" | "opus"
  - `PlanType` = "pro" | "max5" | "max20" | "api"
  - `TaskStatus` = "pending" | "in_progress" | "completed" | "failed" | "blocked"
- Create `C:/PROJ/kova-cli/src/lib/constants.ts` with:
  - VERSION = "0.1.0"
  - KOVA_CONFIG_FILE = "kova.yaml"
  - CLAUDE_DIR = ".claude"
  - TASKS_DIR = ".claude/tasks"
  - Colors object using chalk
  - PLAN_ALLOCATIONS: { pro: 44000, max5: 88000, max20: 220000, api: Infinity }
  - TOKEN_COSTS: { haiku: { input: X, output: Y }, sonnet: {...}, opus: {...} }
  - DEFAULT_CONFIG: KovaConfig object with all defaults
- Create `C:/PROJ/kova-cli/src/lib/logger.ts` with:
  - info(), success(), warn(), error(), debug() functions using chalk
  - header() for section headers
  - table() for simple tables
  - progress() for task status lines ([done], [running], [pending], [blocked], [failed])
- Run `cd C:/PROJ/kova-cli && npm install` to install all dependencies
- Run `npm run lint` to verify TypeScript compiles

### 2. Copy Template Files

- **Task ID**: copy-templates
- **Depends On**: setup-foundation
- **Assigned To**: builder-core
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Copy these files from `C:/PROJ/FRANCISMYLESAPP/.claude/` to `C:/PROJ/kova-cli/templates/`:
  - `commands/team-plan.md` -> `templates/commands/team-plan.md`
  - `commands/build.md` -> `templates/commands/build.md`
  - `commands/team-build.md` -> `templates/commands/team-build.md`
  - `skills/session-management/SKILL.md` -> `templates/skills/session-management/SKILL.md`
  - `skills/sub-agent-invocation/SKILL.md` -> `templates/skills/sub-agent-invocation/SKILL.md`
  - `hooks/Validators/validate-new-file.mjs` -> `templates/hooks/Validators/validate-new-file.mjs`
  - `hooks/Validators/validate-file-contains.mjs` -> `templates/hooks/Validators/validate-file-contains.mjs`
  - `hooks/FormatterHook/formatter.mjs` -> `templates/hooks/FormatterHook/formatter.mjs`
  - `hooks/SkillActivationHook/skill-activation-prompt.mjs` -> `templates/hooks/SkillActivationHook/skill-activation-prompt.mjs`
  - `agents/agent-rules.json` -> `templates/agents/agent-rules.json`
  - `skills/skill-rules.json` -> `templates/skills/skill-rules.json`
  - `settings.json` -> `templates/settings.json`
- Create `templates/kova.yaml.template` -- a default kova.yaml with placeholder values that `init` will fill in based on detection
- Create `templates/CLAUDE.md.template` -- a default CLAUDE.md that references Kova orchestration system, model tiering, and quality gates. Use the PRD section 9.2 as guide.
- Verify all template files are present and readable

### 3. Core Library Modules

- **Task ID**: build-core-lib
- **Depends On**: copy-templates
- **Assigned To**: builder-core
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` for full specifications of each module
- Read `C:/PROJ/kova-cli/src/types.ts` and `C:/PROJ/kova-cli/src/lib/constants.ts` for type definitions
- Build `src/lib/detect.ts`:
  - `detectProject(projectDir: string): Promise<DetectedProject>` function
  - Detect language: check for tsconfig.json, pyproject.toml, go.mod, Cargo.toml, package.json
  - Detect framework: read package.json dependencies for next, expo, react, vue, angular, express, etc.
  - Detect package manager: check for package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb
  - Detect commands: read scripts from package.json (test, lint, build, typecheck, dev)
  - Detect database: check dependencies for @supabase/supabase-js, prisma, drizzle-orm, mongoose
  - Detect auth: check dependencies for better-auth, next-auth, @supabase/auth-helpers, passport
  - Detect payments: check dependencies for stripe, @polar-sh/sdk, dodopayments
  - All detection is file-based (fs.existsSync, JSON.parse of package.json)
  - Use path.join() for all paths (cross-platform)
- Build `src/lib/scaffold.ts`:
  - `scaffoldProject(projectDir: string, options: { force?: boolean, merge?: boolean }): Promise<string[]>` function
  - Copy all template files to target `.claude/` directory
  - Create `.claude/tasks/` directory
  - Return list of created files
  - If `merge` is true, skip files that already exist
  - If `force` is true, overwrite everything
  - If neither, check for existing `.claude/` and throw if it exists
  - Use `import.meta.url` + `fileURLToPath` to locate templates relative to package install location
- Build `src/lib/config.ts`:
  - `loadConfig(projectDir: string): Promise<KovaConfig | null>` -- uses cosmiconfig to find kova.yaml
  - `saveConfig(projectDir: string, config: KovaConfig): Promise<void>` -- writes kova.yaml
  - `generateConfig(detected: DetectedProject): KovaConfig` -- creates default config from detection results
  - `setConfigValue(projectDir: string, key: string, value: string): Promise<void>` -- dot-notation setter
  - `addRule(projectDir: string, rule: string): Promise<void>` -- append to rules array
  - `addBoundary(projectDir: string, boundary: string): Promise<void>` -- append to boundaries
- Build `src/lib/checkpoint.ts`:
  - `createCheckpoint(planPath: string, tasks: PlanTask[]): CheckpointFile` -- initialize
  - `readCheckpoint(checkpointPath: string): CheckpointFile | null` -- read from disk
  - `writeCheckpoint(checkpointPath: string, checkpoint: CheckpointFile): void` -- atomic write (write to .tmp, rename)
  - `updateTaskStatus(checkpoint: CheckpointFile, taskId: string, status: TaskStatus, extra?: Partial<CheckpointTask>): CheckpointFile`
  - `getLatestCheckpoint(tasksDir: string): string | null` -- find most recent .progress.json
  - `getCheckpointPath(planPath: string): string` -- derive checkpoint path from plan path
- Build `src/lib/subprocess.ts`:
  - `invokeClaude(args: { command: string, prompt?: string, cwd: string, timeout?: number }): Promise<{ stdout: string, exitCode: number }>` -- invoke Claude Code CLI
  - `isClaudeInstalled(): Promise<boolean>` -- check if `claude` is in PATH
  - Handle subprocess errors gracefully with actionable messages
- Build `src/lib/model-selector.ts`:
  - `selectModel(task: PlanTask, config: KovaConfig): ModelTier` -- implement the classification logic from PRD section F1.7
  - Export the function and the signal analysis logic
- Build `src/lib/token-tracker.ts`:
  - `TokenTracker` class with:
    - `constructor(planType: PlanType)`
    - `addTaskUsage(taskId: string, input: number, output: number, model: ModelTier): void`
    - `getTotalUsage(): TokenUsage`
    - `getTaskUsage(taskId: string): { input: number, output: number, total: number, model: ModelTier }`
    - `getBudgetPercent(): number`
    - `getRemainingTokens(): number`
    - `estimateCost(): number`
    - `formatTaskSummary(taskId: string): string` -- one-line summary for per-task display
    - `formatBuildSummary(): string` -- full table for build completion
    - `shouldWarn(): boolean` -- check if at 80% threshold
    - `shouldPause(): boolean` -- check if at 95% threshold
  - `toCheckpointData(): TokenUsage` -- serialize for checkpoint

### 4. Build CLI Commands (init, config, status)

- **Task ID**: build-commands-1
- **Depends On**: build-core-lib
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` (sections F1.1, F1.5, F1.6) for command specifications
- Read all files in `C:/PROJ/kova-cli/src/lib/` and `C:/PROJ/kova-cli/src/types.ts` for available APIs
- Build `src/commands/init.ts`:
  - Parse flags: --force, --merge, --dry-run, --no-detect, --preset
  - Call detectProject() unless --no-detect
  - Call scaffoldProject() with force/merge options
  - Call generateConfig() and saveConfig()
  - Generate CLAUDE.md from template, replacing placeholders with detected values
  - Print detection results using logger
  - Print list of created files
  - Print "Next steps" guidance
  - Handle errors: existing .claude/ without --force/--merge, write permission issues
- Build `src/commands/config.ts`:
  - `kova config` (no args): display current config using logger.table()
  - `kova config set <key> <value>`: call setConfigValue()
  - `kova config add-rule <rule>`: call addRule()
  - `kova config add-boundary <pattern>`: call addBoundary()
  - Handle missing kova.yaml with actionable error
- Build `src/commands/status.ts`:
  - Call getLatestCheckpoint() to find most recent checkpoint
  - Parse and display formatted task table with status icons
  - Show timing info (started, elapsed, estimated remaining)
  - Show token usage summary if available
  - Handle no checkpoint found with helpful message
- Build `src/index.ts`:
  - Import Commander.js
  - Register all commands with descriptions and options
  - Add version command
  - Add global --verbose flag
  - Export the program for bin/kova.js to call
  - Use lazy imports for commands (import only when command is invoked) for startup speed
- Run `npm run build` to verify TypeScript compiles and tsup produces dist/

### 5. Build CLI Commands (plan, build, team-build)

- **Task ID**: build-commands-2
- **Depends On**: build-commands-1
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` (sections F1.2, F1.3, F1.4) for command specifications
- Read `C:/PROJ/kova-cli/src/lib/subprocess.ts` and `C:/PROJ/kova-cli/src/lib/checkpoint.ts` for available APIs
- Build `src/commands/plan.ts`:
  - Validate .claude/ directory exists (suggest `kova init` if not)
  - Load kova.yaml config
  - Check if Claude Code is installed (isClaudeInstalled())
  - Invoke Claude Code with /team-plan command and user prompt
  - After completion, find the newly created plan file in .claude/tasks/
  - Display plan summary (read and parse the plan file for key sections)
  - Ask user to proceed with build (Y/n)
  - If Y, call the build command internally
  - Parse flags: --model, --auto-build, --output
- Build `src/commands/build.ts`:
  - Accept optional plan-path argument (default: find most recent plan in .claude/tasks/)
  - Parse the plan markdown file to extract task list
  - Create checkpoint file
  - Check if Claude Code is installed
  - Invoke Claude Code with /build command and plan path
  - Display progress during execution using logger.progress()
  - After completion, display build summary with token usage
  - Parse flags: --resume, --parallel, --model-override, --dry-run, --verbose, --no-validate
  - If --resume, read existing checkpoint and skip completed tasks
- Build `src/commands/team-build.ts`:
  - Same structure as build.ts but:
  - Check CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 env var
  - Invoke Claude Code with /team-build command instead
  - Display wave-based progress
  - Parse additional flag: --wave-timeout
- Verify all commands work with `npm run build && node bin/kova.js --help`

### 6. Update index.ts with All Commands

- **Task ID**: wire-commands
- **Depends On**: build-commands-2
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: haiku
- **Parallel**: false
- Ensure `src/index.ts` registers all commands correctly
- Verify `bin/kova.js` invokes the CLI properly
- Run `npm run build && node bin/kova.js --help` to verify all commands appear
- Run `node bin/kova.js init --help` to verify init flags appear
- Run `node bin/kova.js plan --help` to verify plan flags appear
- Run `node bin/kova.js build --help` to verify build flags appear

### 7. Write Unit Tests

- **Task ID**: write-unit-tests
- **Depends On**: wire-commands
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all source files in `C:/PROJ/kova-cli/src/` to understand the APIs being tested
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` for expected behaviors
- Write `tests/detect.test.ts`:
  - Test detection of TypeScript project (mock tsconfig.json)
  - Test detection of Python project (mock pyproject.toml)
  - Test detection of Go project (mock go.mod)
  - Test detection of Next.js framework (mock package.json with next dep)
  - Test detection of Expo framework
  - Test detection of npm (package-lock.json), yarn (yarn.lock), pnpm (pnpm-lock.yaml)
  - Test detection of Supabase, Prisma, Drizzle database
  - Test detection of auth providers (better-auth, next-auth)
  - Test detection of payment providers (stripe)
  - Test detection of scripts (test, lint, build)
  - Test empty directory returns sensible defaults
  - Use tmp directories for isolation
- Write `tests/scaffold.test.ts`:
  - Test that scaffold creates all expected files
  - Test --force overwrites existing files
  - Test --merge skips existing files
  - Test error when .claude/ exists without --force or --merge
  - Test that created files have correct content (spot check a few)
  - Use tmp directories for isolation
- Write `tests/config.test.ts`:
  - Test generateConfig() from detected project
  - Test saveConfig() writes valid YAML
  - Test loadConfig() reads kova.yaml
  - Test setConfigValue() with dot notation (models.trivial)
  - Test addRule() appends to rules array
  - Test addBoundary() appends to boundaries
  - Test loadConfig() returns null when no config found
- Write `tests/checkpoint.test.ts`:
  - Test createCheckpoint() initializes correctly
  - Test writeCheckpoint() + readCheckpoint() roundtrip
  - Test updateTaskStatus() changes status correctly
  - Test getLatestCheckpoint() finds most recent file
  - Test getCheckpointPath() derives correct path from plan path
  - Test atomic write (verify .tmp file is removed after rename)
- Write `tests/model-selector.test.ts`:
  - Test haiku selection for simple tasks (rename, typo, config)
  - Test sonnet selection for moderate tasks (2-5 files)
  - Test opus selection for architectural tasks
  - Test opus selection for security-touching tasks with 3+ files
  - Test opus selection for tasks with 3+ dependents
  - Test config override takes precedence
- Write `tests/token-tracker.test.ts`:
  - Test addTaskUsage() accumulates correctly
  - Test getTotalUsage() sums all tasks
  - Test getBudgetPercent() for pro, max5, max20 plans
  - Test getRemainingTokens() calculation
  - Test estimateCost() with different models
  - Test shouldWarn() at 80% threshold
  - Test shouldPause() at 95% threshold
  - Test formatBuildSummary() produces formatted output
  - Test toCheckpointData() serialization
- Run `npm test` to verify all tests pass

### 8. Write Integration Tests

- **Task ID**: write-integration-tests
- **Depends On**: write-unit-tests
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Write `tests/init.integration.test.ts`:
  - Create a temp directory with a mock package.json (Next.js + TypeScript + Supabase + Stripe)
  - Run `kova init` programmatically (import and call the init command function)
  - Verify .claude/ directory was created
  - Verify all template files exist
  - Verify kova.yaml was generated with correct detection values
  - Verify CLAUDE.md was generated
  - Verify .claude/tasks/ directory exists
  - Test `kova init --dry-run` shows what would be created without creating
  - Test `kova init --force` overwrites existing
  - Clean up temp directories after each test
- Write `tests/config.integration.test.ts`:
  - Create temp dir with kova.yaml
  - Test `kova config` displays config
  - Test `kova config set models.trivial haiku` updates the file
  - Test `kova config add-rule "use strict"` appends rule
  - Test `kova config add-boundary "*.lock"` appends boundary
- Write `tests/status.integration.test.ts`:
  - Create temp dir with a mock .progress.json checkpoint file
  - Test `kova status` displays correct task statuses
  - Test `kova status` with no checkpoint shows helpful message
- Run `npm test` to verify all tests pass

### 9. Write README

- **Task ID**: write-readme
- **Depends On**: write-integration-tests
- **Assigned To**: builder-docs
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: true
- Read the PRD at `C:/PROJ/kova-cli/PRD.md` sections 1, 1.1, 3, 7.1 for product description and features
- Create `C:/PROJ/kova-cli/README.md` with:
  - Kova branding (name, tagline, wolf pack metaphor)
  - One-paragraph description
  - Quick install: `npm install -g kova-cli`
  - Quick start: `kova init && kova plan "your task" && kova build`
  - All commands with descriptions and key flags
  - Configuration reference (kova.yaml format)
  - Agent types reference table
  - Model tiering explanation
  - Token tracking explanation
  - Requirements (Node.js 18+, Claude Code CLI)
  - License (MIT)
  - Keep it under 300 lines -- concise and scannable

### 10. Final Build and Package Validation

- **Task ID**: final-build
- **Depends On**: write-integration-tests, write-readme
- **Assigned To**: builder-foundation
- **Agent Type**: backend-engineer
- **Model**: haiku
- **Parallel**: false
- Run `cd C:/PROJ/kova-cli && npm run build` -- verify clean build
- Run `npm test` -- verify all tests pass
- Run `npm pack --dry-run` -- verify package contents look correct
- Run `node bin/kova.js --version` -- verify version displays
- Run `node bin/kova.js --help` -- verify all commands listed
- Run `node bin/kova.js init --help` -- verify flags listed
- Fix any issues found

### 11. Quality Validation

- **Task ID**: validate-all
- **Depends On**: setup-foundation, copy-templates, build-core-lib, build-commands-1, build-commands-2, wire-commands, write-unit-tests, write-integration-tests, write-readme, final-build
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands (see below)
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check that all types are properly defined (no `any` types)
- Check that all commands have --help text
- Check that error messages are actionable
- Check cross-platform path usage (path.join, not hardcoded slashes)
- Verify template files match source files from Francis Myles project
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. `npm install` succeeds with no errors
2. `npm run build` produces dist/ directory with compiled JavaScript
3. `npm test` runs all tests and ALL pass (0 failures)
4. `node bin/kova.js --version` outputs "0.1.0"
5. `node bin/kova.js --help` lists all 7 commands (init, plan, build, team-build, status, config, version)
6. `kova init` in a test directory creates .claude/ with all 12 template files + kova.yaml + CLAUDE.md
7. `kova init` correctly detects TypeScript, framework, package manager from package.json
8. `kova config` displays current configuration
9. `kova config set models.trivial haiku` updates kova.yaml
10. `kova status` with a checkpoint file displays formatted progress
11. `kova status` with no checkpoint shows helpful message
12. `kova plan --help` shows all flags
13. `kova build --help` shows all flags
14. No TypeScript `any` types in source code
15. All file paths use `path.join()` (no hardcoded slashes)
16. `npm pack --dry-run` succeeds and lists expected files
17. README.md exists with install, usage, and configuration sections
18. Template files in templates/ match source files from Francis Myles project

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-cli && npm install` -- Install dependencies
- `npm run build` -- Verify TypeScript compiles and tsup produces dist/
- `npm run lint` -- Verify no TypeScript errors (tsc --noEmit)
- `npm test` -- Run full test suite
- `node bin/kova.js --version` -- Check version output
- `node bin/kova.js --help` -- Check all commands listed
- `node bin/kova.js init --help` -- Check init flags
- `node bin/kova.js plan --help` -- Check plan flags
- `node bin/kova.js build --help` -- Check build flags
- `node bin/kova.js team-build --help` -- Check team-build flags
- `node bin/kova.js status --help` -- Check status flags
- `node bin/kova.js config --help` -- Check config flags
- `npm pack --dry-run` -- Verify package contents

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is `C:/PROJ/kova-cli/`
- Source template files are in `C:/PROJ/FRANCISMYLESAPP/.claude/`
- The PRD with full specifications is at `C:/PROJ/kova-cli/PRD.md`
- For Phase 1, skip ink/React terminal UI -- use chalk + console.log for output (simpler, faster startup)
- The `plan`, `build`, and `team-build` commands invoke Claude Code CLI as a subprocess. In Phase 1, the core logic is the subprocess invocation + checkpoint management. The actual orchestration happens inside Claude Code.
- Template files should be copied AS-IS from the source project. Do not modify their content.
- Settings.json template should be a generic version that works for any project (not Francis Myles-specific)

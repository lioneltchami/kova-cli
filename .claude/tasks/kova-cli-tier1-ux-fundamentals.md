# Plan: Kova CLI Tier 1 - UX Fundamentals

## Task Description

Add four UX-fundamental features to the Kova CLI that bring it to parity with mature CLI tools in 2026: (1) interactive mode for `kova init` with guided prompts, (2) shell tab-completions for bash/zsh/fish, (3) automatic update checking against the npm registry, and (4) intelligent error suggestions with Levenshtein-based typo correction and docs links.

These are table-stakes features -- without them, developers will perceive Kova as immature compared to tools like Vercel CLI, Turborepo, and Railway.

## Objective

Deliver 4 UX features that make Kova feel professional and approachable: interactive init prompts (discovering options without reading docs), shell completions (tab-complete commands and flags), auto-update banner (users stay current), and smart error messages (typo correction + actionable guidance). All 190 existing tests must continue to pass with 35+ new tests for Tier 1 features.

## Problem Statement

Kova currently requires users to read documentation to discover commands, flags, and options. `kova init` requires flag-based configuration (--force, --preset, etc.) which is opaque for new users. Typos in commands produce generic "unknown command" errors. Users have no way to know when a newer version is available. Shell tab-completion is absent, making command discovery slow.

## Solution Approach

1. **Interactive init**: Add `@inquirer/prompts` as a dependency. When `kova init` is called without flags, detect whether stdin is a TTY (interactive terminal). If TTY and no flags, launch interactive prompts. If non-TTY or flags present, use existing flag-based flow. Prompts confirm detection results and let users override.

2. **Shell completions**: New `kova completions <shell>` command that outputs shell-specific completion scripts to stdout. Scripts are generated from the command/flag registry (no hardcoding). Support bash, zsh, and fish.

3. **Auto-update check**: New `src/lib/update-checker.ts` module that uses native `fetch()` to query the npm registry. Results cached in `~/.kova/update-check.json` for 24 hours. Check runs asynchronously at startup (non-blocking). Respects `KOVA_NO_UPDATE_CHECK=1` env var.

4. **Error suggestions**: New `src/lib/error-handler.ts` module with Levenshtein distance function for typo correction. Commander.js `on('command:*')` hook catches unknown commands and suggests closest match. Global error wrapper adds docs link and KOVA_DEBUG hint.

**Dependency note**: `@inquirer/prompts` is the ONLY new runtime dependency. Everything else uses native Node.js APIs (fetch, crypto, fs, path, os).

## Relevant Files

### Existing Files to Modify

- `package.json` -- Add `@inquirer/prompts` dependency
- `src/index.ts` -- Add completions command, unknown-command handler, auto-update check at startup
- `src/commands/init.ts` -- Add interactive mode when no flags and TTY detected
- `src/lib/logger.ts` -- Add `updateBanner()` function for update notification display

### New Files to Create

- `src/lib/interactive.ts` -- Interactive prompt flows for init command
- `src/lib/completions.ts` -- Shell completion script generators (bash, zsh, fish)
- `src/lib/update-checker.ts` -- npm registry check with caching
- `src/lib/error-handler.ts` -- Levenshtein distance, command suggestion, global error wrapper
- `src/commands/completions.ts` -- `kova completions <shell>` command
- `tests/interactive.test.ts` -- Unit tests for interactive prompts (mocked)
- `tests/completions.test.ts` -- Unit tests for completion script generation
- `tests/update-checker.test.ts` -- Unit tests for update check logic
- `tests/error-handler.test.ts` -- Unit tests for Levenshtein and suggestions
- `tests/ux-integration.test.ts` -- Integration tests for end-to-end UX flows

## Implementation Phases

### Phase 1: Foundation

Install `@inquirer/prompts`, create the 4 library modules (interactive.ts, completions.ts, update-checker.ts, error-handler.ts).

### Phase 2: Core Implementation

Build the completions command, integrate interactive mode into init, wire auto-update check into index.ts, add unknown-command handler.

### Phase 3: Integration & Polish

Write comprehensive tests, verify all 190 existing tests pass, verify cross-platform behavior, run full validation.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-ux-libs
  - Role: Build the 4 library modules (interactive.ts, completions.ts, update-checker.ts, error-handler.ts) and install @inquirer/prompts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-ux-integration
  - Role: Integrate interactive mode into init.ts, build completions command, wire auto-update and error handler into index.ts, update logger.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write all unit and integration tests for Tier 1 features
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

### 1. Install Dependencies and Build Library Modules

- **Task ID**: build-ux-libs
- **Depends On**: none
- **Assigned To**: builder-ux-libs
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read these files for context:
  - `C:/PROJ/kova-cli/package.json`
  - `C:/PROJ/kova-cli/src/lib/constants.ts`
  - `C:/PROJ/kova-cli/src/lib/logger.ts`
  - `C:/PROJ/kova-cli/src/commands/init.ts`
  - `C:/PROJ/kova-cli/src/index.ts`
  - `C:/PROJ/kova-cli/src/types.ts`
- Install `@inquirer/prompts`: run `cd C:/PROJ/kova-cli && npm install @inquirer/prompts`
- Build **`src/lib/error-handler.ts`**:
  - `levenshteinDistance(a: string, b: string): number` -- standard Levenshtein algorithm, no dependencies
  - `suggestCommand(input: string, commands: string[]): string | null` -- find closest match with distance <= 3
  - `formatErrorWithSuggestion(input: string, commands: string[]): string` -- returns formatted error message: "Unknown command: X. Did you mean 'Y'?" with docs link
  - `wrapCommandAction(action: (...args: unknown[]) => Promise<void>): (...args: unknown[]) => Promise<void>` -- returns wrapped function that catches errors and formats them nicely. On error: show error.message, if KOVA_DEBUG show stack, always show "Docs: https://github.com/kova-cli/kova"
- Build **`src/lib/update-checker.ts`**:
  - `interface UpdateCheckCache { lastCheck: string; latestVersion: string; }`
  - `getCachePath(): string` -- returns `path.join(os.homedir(), ".kova", "update-check.json")`
  - `readCache(): UpdateCheckCache | null` -- read and parse cache file, return null if missing/corrupt
  - `writeCache(cache: UpdateCheckCache): void` -- mkdir -p ~/.kova, write cache JSON
  - `isCacheValid(cache: UpdateCheckCache): boolean` -- true if lastCheck is within 24 hours
  - `async checkForUpdate(currentVersion: string): Promise<string | null>` -- check cache first, if valid return cached latestVersion (or null if same as current). If cache expired or missing, fetch `https://registry.npmjs.org/kova-cli/latest`, extract version field, write cache, return latestVersion if > currentVersion, else null. Use native fetch() with AbortSignal.timeout(5000). On ANY error (network, parse, write), return null silently.
  - `async checkForUpdateBackground(currentVersion: string): Promise<void>` -- non-blocking wrapper that calls checkForUpdate and if result is non-null, stores it for later display. Uses a module-level variable to store the result.
  - `getUpdateResult(): string | null` -- returns the stored update result (called after command execution to show banner)
  - IMPORTANT: The check must NEVER slow down or block the CLI. Use `void checkForUpdateBackground()` (fire-and-forget) at startup.
  - Respect `KOVA_NO_UPDATE_CHECK=1` environment variable -- return null immediately if set.
- Build **`src/lib/completions.ts`**:
  - `interface CommandInfo { name: string; description: string; options: Array<{ flags: string; description: string }> }`
  - `getCommandRegistry(): CommandInfo[]` -- returns hardcoded list of all Kova commands with their options. This is intentionally hardcoded (not parsed from Commander) for reliability and simplicity. Include all 9 commands: init, plan, run, build, team-build, status, config, update, completions.
  - `generateBashCompletion(): string` -- returns a bash completion script. Uses `_kova_completions()` function with `COMPREPLY` and `compgen`. Completes command names at position 1, flags per command at position 2+.
  - `generateZshCompletion(): string` -- returns a zsh completion script using `_kova()` function with `_arguments` and `_describe`.
  - `generateFishCompletion(): string` -- returns a fish completion script using `complete -c kova` commands.
  - All three generators must include: command names, command descriptions, per-command flags with descriptions, and template names for --template flag.
- Build **`src/lib/interactive.ts`**:
  - `async function runInteractiveInit(detected: DetectedProject): Promise<InteractiveInitResult>`
  - `InteractiveInitResult` type: `{ projectName: string; language: string; framework: string; packageManager: string; database: string | null; auth: string | null; payments: string | null; planType: PlanType; enableWebhooks: boolean; confirmed: boolean }`
  - Import from `@inquirer/prompts`: `input`, `confirm`, `select`
  - Prompt sequence:
    1. `input({ message: "Project name", default: path.basename(process.cwd()) })`
    2. `confirm({ message: \`Detected ${detected.language} + ${detected.framework}. Correct?\`, default: true })` -- if false, show select for language then framework
    3. `select({ message: "Database", choices: ["Supabase", "Prisma", "Drizzle", "MongoDB", "None"], default: detected.database || "None" })`
    4. `select({ message: "Auth provider", choices: ["BetterAuth", "NextAuth", "Supabase Auth", "Passport", "None"], default: detected.auth || "None" })`
    5. `select({ message: "Payment provider", choices: ["Stripe", "Polar", "Dodo Payments", "None"], default: detected.payments || "None" })`
    6. `select({ message: "Claude plan (for token tracking)", choices: [{name: "Pro ($20/mo)", value: "pro"}, {name: "Max 5x (~$80/mo)", value: "max5"}, {name: "Max 20x (~$320/mo)", value: "max20"}, {name: "API (pay-per-token)", value: "api"}], default: "max5" })`
    7. `confirm({ message: "Enable webhook notifications?", default: false })`
  - Convert "None" selections to null in the result
  - Export `isInteractiveMode(options: InitOptions): boolean` -- returns true when stdin is a TTY AND no meaningful flags are set (no force, no merge, no dryRun, no noDetect, no preset)
- Update **`src/lib/logger.ts`**:
  - Add `updateBanner(currentVersion: string, latestVersion: string): void` -- displays: "Update available: {current} -> {latest}. Run: npm install -g kova-cli" in yellow
- Run `cd C:/PROJ/kova-cli && npm run build` to verify compilation
- Run `npm test` to verify 190 existing tests still pass

### 2. Build Completions Command

- **Task ID**: build-completions-cmd
- **Depends On**: build-ux-libs
- **Assigned To**: builder-ux-integration
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/lib/completions.ts` to understand available APIs
- Create `src/commands/completions.ts`:

  ```typescript
  import * as logger from "../lib/logger.js";
  import {
    generateBashCompletion,
    generateZshCompletion,
    generateFishCompletion,
  } from "../lib/completions.js";

  export async function completionsCommand(shell?: string): Promise<void> {
    if (!shell) {
      logger.info("Usage: kova completions <bash|zsh|fish>");
      logger.info("");
      logger.info("Generate shell completion scripts:");
      logger.info("  kova completions bash >> ~/.bashrc");
      logger.info("  kova completions zsh >> ~/.zshrc");
      logger.info(
        "  kova completions fish > ~/.config/fish/completions/kova.fish",
      );
      return;
    }

    switch (shell.toLowerCase()) {
      case "bash":
        process.stdout.write(generateBashCompletion());
        break;
      case "zsh":
        process.stdout.write(generateZshCompletion());
        break;
      case "fish":
        process.stdout.write(generateFishCompletion());
        break;
      default:
        logger.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
        process.exit(1);
    }
  }
  ```

- Register in index.ts (add after the update command):
  ```typescript
  // Completions command
  program
    .command("completions [shell]")
    .description("Generate shell completion scripts (bash, zsh, fish)")
    .action(async (shell) => {
      const { completionsCommand } = await import("./commands/completions.js");
      await completionsCommand(shell);
    });
  ```
- Run `npm run build` and `node bin/kova.js completions --help`

### 3. Integrate Interactive Mode into Init

- **Task ID**: integrate-interactive
- **Depends On**: build-ux-libs
- **Assigned To**: builder-ux-integration
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside task 2, same agent resumed)
- Read `C:/PROJ/kova-cli/src/commands/init.ts` for current implementation
- Read `C:/PROJ/kova-cli/src/lib/interactive.ts` for interactive APIs
- Modify `initCommand()` in init.ts:
  - After `logger.banner()` and before detection, check `isInteractiveMode(options)`
  - If interactive mode:
    1. Run detection silently (no table display yet)
    2. Call `runInteractiveInit(detected)`
    3. If user cancels (confirmed === false), exit gracefully
    4. Override detected values with interactive results: `detected.database = result.database`, etc.
    5. Override config's usage_tracking.plan with result.planType
    6. If enableWebhooks is false, set notifications to null in config
    7. Continue with normal scaffold + config flow
  - If NOT interactive mode: existing flag-based flow unchanged
- Add imports at top of init.ts:
  ```typescript
  import { isInteractiveMode, runInteractiveInit } from "../lib/interactive.js";
  ```
- Run `npm run build`

### 4. Wire Auto-Update Check and Error Handler into index.ts

- **Task ID**: wire-update-and-errors
- **Depends On**: build-ux-libs, build-completions-cmd, integrate-interactive
- **Assigned To**: builder-ux-integration
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/index.ts`
- Read `C:/PROJ/kova-cli/src/lib/update-checker.ts`
- Read `C:/PROJ/kova-cli/src/lib/error-handler.ts`
- Read `C:/PROJ/kova-cli/src/lib/logger.ts`
- Modify `src/index.ts`:
  1. At the TOP of the file (before program.parse()), start the background update check:

     ```typescript
     import {
       checkForUpdateBackground,
       getUpdateResult,
     } from "./lib/update-checker.js";
     import { suggestCommand, wrapCommandAction } from "./lib/error-handler.js";
     import { VERSION } from "./lib/constants.js";
     import * as logger from "./lib/logger.js";

     // Fire-and-forget update check (non-blocking)
     void checkForUpdateBackground(VERSION);
     ```

  2. Add unknown command handler BEFORE `program.parse()`:
     ```typescript
     // Handle unknown commands with suggestions
     program.on("command:*", (operands: string[]) => {
       const unknown = operands[0] ?? "";
       const commands = program.commands.map((c) => c.name());
       const suggestion = suggestCommand(unknown, commands);
       if (suggestion) {
         logger.error(
           `Unknown command: ${unknown}. Did you mean '${suggestion}'?`,
         );
       } else {
         logger.error(`Unknown command: ${unknown}.`);
       }
       logger.info("Run 'kova --help' to see available commands.");
       logger.info("Docs: https://github.com/kova-cli/kova");
       process.exitCode = 1;
     });
     ```
  3. AFTER `program.parse()`, add the update banner display:
     ```typescript
     // Show update banner after command completes (if update available)
     // Use process.on('beforeExit') to ensure it runs after async commands
     process.on("beforeExit", () => {
       const latestVersion = getUpdateResult();
       if (latestVersion) {
         logger.updateBanner(VERSION, latestVersion);
       }
     });
     ```
  4. Wrap each command's action with `wrapCommandAction()` for global error handling. For each `.action(async (...) => { ... })`, wrap the inner function. Example:
     ```typescript
     .action(wrapCommandAction(async (options) => {
       const { initCommand } = await import("./commands/init.js");
       await initCommand(options);
     }))
     ```
     Apply this to ALL 9 commands (init, plan, run, build, team-build, status, config, update, completions).

- Run `npm run build`
- Verify: `node bin/kova.js --help` shows completions command
- Verify: `node bin/kova.js pln 2>/dev/null` shows "Did you mean 'plan'?"
- Verify: `node bin/kova.js completions bash` outputs bash script
- Run `npm test` to verify 190 existing tests still pass

### 5. Write Tier 1 Unit Tests

- **Task ID**: write-tier1-unit-tests
- **Depends On**: wire-update-and-errors
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all new source files in src/lib/ to understand APIs
- Write `tests/error-handler.test.ts`:
  - Test `levenshteinDistance("plan", "plan")` = 0
  - Test `levenshteinDistance("pln", "plan")` = 1
  - Test `levenshteinDistance("bild", "build")` = 1
  - Test `levenshteinDistance("xyz", "plan")` > 3
  - Test `levenshteinDistance("", "plan")` = 4
  - Test `suggestCommand("pln", ["plan", "build", "run"])` returns "plan"
  - Test `suggestCommand("bild", ["plan", "build", "run"])` returns "build"
  - Test `suggestCommand("xyz", ["plan", "build", "run"])` returns null (distance > 3)
  - Test `suggestCommand("stat", ["status", "plan", "build"])` returns "status"
  - Test `formatErrorWithSuggestion("pln", ["plan"])` contains "Did you mean"
  - Test `formatErrorWithSuggestion("xyz", ["plan"])` does NOT contain "Did you mean"
  - Test `wrapCommandAction` catches errors and does not rethrow (mock console.log, call wrapped function that throws, verify no throw propagation)
- Write `tests/update-checker.test.ts`:
  - Mock `fetch` globally with `vi.stubGlobal`
  - Test `getCachePath()` returns path containing ".kova"
  - Test `readCache()` returns null when no file exists
  - Test `writeCache()` then `readCache()` roundtrip
  - Test `isCacheValid()` returns true for cache written just now
  - Test `isCacheValid()` returns false for cache written 25 hours ago
  - Test `checkForUpdate("0.1.0")` with mock fetch returning `{"version": "0.2.0"}` returns "0.2.0"
  - Test `checkForUpdate("0.2.0")` with mock fetch returning `{"version": "0.2.0"}` returns null (same version)
  - Test `checkForUpdate()` returns null when fetch throws (network error)
  - Test `checkForUpdate()` returns null when KOVA_NO_UPDATE_CHECK is set
  - Test `checkForUpdate()` uses cached result within 24 hours (fetch not called twice)
  - Use temp directories for cache files (override getCachePath or test internal functions)
- Write `tests/completions.test.ts`:
  - Test `generateBashCompletion()` returns string containing "\_kova"
  - Test `generateBashCompletion()` contains all command names: init, plan, run, build, team-build, status, config, update, completions
  - Test `generateBashCompletion()` contains "--resume" flag
  - Test `generateZshCompletion()` returns string containing "#compdef kova"
  - Test `generateZshCompletion()` contains all command names
  - Test `generateFishCompletion()` returns string containing "complete -c kova"
  - Test `generateFishCompletion()` contains all command names
  - Test `getCommandRegistry()` returns 9 commands
  - Test each command in registry has name, description, and options array
- Write `tests/interactive.test.ts`:
  - Test `isInteractiveMode({})` with TTY = true returns true
  - Test `isInteractiveMode({ force: true })` returns false
  - Test `isInteractiveMode({ merge: true })` returns false
  - Test `isInteractiveMode({ dryRun: true })` returns false
  - Test `isInteractiveMode({ noDetect: true })` returns false
  - Test `isInteractiveMode({ preset: "nextjs" })` returns false
  - NOTE: Testing runInteractiveInit requires mocking @inquirer/prompts, which is complex. Test isInteractiveMode thoroughly and test the result mapping logic separately.
- Run `npm test` -- all tests must pass

### 6. Write Tier 1 Integration Tests

- **Task ID**: write-tier1-integration-tests
- **Depends On**: write-tier1-unit-tests
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Write `tests/ux-integration.test.ts`:
  - Test completions bash output is valid (contains function definition and COMPREPLY)
  - Test completions zsh output is valid (contains compdef)
  - Test completions fish output is valid (contains "complete -c kova")
  - Test error suggestion for "pln" suggests "plan" (call suggestCommand directly)
  - Test error suggestion for "biuld" suggests "build"
  - Test error suggestion for "rnnn" suggests "run"
  - Test error suggestion for "completley-wrong" returns null
  - Test update checker cache roundtrip in temp directory
  - Test update checker respects KOVA_NO_UPDATE_CHECK env var
  - Test wrapCommandAction displays error message without stack trace (when KOVA_DEBUG not set)
  - Test logger.updateBanner() outputs version comparison string
- Run `npm test` -- ALL tests must pass (190 existing + new)
- Run `npm test` again to verify no flaky tests
- Run `npm run build` to verify clean compilation

### 7. Final Validation

- **Task ID**: validate-all
- **Depends On**: build-ux-libs, build-completions-cmd, integrate-interactive, wire-update-and-errors, write-tier1-unit-tests, write-tier1-integration-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check:
  - All 190 existing tests still pass (zero regressions)
  - 35+ new tests added and passing
  - `@inquirer/prompts` in package.json dependencies
  - `kova completions bash` outputs valid bash script
  - `kova completions zsh` outputs valid zsh script
  - `kova completions fish` outputs valid fish script
  - Unknown command shows suggestion (test with `kova pln`)
  - `isInteractiveMode` correctly detects flag-based vs interactive
  - Auto-update checker has cache path in ~/.kova/
  - No TypeScript `any` types in new code
  - `npm pack --dry-run` succeeds
  - `npm run build` compiles cleanly
- Run `npm test` twice to verify no flaky tests
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. All 190 existing tests continue to pass (zero regressions)
2. `npm run build` compiles cleanly with no errors
3. 35+ new tests added, all passing
4. `@inquirer/prompts` is in package.json dependencies
5. `kova completions bash` outputs a valid bash completion script containing all 9 command names
6. `kova completions zsh` outputs a valid zsh completion script
7. `kova completions fish` outputs a valid fish completion script
8. `kova completions` (no arg) shows usage instructions
9. Unknown command `kova pln` suggests "plan" in error message
10. Unknown command error includes docs link
11. `isInteractiveMode({})` returns true when stdin is TTY
12. `isInteractiveMode({ force: true })` returns false (any flag disables interactive)
13. `levenshteinDistance("pln", "plan")` returns 1
14. `suggestCommand("bild", [...])` returns "build"
15. Auto-update cache path is `~/.kova/update-check.json`
16. Auto-update respects `KOVA_NO_UPDATE_CHECK=1` env var
17. Auto-update does not block CLI startup (non-blocking check)
18. `wrapCommandAction` catches errors and shows user-friendly message
19. No TypeScript `any` types in new or modified code
20. `npm pack --dry-run` succeeds
21. No flaky tests (run suite twice, same results)
22. `kova --help` lists completions command

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-cli && npm run build` -- Verify clean compilation
- `npm run lint` -- Verify no TypeScript errors
- `npm test` -- Run full test suite (should be 225+ tests, 0 failures)
- `npm test` -- Run again to verify no flaky tests
- `node bin/kova.js --version` -- Still outputs 0.1.0
- `node bin/kova.js --help` -- Lists completions command
- `node bin/kova.js completions` -- Shows usage
- `node bin/kova.js completions bash` -- Outputs bash script
- `node bin/kova.js completions zsh` -- Outputs zsh script
- `node bin/kova.js completions fish` -- Outputs fish script
- `npm pack --dry-run` -- Verify package contents

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is C:/PROJ/kova-cli/
- Do NOT break any existing functionality. All 190 tests must pass.
- `@inquirer/prompts` is the ONLY new dependency. It is the modern ESM-compatible Inquirer library (NOT the old `inquirer` package).
- For interactive mode testing, mock `@inquirer/prompts` functions with `vi.mock()`. Testing actual terminal prompts is not possible in automated tests.
- For update checker testing, mock global `fetch` with `vi.stubGlobal("fetch", vi.fn())` and use temp directories for cache files.
- The Levenshtein distance implementation should be a simple dynamic programming solution (no external library).
- Shell completion scripts should be hardcoded based on the known command registry, not dynamically parsed from Commander.js. This is simpler and more reliable.
- The `wrapCommandAction` function should NOT re-throw errors. It catches, formats, and exits with code 1.
- Auto-update check: Use `void checkForUpdateBackground(VERSION)` at the top of index.ts (fire-and-forget). Display the banner in `process.on("beforeExit")` handler AFTER the command completes.
- Interactive mode detection: `process.stdin.isTTY` returns true in interactive terminals, undefined/false in pipes and CI.

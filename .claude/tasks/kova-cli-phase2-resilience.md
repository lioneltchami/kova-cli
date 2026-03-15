# Plan: Kova CLI Phase 2 - Resilience and Visibility

## Task Description

Enhance the Kova CLI with resilience features (improved checkpointing, crash recovery, cross-platform robustness), visibility features (live progress mode, enhanced status display), and webhook notifications. This builds on the Phase 1 MVP (92 tests passing, 18/18 acceptance criteria met) without breaking any existing functionality.

## Objective

Deliver enhanced checkpoint resilience (atomic writes on Windows, token persistence across resumes), live progress monitoring during builds, webhook notifications (Discord/Slack/custom), and verified cross-platform compatibility. All 92 existing tests must continue to pass, with 30+ new tests added for Phase 2 features.

## Problem Statement

Phase 1 delivers working CLI commands but has gaps in:

1. **Resilience**: Atomic file writes may fail on Windows (rename over existing file); token usage is not persisted across `--resume`; no recovery guidance on subprocess timeout
2. **Visibility**: No way to monitor build progress in real-time; no notifications when builds complete
3. **Cross-platform**: Glob patterns may use wrong separators on Windows; subprocess invocation may need `.cmd` extension on Windows

## Solution Approach

1. **Checkpoint hardening**: Fix atomic writes for Windows (unlink existing before rename); persist TokenTracker data in checkpoint on every task completion; restore token state on `--resume`
2. **Webhook notifications**: New `src/lib/notifications.ts` module using native `fetch()` (Node 18+) with graceful failure; configurable events in kova.yaml
3. **Live progress**: New `--live` flag on build/team-build that polls checkpoint file every 5 seconds and redraws terminal progress
4. **Cross-platform audit**: Normalize glob patterns to forward slashes; handle `claude.cmd` on Windows; use `os.tmpdir()` safely in tests

## Relevant Files

### Existing Files to Modify

- `src/lib/checkpoint.ts` -- Fix atomic writes for Windows; add token persistence helpers
- `src/lib/subprocess.ts` -- Handle Windows `.cmd` extension for claude CLI
- `src/lib/token-tracker.ts` -- Add `loadFromCheckpoint()` static method to restore state from checkpoint data
- `src/commands/build.ts` -- Integrate webhook notifications, live progress, enhanced resume with token restoration
- `src/commands/team-build.ts` -- Same enhancements as build.ts
- `src/commands/status.ts` -- Add live/watch mode
- `src/index.ts` -- Add `--live` flag to build and team-build commands
- `src/types.ts` -- Add webhook notification types

### New Files to Create

- `src/lib/notifications.ts` -- Webhook notification module (Discord/Slack/custom)
- `src/lib/live-progress.ts` -- Live progress polling and terminal display
- `tests/notifications.test.ts` -- Unit tests for webhook module
- `tests/live-progress.test.ts` -- Unit tests for live progress logic
- `tests/checkpoint-windows.test.ts` -- Cross-platform checkpoint tests
- `tests/resume-flow.test.ts` -- Integration test for full resume workflow with token persistence

## Implementation Phases

### Phase 1: Foundation

Harden checkpoint writes for Windows, fix subprocess for Windows, add notification types, add TokenTracker restore method.

### Phase 2: Core Implementation

Build webhook notification module, live progress module, integrate into build/team-build commands.

### Phase 3: Integration & Polish

Write comprehensive tests, verify cross-platform behavior, run full test suite, verify all 92 existing tests still pass.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-resilience
  - Role: Harden checkpoint.ts for Windows, fix subprocess.ts for Windows, enhance token-tracker.ts with restore capability, audit all file operations for cross-platform safety
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-features
  - Role: Build notifications.ts webhook module, build live-progress.ts module, integrate both into build.ts and team-build.ts commands, update index.ts with new flags
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write all new unit and integration tests for Phase 2 features
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode). Run ALL tests (old + new), verify builds, check cross-platform patterns.
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Cross-Platform Checkpoint Hardening

- **Task ID**: harden-checkpoint
- **Depends On**: none
- **Assigned To**: builder-resilience
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/src/lib/checkpoint.ts to understand current implementation
- Fix `writeCheckpoint()` for Windows: On Windows, `fs.renameSync()` fails if target already exists. Change to: try `fs.unlinkSync(checkpointPath)` first (catch if not exists), then `fs.renameSync(tmpPath, checkpointPath)`. Wrap in a try-catch so if unlink fails for a reason other than ENOENT, fall back to direct writeFileSync.
- Add `persistTokenUsage(checkpointPath: string, tokenData: TokenUsage): void` -- reads checkpoint, sets token_usage field, writes back atomically
- Verify glob pattern in `getLatestCheckpoint()` normalizes to forward slashes (already does `.replace(/\\/g, "/")` -- verify this works)
- Run `npm run build` to verify compilation

### 2. Cross-Platform Subprocess Fix

- **Task ID**: fix-subprocess
- **Depends On**: none
- **Assigned To**: builder-resilience
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside task 1)
- Read C:/PROJ/kova-cli/src/lib/subprocess.ts
- Fix `invokeClaude()` and `isClaudeInstalled()` for Windows: On Windows, the `claude` command may be `claude.cmd`. Use execa's `shell: true` option on Windows, or detect platform and try `claude.cmd` as fallback. Best approach: set `shell: true` on `process.platform === "win32"` which lets Windows resolve `.cmd` extensions automatically.
- Add better error messages for common failures:
  - ENOENT (command not found): "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
  - ETIMEOUT: "Claude CLI timed out. The task may be too complex. Try: kova build --resume"
  - EPERM: "Permission denied. Try running as administrator or check file permissions."
- Run `npm run build` to verify compilation

### 3. Token Tracker Restore from Checkpoint

- **Task ID**: token-restore
- **Depends On**: none
- **Assigned To**: builder-resilience
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 1-2)
- Read C:/PROJ/kova-cli/src/lib/token-tracker.ts
- Add static method `TokenTracker.fromCheckpoint(tokenUsage: TokenUsage): TokenTracker` that:
  - Creates a new TokenTracker with the checkpoint's planType
  - Populates taskUsage Map from tokenUsage.per_task
  - Sets sessionStart from tokenUsage.session_start
  - Returns the populated tracker so resumed builds can continue accumulating
- This enables --resume to restore token tracking state from the checkpoint
- Run `npm run build`

### 4. Webhook Notification Module

- **Task ID**: build-notifications
- **Depends On**: none
- **Assigned To**: builder-features
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 1-3)
- Read C:/PROJ/kova-cli/src/types.ts for existing types
- Add to types.ts:

  ```typescript
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

  export interface NotificationConfig {
    discord: string | null;
    slack: string | null;
    custom: string | null;
  }
  ```

- Create `src/lib/notifications.ts`:
  - `sendNotification(config: NotificationConfig, payload: WebhookPayload): Promise<void>` -- sends to all configured webhooks
  - `sendDiscord(url: string, payload: WebhookPayload): Promise<void>` -- format as Discord embed (username: "Kova", content: formatted message)
  - `sendSlack(url: string, payload: WebhookPayload): Promise<void>` -- format as Slack blocks (text + fields)
  - `sendCustom(url: string, payload: WebhookPayload): Promise<void>` -- POST raw JSON payload
  - Use native `fetch()` (Node 18+ built-in). No extra dependencies.
  - IMPORTANT: Every send function must wrap in try-catch. On failure, log a warning but NEVER throw. A webhook failure must not crash the build.
  - `buildWebhookPayload(checkpoint: CheckpointFile, event: string, startedAt: number): WebhookPayload` -- helper to construct payload from checkpoint data
- Run `npm run build`

### 5. Live Progress Module

- **Task ID**: build-live-progress
- **Depends On**: none
- **Assigned To**: builder-features
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 1-4)
- Create `src/lib/live-progress.ts`:
  - `startLiveProgress(checkpointPath: string, interval?: number): { stop: () => void }` -- starts a setInterval that reads checkpoint file every `interval` ms (default 5000), clears terminal and redraws progress
  - `renderProgress(checkpoint: CheckpointFile): string` -- returns a multi-line string with:
    - Plan name and status
    - Progress bar: [=====> ] 3/7 (42%)
    - Per-task status lines with icons (done/running/pending/blocked/failed)
    - Elapsed time
    - Token usage if available
  - The stop() function clears the interval and does a final render
  - Uses `process.stdout.write()` with ANSI clear codes: `\x1b[2J\x1b[H` to clear and move cursor to top
  - Handles the checkpoint file not existing yet (show "Waiting for build to start...")
  - Handles checkpoint file being mid-write (catch JSON parse errors, retry on next tick)
- Run `npm run build`

### 6. Integrate Features into Build Commands

- **Task ID**: integrate-commands
- **Depends On**: harden-checkpoint, fix-subprocess, token-restore, build-notifications, build-live-progress
- **Assigned To**: builder-features
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all modified/new files in src/lib/ to understand available APIs
- Update `src/commands/build.ts`:
  - Import notifications module and live-progress module
  - On build start: send build_start notification if webhooks configured
  - On build complete/fail: send build_complete or build_fail notification
  - If --resume and checkpoint has token_usage: restore TokenTracker via `TokenTracker.fromCheckpoint()`
  - Add --live flag handling: if set, start live progress poller before invoking Claude, stop after completion
- Update `src/commands/team-build.ts`:
  - Same notification and live-progress integration as build.ts
  - Same token restore on --resume
- Update `src/index.ts`:
  - Add `--live` option to both build and team-build commands: `.option("--live", "Show real-time progress")`
- Update `src/types.ts` with new types (WebhookPayload, NotificationConfig) if not already added in task 4
- Run `npm run build` and verify all commands still work with `node bin/kova.js --help`

### 7. Write Phase 2 Unit Tests

- **Task ID**: write-phase2-unit-tests
- **Depends On**: integrate-commands
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all new/modified source files
- Write `tests/notifications.test.ts`:
  - Test buildWebhookPayload() constructs correct payload
  - Test sendDiscord() formats Discord embed correctly (mock fetch)
  - Test sendSlack() formats Slack blocks correctly (mock fetch)
  - Test sendCustom() sends raw JSON (mock fetch)
  - Test sendNotification() calls all configured webhooks
  - Test sendNotification() skips null webhook URLs
  - Test webhook failure does NOT throw (mock fetch to reject)
  - Test webhook timeout does NOT throw
- Write `tests/live-progress.test.ts`:
  - Test renderProgress() with empty checkpoint
  - Test renderProgress() with mixed task statuses
  - Test renderProgress() with token usage data
  - Test renderProgress() produces correct progress bar math
  - Test startLiveProgress() and stop() clean up interval (use fake timers)
  - Test handleing of missing checkpoint file
  - Test handling of malformed JSON in checkpoint (graceful recovery)
- Write `tests/checkpoint-windows.test.ts`:
  - Test writeCheckpoint() overwrites existing file successfully
  - Test writeCheckpoint() with concurrent reads (write, read immediately, verify no corruption)
  - Test persistTokenUsage() updates token data in existing checkpoint
  - Test atomic write leaves no .tmp files behind
- Run `npm test` -- ALL tests must pass (old 92 + new)

### 8. Write Phase 2 Integration Tests

- **Task ID**: write-phase2-integration-tests
- **Depends On**: write-phase2-unit-tests
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Write `tests/resume-flow.test.ts`:
  - Test full resume workflow:
    1. Create checkpoint with 3/7 tasks completed + token usage
    2. Call TokenTracker.fromCheckpoint() with the token data
    3. Verify tracker has correct accumulated totals
    4. Add more task usage
    5. Verify totals include both old and new usage
    6. Serialize back to checkpoint, verify all data preserved
  - Test resume with no token_usage in checkpoint (should start fresh tracker)
  - Test resume with corrupted checkpoint (should fall back to fresh)
- Write `tests/build-integration.test.ts`:
  - Test build --dry-run with a mock plan file
  - Test build with --resume flag and existing checkpoint
  - Test build with --live flag (verify it doesn't crash, doesn't need actual Claude)
  - Test notification payload construction from real checkpoint data
- Run `npm test` -- ALL tests must pass
- Run `npm run build` -- must compile clean

### 9. Final Validation

- **Task ID**: validate-all
- **Depends On**: harden-checkpoint, fix-subprocess, token-restore, build-notifications, build-live-progress, integrate-commands, write-phase2-unit-tests, write-phase2-integration-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check cross-platform patterns in all modified files:
  - No hardcoded path separators (`/` or `\\`) in file operations
  - All glob patterns normalized to forward slashes
  - subprocess uses shell:true on Windows
  - Atomic writes handle Windows rename semantics
- Verify no TypeScript `any` types in new code
- Verify all error messages are actionable
- Run `npm test` twice to verify no flaky tests
- Run `npm run build` and `npm pack --dry-run` to verify package integrity
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. All 92 existing Phase 1 tests continue to pass (zero regressions)
2. `npm run build` produces clean compilation with no errors
3. 30+ new tests added, all passing
4. `writeCheckpoint()` handles Windows rename-over-existing (unlink before rename)
5. `invokeClaude()` works on Windows with shell:true for .cmd resolution
6. `TokenTracker.fromCheckpoint()` correctly restores accumulated token state
7. Webhook notifications send to Discord, Slack, and custom URLs
8. Webhook failures are logged as warnings, never crash the build
9. `--live` flag on build command starts progress polling
10. Live progress handles missing or mid-write checkpoint files gracefully
11. `--resume` restores token tracking state from checkpoint
12. No TypeScript `any` types in new or modified code
13. All file paths use `path.join()` (no hardcoded separators)
14. `npm pack --dry-run` succeeds with correct file list
15. No flaky tests (run suite twice, same results)

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-cli && npm run build` -- Verify clean compilation
- `npm run lint` -- Verify no TypeScript errors (tsc --noEmit)
- `npm test` -- Run full test suite (should be 120+ tests, 0 failures)
- `npm test` -- Run again to verify no flaky tests
- `node bin/kova.js --version` -- Still outputs 0.1.0
- `node bin/kova.js --help` -- Still lists all commands
- `node bin/kova.js build --help` -- Shows --live flag
- `node bin/kova.js team-build --help` -- Shows --live flag
- `npm pack --dry-run` -- Verify package contents

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is C:/PROJ/kova-cli/
- Do NOT break any existing functionality. All 92 Phase 1 tests must pass.
- For webhook testing, mock the global fetch function. Do NOT make real HTTP requests in tests.
- For live progress testing, use Vitest's fake timers (vi.useFakeTimers) to control setInterval.
- Windows atomic write fix: the pattern is `try { unlinkSync(dest) } catch(e) { if (e.code !== 'ENOENT') throw e } finally { renameSync(tmp, dest) }` -- this handles both "file exists" and "file doesn't exist" cases.
- The subprocess Windows fix uses execa's `shell` option: `shell: process.platform === 'win32'`

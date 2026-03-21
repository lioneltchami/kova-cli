# Plan: Kova v2.0 Post-Build Polish

## Task Description

Apply short-term fixes and medium-term enhancements to the Kova CLI v2.0 orchestrator that was just built. This includes version bump, display name fixes, chat session cost tracking, routing config commands, and archival of the completed plan.

## Objective

When complete:

1. Version is 2.0.0 everywhere (package.json, constants.ts)
2. `kova models` shows "Claude Haiku 4.5" not "Claude Haiku 4 5"
3. `kova chat` supports `/cost` to show running session total
4. `kova config set routing.simple openai:gpt-4.1-nano` works to customize model routing
5. All tests pass including new tests for the changes
6. Completed v2 orchestrator plan is archived

## Relevant Files

### Existing files to modify

- `src/lib/ai/model-router.ts` -- Fix `getModelDisplayName()` to handle version dots
- `src/commands/chat.ts` -- Add `/cost` slash command showing running session cost
- `src/commands/config-cmd.ts` -- Add `routing.simple`, `routing.moderate`, `routing.complex` to `buildPartialConfig`
- `src/lib/constants.ts` -- Bump VERSION from "1.0.0" to "2.0.0"
- `package.json` -- Bump version from "1.0.0" to "2.0.0"
- `tests/lib/ai/model-router.test.ts` -- Add tests for display name fix
- `tests/commands/chat.test.ts` -- Add test for /cost command
- `tests/commands/config-cmd.test.ts` -- Add tests for routing config if file exists, else create

## Implementation Phases

### Phase 1: Quick Fixes

- Archive completed plan file
- Version bump 1.0.0 -> 2.0.0
- Fix getModelDisplayName to preserve dots in version numbers

### Phase 2: Feature Enhancements

- Add /cost command to chat REPL
- Add routing config keys to config-cmd.ts

### Phase 3: Tests & Validation

- Update/add tests
- Build, typecheck, run all tests

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members.

### Team Members

- Specialist
  - Name: polish-engineer
  - Role: Apply all code changes (version bump, display name fix, /cost command, routing config)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: test-writer
  - Role: Write and fix tests for all changes
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Archive Completed Plan and Version Bump

- **Task ID**: archive-and-version
- **Depends On**: none
- **Assigned To**: polish-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Move `.claude/tasks/kova-v2-orchestrator-model-routing.md` to `.claude/tasks/archive/kova-v2-orchestrator-model-routing.md`
- Update `VERSION` in `src/lib/constants.ts` from `"1.0.0"` to `"2.0.0"`
- Update `"version"` in `package.json` from `"1.0.0"` to `"2.0.0"`

### 2. Fix Model Display Name

- **Task ID**: fix-display-name
- **Depends On**: none
- **Assigned To**: polish-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Fix `getModelDisplayName()` in `src/lib/ai/model-router.ts`. The current logic replaces ALL dashes with spaces, turning "claude-haiku-4-5-20251001" into "Claude Haiku 4 5". It should produce "Claude Haiku 4.5".

Replace the function with:

```typescript
export function getModelDisplayName(sdkModelId: string): string {
  const parts = sdkModelId.split(":");
  const modelPart = parts[1] ?? parts[0] ?? sdkModelId;
  return modelPart
    .replace(/-\d{8}$/, "") // strip date suffix like -20250514
    .replace(/-(\d+)-(\d+)$/, " $1.$2") // "haiku-4-5" -> "haiku 4.5"
    .replace(/-(\d+)$/, " $1") // "sonnet-4" -> "sonnet 4"
    .replace(/-/g, " ") // remaining dashes to spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}
```

Test cases to verify:

- `"anthropic:claude-haiku-4-5-20251001"` -> `"Claude Haiku 4.5"`
- `"anthropic:claude-sonnet-4-20250514"` -> `"Claude Sonnet 4"`
- `"anthropic:claude-opus-4-20250115"` -> `"Claude Opus 4"`
- `"gpt-4.1-nano"` -> `"Gpt 4.1 Nano"` (dots already preserved since they're not dashes)
- `"gemini-2.5-flash"` -> `"Gemini 2.5 Flash"`

### 3. Add /cost Command to Chat

- **Task ID**: chat-cost-command
- **Depends On**: none
- **Assigned To**: polish-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

In `src/commands/chat.ts`, add a running session cost tracker and `/cost` slash command:

1. Add a `sessionCostUsd` variable initialized to 0 after the `sessionId` declaration
2. After each `recordAiUsage` call, add `sessionCostUsd += record.cost_usd;`
3. Add handler for `/cost` command in the line handler:

```typescript
if (input === "/cost") {
  logger.info(`Session cost: ${colors.brand("$" + sessionCostUsd.toFixed(4))}`);
  logger.info(`Turns: ${Math.floor(messages.length / 2)}`);
  rl.prompt();
  return;
}
```

4. Update the help text to include `/cost`:

```typescript
logger.info(
  "Type 'exit' or Ctrl+C to quit. '/model <id>' to switch. '/clear' to reset. '/cost' for session total.",
);
```

5. On session close, show the final session cost:

```typescript
rl.on("close", () => {
  if (sessionCostUsd > 0) {
    logger.info(
      `Total session cost: ${colors.brand("$" + sessionCostUsd.toFixed(4))}`,
    );
  }
  logger.success("Chat session ended.");
});
```

### 4. Add Routing Config Keys

- **Task ID**: routing-config
- **Depends On**: none
- **Assigned To**: polish-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

In `src/commands/config-cmd.ts`:

1. Import `OrchestrationConfig` from types and `KovaFinOpsConfigExtended` from config-store
2. Change `buildPartialConfig` return type to `Partial<KovaFinOpsConfigExtended> | null` (since orchestration is on the extended type)
3. Add three new cases to the switch in `buildPartialConfig`:

```typescript
case "routing.simple":
  return { orchestration: { routing: { simple: value } } } as any;
case "routing.moderate":
  return { orchestration: { routing: { moderate: value } } } as any;
case "routing.complex":
  return { orchestration: { routing: { complex: value } } } as any;
```

4. Update `updateConfig` in config-store.ts to deep-merge the orchestration.routing sub-object (currently it replaces the whole orchestration object). Add this to the merge logic:

```typescript
orchestration:
  partial.orchestration !== undefined
    ? {
        ...current.orchestration,
        ...partial.orchestration,
        routing: {
          ...(current.orchestration?.routing ?? {}),
          ...(partial.orchestration?.routing ?? {}),
        },
      }
    : current.orchestration,
```

5. Update the help text in configCommand to include routing keys:

```
"                routing.simple, routing.moderate, routing.complex"
```

### 5. Update and Add Tests

- **Task ID**: update-tests
- **Depends On**: fix-display-name, chat-cost-command, routing-config
- **Assigned To**: test-writer
- **Agent Type**: quality-engineer
- **Parallel**: false

Update existing tests and add new ones:

- **model-router.test.ts**: Update getModelDisplayName tests to verify:
  - `"anthropic:claude-haiku-4-5-20251001"` -> `"Claude Haiku 4.5"`
  - `"anthropic:claude-sonnet-4-20250514"` -> `"Claude Sonnet 4"`
  - `"anthropic:claude-opus-4-20250115"` -> `"Claude Opus 4"`

- **chat.test.ts**: Add test for /cost command handling

- **config-cmd tests**: Add tests for routing.simple, routing.moderate, routing.complex config keys

Run `npm test` after and fix any failures.

### 6. Final Validation

- **Task ID**: validate-all
- **Depends On**: update-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `npx tsc --noEmit` -- zero errors
- Run `npm run build` -- success
- Run `npm test` -- all tests pass
- Run `node dist/index.js --version` -- outputs "2.0.0"
- Run `node dist/index.js models` -- verify "Claude Haiku 4.5" not "Claude Haiku 4 5"
- Run `node dist/index.js run --dry-run "fix typo"` -- verify display name format
- Verify `.claude/tasks/archive/kova-v2-orchestrator-model-routing.md` exists
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. `node dist/index.js --version` outputs "2.0.0"
2. `kova models` shows "Claude Haiku 4.5", "Claude Sonnet 4", "Claude Opus 4" (not "Claude Haiku 4 5")
3. `kova chat` supports `/cost` command showing running session total and turn count
4. `kova chat` shows total session cost on exit
5. `kova config set routing.simple openai:gpt-4.1-nano` updates routing config
6. All tests pass (665+ existing, new tests for changes)
7. Build succeeds, zero type errors
8. Completed orchestrator plan is in `.claude/tasks/archive/`

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

# Display names
node dist/index.js models

# Dry run display
node dist/index.js run --dry-run "fix typo"

# Archive exists
ls .claude/tasks/archive/kova-v2-orchestrator-model-routing.md
```

## Notes

- The `buildPartialConfig` function currently returns `Partial<KovaFinOpsConfig>` but routing config lives on `KovaFinOpsConfigExtended` via the `orchestration` field. The cleanest approach is to use the extended type or cast as needed.
- The `updateConfig` deep merge for orchestration.routing needs care -- we want to update individual routing keys without wiping the other keys.
- The display name regex for version numbers needs to handle both "4-5" (two-part like Haiku 4.5) and single "4" (like Sonnet 4, Opus 4).

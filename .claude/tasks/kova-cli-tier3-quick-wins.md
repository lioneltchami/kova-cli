# Plan: Kova CLI Tier 3 - Quick Wins

## Task Description

Add three quick-win features to the Kova CLI: (1) a combined `kova run` command that chains plan + approve + build in one step, (2) plan templates for 6 common patterns (feature, bugfix, refactor, migration, security, performance), and (3) a `kova update` command that updates scaffolded .claude/ templates from the latest package version while preserving local modifications.

## Objective

Deliver 3 new CLI features that reduce friction: `kova run` (3 commands to 1), `--template` flag on plan (structured guidance for common patterns), and `kova update` (keep templates current without re-init). All 156 existing tests must continue to pass with 20+ new tests added.

## Problem Statement

Users currently need 3 separate commands to go from idea to code (plan, review, build). Common plan patterns (feature, bugfix, refactor) require users to craft prompts from scratch every time. When Kova ships improved templates, users have no way to update without running `kova init --force` and losing customizations.

## Solution Approach

1. **`kova run`**: New command that calls `planCommand()` internally with `autoBuild: true`, but first shows a plan summary and asks Y/n (unless `--auto` is passed). Reuses all existing plan and build flags.

2. **Plan templates**: 6 markdown template files stored in `templates/plan-templates/`. Each contains a structured prompt prefix with recommended phases, agents, and acceptance criteria patterns. The `--template` flag prepends this context to the user's prompt before passing to Claude.

3. **`kova update`**: Compares package templates (from npm install) with scaffolded `.claude/` files using content hashing (crypto.createHash). Shows diff summary, applies updates for unmodified files, skips locally modified files (with warning). `--force` overwrites everything.

## Relevant Files

### Existing Files to Modify

- `src/index.ts` -- Register `run` and `update` commands, add `--template` flag to plan
- `src/commands/plan.ts` -- Add template loading and prompt prepending logic; update PlanOptions with `template` field
- `src/lib/constants.ts` -- Add PLAN_TEMPLATES list constant
- `src/lib/scaffold.ts` -- Add `getTemplatesDir()` (already exported, reused by update)

### New Files to Create

- `src/commands/run.ts` -- Combined plan+build command
- `src/commands/update.ts` -- Template update command
- `src/lib/plan-templates.ts` -- Template loading and prompt construction
- `templates/plan-templates/feature.md` -- Feature template
- `templates/plan-templates/bugfix.md` -- Bugfix template
- `templates/plan-templates/refactor.md` -- Refactor template
- `templates/plan-templates/migration.md` -- Migration template
- `templates/plan-templates/security.md` -- Security template
- `templates/plan-templates/performance.md` -- Performance template
- `tests/plan-templates.test.ts` -- Unit tests for template loading
- `tests/update.test.ts` -- Unit tests for update command logic
- `tests/run.integration.test.ts` -- Integration test for run workflow

## Implementation Phases

### Phase 1: Foundation

Create plan template files and the template loading library module.

### Phase 2: Core Implementation

Build the `run` command, `update` command, and integrate `--template` into the plan command.

### Phase 3: Integration & Polish

Write tests, register all commands in index.ts, verify full build and test suite.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-templates
  - Role: Create the 6 plan template markdown files and the plan-templates.ts library module
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-commands
  - Role: Build the run.ts and update.ts commands, integrate --template into plan.ts, update index.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write all unit and integration tests for Tier 3 features
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

### 1. Create Plan Template Files

- **Task ID**: create-plan-templates
- **Depends On**: none
- **Assigned To**: builder-templates
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Create directory `C:/PROJ/kova-cli/templates/plan-templates/`
- Create 6 template files. Each template is a markdown document that provides structured context to guide Claude's /team-plan output. The template content gets prepended to the user's prompt.

**templates/plan-templates/feature.md**:

```markdown
# Plan Template: Feature

You are planning a NEW FEATURE. Follow this structure:

## Recommended Phases

1. **Foundation**: Database schema, types, configuration changes
2. **Core Implementation**: Main feature logic, API endpoints, UI components
3. **Integration & Polish**: Wire everything together, error handling, edge cases

## Recommended Agents

- **backend-engineer**: API endpoints, server logic, data access
- **frontend-specialist**: UI components, forms, state management
- **supabase-specialist**: Database migrations, RLS policies (if database work needed)
- **quality-engineer**: Final validation against acceptance criteria

## Planning Guidance

- Break the feature into 5-10 atomic tasks
- Identify file dependencies between tasks
- Assign specialist agents based on the domain of each task
- Include acceptance criteria that can be verified programmatically
- Consider error handling, loading states, and edge cases

## User's Feature Request:
```

**templates/plan-templates/bugfix.md**:

```markdown
# Plan Template: Bug Fix

You are planning a BUG FIX. Follow this structure:

## Recommended Phases

1. **Investigation**: Reproduce the bug, identify root cause, trace code paths
2. **Fix & Validate**: Apply minimal fix, add regression test, verify fix

## Recommended Agents

- **debugger-detective**: Root cause analysis, systematic debugging
- **quality-engineer**: Write regression test, validate fix

## Planning Guidance

- Start with reproduction steps
- Identify the exact code path causing the bug
- Apply the MINIMAL fix (don't refactor surrounding code)
- Add a test that would have caught this bug
- Verify the fix doesn't break related functionality

## Bug Description:
```

**templates/plan-templates/refactor.md**:

```markdown
# Plan Template: Refactor

You are planning a CODE REFACTOR. Follow this structure:

## Recommended Phases

1. **Analysis**: Identify all usages, establish test baseline, map dependencies
2. **Refactor**: Apply changes incrementally, run tests after each step
3. **Validate**: Run full test suite, verify no regressions, update documentation

## Recommended Agents

- **code-simplifier**: Code simplification, DRY improvements, clarity
- **quality-engineer**: Validate no regressions, verify test coverage

## Planning Guidance

- Run tests BEFORE refactoring to establish baseline
- Identify ALL consumers of code being refactored
- Make changes incrementally (one file at a time when possible)
- Run tests after EACH incremental change
- For breaking interface changes: add new interface alongside old, migrate consumers, then remove old

## Refactor Description:
```

**templates/plan-templates/migration.md**:

```markdown
# Plan Template: Database Migration

You are planning a DATABASE MIGRATION. Follow this structure:

## Recommended Phases

1. **Schema Design**: Design new schema, write migration SQL, plan data transformation
2. **Data Migration**: Transform and migrate existing data, handle edge cases
3. **Cleanup & Validate**: Remove old columns/tables, update application code, verify data integrity

## Recommended Agents

- **supabase-specialist**: Migration SQL, schema design, RLS policies
- **backend-engineer**: Update application code, data access layer
- **quality-engineer**: Verify data integrity, test migration rollback

## Planning Guidance

- NEVER modify existing migration files
- Create new migration file with `supabase migration new <name>`
- Consider rollback strategy (how to undo this migration)
- Test with production-like data volume
- Update TypeScript types to match new schema
- Update all service layer queries that reference changed tables

## Migration Description:
```

**templates/plan-templates/security.md**:

```markdown
# Plan Template: Security Hardening

You are planning SECURITY WORK. Follow this structure:

## Recommended Phases

1. **Audit**: Identify vulnerabilities, review auth flows, check RLS policies
2. **Remediate**: Apply fixes for each finding, update security configurations

## Recommended Agents

- **security-auditor**: Vulnerability assessment, OWASP compliance, threat modeling
- **quality-engineer**: Verify fixes, ensure no regressions

## Planning Guidance

- Check OWASP Top 10 categories relevant to this work
- Verify authentication AND authorization at every endpoint
- Validate all user inputs at system boundaries
- Use parameterized queries (never string interpolation for SQL)
- Review RLS policies for data isolation
- Check for sensitive data exposure (API responses, logs, error messages)
- Consider both authenticated and unauthenticated attack vectors

## Security Task Description:
```

**templates/plan-templates/performance.md**:

```markdown
# Plan Template: Performance Optimization

You are planning a PERFORMANCE OPTIMIZATION. Follow this structure:

## Recommended Phases

1. **Profile**: Measure current performance, identify bottlenecks, establish baselines
2. **Optimize**: Apply targeted optimizations, measure improvements after each change

## Recommended Agents

- **performance-optimizer**: Profiling, bottleneck analysis, optimization implementation
- **quality-engineer**: Verify optimizations don't break functionality, measure improvements

## Planning Guidance

- MEASURE before optimizing (establish baseline metrics)
- Identify the specific bottleneck before writing code
- Apply ONE optimization at a time and measure the impact
- Focus on the critical path (what users actually experience)
- Consider: database queries, bundle size, rendering, network requests, caching
- Document before/after metrics in the plan

## Performance Task Description:
```

- Verify all 6 files exist and are readable

### 2. Build Plan Templates Library Module

- **Task ID**: build-templates-lib
- **Depends On**: create-plan-templates
- **Assigned To**: builder-templates
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/lib/scaffold.ts` to understand the `getTemplatesDir()` pattern
- Read `C:/PROJ/kova-cli/src/lib/constants.ts` for existing constants
- Add to `src/lib/constants.ts`:

  ```typescript
  export const PLAN_TEMPLATE_NAMES = [
    "feature",
    "bugfix",
    "refactor",
    "migration",
    "security",
    "performance",
  ] as const;

  export type PlanTemplateName = (typeof PLAN_TEMPLATE_NAMES)[number];
  ```

- Create `src/lib/plan-templates.ts`:

  ```typescript
  import fs from "fs";
  import path from "path";
  import { getTemplatesDir } from "./scaffold.js";
  import { PLAN_TEMPLATE_NAMES } from "./constants.js";
  import type { PlanTemplateName } from "./constants.js";

  export function isValidTemplate(name: string): name is PlanTemplateName {
    return (PLAN_TEMPLATE_NAMES as readonly string[]).includes(name);
  }

  export function loadPlanTemplate(templateName: PlanTemplateName): string {
    const templatesDir = getTemplatesDir();
    const templatePath = path.join(
      templatesDir,
      "plan-templates",
      `${templateName}.md`,
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Plan template not found: ${templateName}. Available: ${PLAN_TEMPLATE_NAMES.join(", ")}`,
      );
    }

    return fs.readFileSync(templatePath, "utf-8");
  }

  export function buildTemplatedPrompt(
    templateName: PlanTemplateName,
    userPrompt: string,
  ): string {
    const template = loadPlanTemplate(templateName);
    return `${template}\n${userPrompt}`;
  }

  export function listTemplates(): Array<{
    name: string;
    description: string;
  }> {
    return [
      {
        name: "feature",
        description:
          "New feature development (3 phases: Foundation, Core, Polish)",
      },
      {
        name: "bugfix",
        description: "Bug investigation and fix (2 phases: Investigate, Fix)",
      },
      {
        name: "refactor",
        description:
          "Code improvement and cleanup (3 phases: Analyze, Refactor, Validate)",
      },
      {
        name: "migration",
        description:
          "Database schema migration (3 phases: Schema, Data, Cleanup)",
      },
      {
        name: "security",
        description:
          "Security audit and hardening (2 phases: Audit, Remediate)",
      },
      {
        name: "performance",
        description:
          "Performance profiling and optimization (2 phases: Profile, Optimize)",
      },
    ];
  }
  ```

- Run `npm run build` to verify compilation

### 3. Integrate --template into Plan Command

- **Task ID**: integrate-template-flag
- **Depends On**: build-templates-lib
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/commands/plan.ts` for current implementation
- Read `C:/PROJ/kova-cli/src/lib/plan-templates.ts` for available APIs
- Update `PlanOptions` interface to include `template?: string`
- In `planCommand()`, after validating the prompt:
  - If `options.template` is set, validate it with `isValidTemplate()`
  - If invalid, show error with list of available templates
  - If valid, call `buildTemplatedPrompt(template, prompt)` to get enhanced prompt
  - Pass the enhanced prompt to `invokeClaude()` instead of the raw prompt
  - Log which template is being used
- Update `src/index.ts` to add `--template <name>` option to the plan command:
  ```typescript
  .option("-t, --template <name>", "Use a plan template (feature, bugfix, refactor, migration, security, performance)")
  ```
- Run `npm run build` and verify `node bin/kova.js plan --help` shows --template flag

### 4. Build `kova run` Command

- **Task ID**: build-run-command
- **Depends On**: integrate-template-flag
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/commands/plan.ts` and `C:/PROJ/kova-cli/src/commands/build.ts`
- Create `src/commands/run.ts`:

  ```typescript
  import * as logger from "../lib/logger.js";
  import { planCommand } from "./plan.js";

  export interface RunOptions {
    model?: string;
    template?: string;
    auto?: boolean;
    live?: boolean;
    resume?: boolean;
    parallel?: number;
    modelOverride?: string;
    verbose?: boolean;
    validate?: boolean;
  }

  export async function runCommand(
    prompt: string,
    options: RunOptions,
  ): Promise<void> {
    if (!prompt || prompt.trim() === "") {
      logger.error(
        'Please provide a prompt. Example: kova run "add user profiles"',
      );
      process.exit(1);
    }

    logger.banner();

    // The plan command with autoBuild: true will automatically chain to build
    // If --auto is NOT set, planCommand shows the summary and we call build manually
    await planCommand(prompt, {
      model: options.model,
      template: options.template,
      autoBuild: options.auto ?? true, // Default to auto-build in run mode
      output: undefined,
    });
  }
  ```

  Note: `planCommand` with `autoBuild: true` already calls `buildCommand()` internally. So `kova run` just needs to call `planCommand` with the right options. The key difference from `kova plan` is that autoBuild defaults to true.

  If `--auto` is false (user passes `--no-auto`), set `autoBuild: false` so the user gets the review step.

- Register in `src/index.ts`:
  ```typescript
  // Run command (plan + build combined)
  program
    .command("run [prompt...]")
    .description("Plan and build in one step")
    .option("--model <model>", "Override planning model")
    .option("-t, --template <name>", "Use a plan template")
    .option("--no-auto", "Pause for approval before building")
    .option("--live", "Show real-time build progress")
    .option("--resume", "Resume from checkpoint")
    .option("--verbose", "Show agent output in real-time")
    .action(async (promptParts, options) => {
      const { runCommand } = await import("./commands/run.js");
      const prompt = promptParts.join(" ");
      await runCommand(prompt, options);
    });
  ```
- Run `npm run build` and verify `node bin/kova.js run --help` shows all flags

### 5. Build `kova update` Command

- **Task ID**: build-update-command
- **Depends On**: none
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 1-4)
- Read `C:/PROJ/kova-cli/src/lib/scaffold.ts` for `getTemplatesDir()` and `TEMPLATE_FILES`
- Read `C:/PROJ/kova-cli/src/lib/constants.ts` for `TEMPLATE_FILES`
- Create `src/commands/update.ts`:

  ```typescript
  import crypto from "crypto";
  import fs from "fs";
  import path from "path";
  import { CLAUDE_DIR, TEMPLATE_FILES } from "../lib/constants.js";
  import * as logger from "../lib/logger.js";
  import { getTemplatesDir } from "../lib/scaffold.js";

  export interface UpdateOptions {
    force?: boolean;
  }

  function fileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf-8");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  interface UpdateResult {
    updated: string[];
    skipped: string[];
    unchanged: string[];
    missing: string[];
  }

  export function checkForUpdates(projectDir: string): UpdateResult {
    const templatesDir = getTemplatesDir();
    const claudeDir = path.join(projectDir, CLAUDE_DIR);

    const result: UpdateResult = {
      updated: [],
      skipped: [],
      unchanged: [],
      missing: [],
    };

    for (const templateFile of TEMPLATE_FILES) {
      const srcPath = path.join(templatesDir, templateFile);
      const destPath = path.join(claudeDir, templateFile);

      if (!fs.existsSync(srcPath)) {
        // Package template missing (shouldn't happen but handle gracefully)
        continue;
      }

      if (!fs.existsSync(destPath)) {
        result.missing.push(templateFile);
        continue;
      }

      const srcHash = fileHash(srcPath);
      const destHash = fileHash(destPath);

      if (srcHash === destHash) {
        result.unchanged.push(templateFile);
      } else {
        // File differs -- either package updated or user modified locally
        // We need to check if the user modified it vs the package changed
        // Since we don't track original hashes, any difference = needs update
        result.updated.push(templateFile);
      }
    }

    return result;
  }

  export function applyUpdates(
    projectDir: string,
    result: UpdateResult,
    force: boolean,
  ): { applied: string[]; skippedLocal: string[] } {
    const templatesDir = getTemplatesDir();
    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    const applied: string[] = [];
    const skippedLocal: string[] = [];

    // Apply missing files (always safe to add)
    for (const templateFile of result.missing) {
      const srcPath = path.join(templatesDir, templateFile);
      const destPath = path.join(claudeDir, templateFile);
      const destDir = path.dirname(destPath);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      applied.push(templateFile);
    }

    // Apply changed files (only if --force, otherwise skip with warning)
    for (const templateFile of result.updated) {
      if (force) {
        const srcPath = path.join(templatesDir, templateFile);
        const destPath = path.join(claudeDir, templateFile);
        fs.copyFileSync(srcPath, destPath);
        applied.push(templateFile);
      } else {
        skippedLocal.push(templateFile);
      }
    }

    return { applied, skippedLocal };
  }

  export async function updateCommand(options: UpdateOptions): Promise<void> {
    const projectDir = process.cwd();
    const claudeDir = path.join(projectDir, CLAUDE_DIR);

    if (!fs.existsSync(claudeDir)) {
      logger.error("No .claude/ directory found. Run 'kova init' first.");
      process.exit(1);
    }

    logger.info("Checking for template updates...");
    console.log();

    const result = checkForUpdates(projectDir);

    // Display summary
    if (result.missing.length > 0) {
      logger.info(`New templates available: ${result.missing.length}`);
      for (const f of result.missing) {
        logger.success(`  + ${f}`);
      }
    }

    if (result.updated.length > 0) {
      logger.info(`Changed templates: ${result.updated.length}`);
      for (const f of result.updated) {
        logger.warn(`  ~ ${f}`);
      }
    }

    if (result.unchanged.length > 0) {
      logger.info(`Unchanged: ${result.unchanged.length} files`);
    }

    if (result.missing.length === 0 && result.updated.length === 0) {
      logger.success("All templates are up to date.");
      return;
    }

    // Apply updates
    console.log();
    const { applied, skippedLocal } = applyUpdates(
      projectDir,
      result,
      !!options.force,
    );

    if (applied.length > 0) {
      logger.success(`Updated ${applied.length} file(s):`);
      for (const f of applied) {
        logger.info(`  ${f}`);
      }
    }

    if (skippedLocal.length > 0) {
      console.log();
      logger.warn(`Skipped ${skippedLocal.length} locally modified file(s):`);
      for (const f of skippedLocal) {
        logger.warn(`  ${f}`);
      }
      logger.info(
        "Use 'kova update --force' to overwrite local modifications.",
      );
    }
  }
  ```

- Register in `src/index.ts`:
  ```typescript
  // Update command
  program
    .command("update")
    .description("Update scaffolded templates from latest package version")
    .option("-f, --force", "Overwrite locally modified files")
    .action(async (options) => {
      const { updateCommand } = await import("./commands/update.js");
      await updateCommand(options);
    });
  ```
- Run `npm run build` and verify `node bin/kova.js update --help` shows --force flag

### 6. Wire All Commands and Verify

- **Task ID**: wire-and-verify
- **Depends On**: integrate-template-flag, build-run-command, build-update-command
- **Assigned To**: builder-commands
- **Agent Type**: backend-engineer
- **Model**: haiku
- **Parallel**: false
- Run `cd C:/PROJ/kova-cli && npm run build`
- Verify all commands with --help:
  - `node bin/kova.js --help` (should now show run and update commands)
  - `node bin/kova.js run --help`
  - `node bin/kova.js update --help`
  - `node bin/kova.js plan --help` (should show --template flag)
- Run `npm test` to verify all 156 existing tests still pass
- Report results

### 7. Write Tier 3 Tests

- **Task ID**: write-tier3-tests
- **Depends On**: wire-and-verify
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all new source files to understand APIs
- Write `tests/plan-templates.test.ts`:
  - Test `isValidTemplate("feature")` returns true
  - Test `isValidTemplate("invalid")` returns false
  - Test `loadPlanTemplate("feature")` returns non-empty string containing "Feature"
  - Test `loadPlanTemplate("bugfix")` returns content containing "Bug Fix"
  - Test all 6 templates load successfully
  - Test `loadPlanTemplate("nonexistent")` throws
  - Test `buildTemplatedPrompt("feature", "add profiles")` returns string starting with template content and ending with user prompt
  - Test `listTemplates()` returns 6 entries with name and description
- Write `tests/update.test.ts`:
  - Test `checkForUpdates()` detects unchanged files (scaffold, then check = all unchanged)
  - Test `checkForUpdates()` detects missing files (scaffold subset, check for missing)
  - Test `checkForUpdates()` detects changed files (scaffold, modify one, check)
  - Test `applyUpdates()` adds missing files
  - Test `applyUpdates()` skips changed files without --force
  - Test `applyUpdates()` overwrites changed files with --force
  - Test `updateCommand()` on up-to-date project shows "up to date" message
  - Use temp directories for all tests
- Write `tests/run.integration.test.ts`:
  - Test run command validates empty prompt (reuse pattern from plan tests)
  - Test template integration: verify `buildTemplatedPrompt` correctly prepends template to prompt for all 6 templates
  - Test that `listTemplates()` returns entries matching PLAN_TEMPLATE_NAMES constant
- Run `npm test` -- ALL tests must pass (156 existing + new)

### 8. Final Validation

- **Task ID**: validate-all
- **Depends On**: create-plan-templates, build-templates-lib, integrate-template-flag, build-run-command, build-update-command, wire-and-verify, write-tier3-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check:
  - All 156 Phase 1+2 tests still pass
  - 20+ new tests added and passing
  - `kova run --help` shows all flags
  - `kova update --help` shows --force flag
  - `kova plan --help` shows --template flag
  - All 6 plan template files exist in templates/plan-templates/
  - No TypeScript `any` types in new code
  - `npm pack --dry-run` includes new template files
  - `npm run build` compiles cleanly
- Run `npm test` twice to verify no flaky tests
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. All 156 existing tests continue to pass (zero regressions)
2. `npm run build` compiles cleanly
3. 20+ new tests added, all passing
4. `kova run "prompt"` invokes plan then build automatically
5. `kova run --no-auto "prompt"` pauses for approval
6. `kova plan --template feature "prompt"` prepends feature template to prompt
7. All 6 plan templates load without error (feature, bugfix, refactor, migration, security, performance)
8. Invalid template name shows error with list of available templates
9. `kova update` shows template update status (unchanged, changed, missing)
10. `kova update` skips locally modified files with warning
11. `kova update --force` overwrites locally modified files
12. `kova --help` lists run and update commands
13. No TypeScript `any` types in new code
14. `npm pack --dry-run` includes templates/plan-templates/ files
15. No flaky tests (run suite twice, same results)

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-cli && npm run build` -- Verify clean compilation
- `npm run lint` -- Verify no TypeScript errors
- `npm test` -- Run full test suite (should be 175+ tests, 0 failures)
- `npm test` -- Run again to verify no flaky tests
- `node bin/kova.js --version` -- Still outputs 0.1.0
- `node bin/kova.js --help` -- Lists run and update commands
- `node bin/kova.js run --help` -- Shows all flags (model, template, no-auto, live, resume, verbose)
- `node bin/kova.js plan --help` -- Shows --template flag
- `node bin/kova.js update --help` -- Shows --force flag
- `npm pack --dry-run` -- Verify package includes templates/plan-templates/

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is C:/PROJ/kova-cli/
- Do NOT break any existing functionality. All 156 Phase 1+2 tests must pass.
- The `kova run` command reuses planCommand() and buildCommand() internally -- no duplication.
- Plan templates are static markdown files, not dynamically generated.
- The update command uses SHA-256 content hashing to detect modified files.
- Template files in `templates/plan-templates/` must be included in the npm package via the `files` field in package.json (already includes `templates/`).

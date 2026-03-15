# Plan: Kova CLI Tier 2 - GitHub Integration

## Task Description

Add three GitHub integration features to the Kova CLI that complete the "plan to ship" workflow: (1) a `kova pr` command that auto-creates GitHub Pull Requests from the last build, (2) issue linking via `--issue` flag on plan/run commands that pulls GitHub issue context into plans, and (3) automatic branch management that creates feature branches when planning. These features use the `gh` CLI (GitHub's official CLI) and `git` commands via execa -- no new npm dependencies required.

## Objective

Deliver 3 GitHub integration features: `kova pr` (auto-PR from build with generated title/body), `--issue` flag (pull issue context into plan prompt), and auto-branch creation (feature branches from plan names). All 302 existing tests must continue to pass with 40+ new tests for Tier 2 features. The complete viral loop becomes: `kova run --issue 42 "fix login bug"` (creates branch, fetches issue, plans, builds) then `kova pr` (creates PR linking the issue).

## Problem Statement

After running `kova build`, developers must manually create git branches, write PR titles/bodies, and link issues. This is the #1 friction point in the "plan to ship" workflow. Ralphy already has GitHub integration. Without it, Kova loses users at the "ship code" step. The viral loop breaks because built code sits uncommitted on a local branch with no PR.

## Solution Approach

1. **`kova pr`**: New command backed by `src/lib/github.ts` module. Detects current branch, reads the most recent plan file, generates a PR title (plan name converted to Title Case) and body (objective, task list, agent summary, build status from checkpoint). Invokes `gh pr create` with generated content. Supports `--title`, `--body`, `--draft`, `--base` overrides.

2. **`--issue` flag**: Added to plan and run commands. Uses `gh issue view <number> --json title,body,labels` to fetch issue details. Injects issue title and body as additional context into the plan prompt (after template, before user prompt). Adds "Closes #N" to the plan. Graceful degradation if `gh` is not available.

3. **Auto-branch**: Before invoking Claude in the plan command, check if currently on main/master/develop. If so, create `feat/<plan-kebab-name>` branch. Skip if already on a feature branch. `--no-branch` flag to disable. `--branch <name>` flag on run for custom branch names.

**Key design decision**: All GitHub/git operations go through a single `src/lib/github.ts` module that wraps `gh` and `git` CLI calls via execa. This centralizes error handling, platform detection (Windows shell), and provides testable functions. No new npm dependencies.

## Relevant Files

### Existing Files to Modify

- `src/index.ts` -- Register `pr` command, add `--issue`, `--no-branch`, `--branch` flags to plan and run
- `src/commands/plan.ts` -- Add issue fetching and branch creation before Claude invocation; update PlanOptions with `issue` and `noBranch` fields
- `src/commands/run.ts` -- Pass `--issue` and `--branch` through to planCommand; update RunOptions
- `src/lib/completions.ts` -- Add `pr` command to registry, add `--issue` and `--no-branch` flags to plan/run

### New Files to Create

- `src/lib/github.ts` -- GitHub/git integration module (gh CLI wrapper, git branch operations, PR body generation)
- `src/commands/pr.ts` -- `kova pr` command implementation
- `tests/github.test.ts` -- Unit tests for github.ts module
- `tests/pr.test.ts` -- Unit tests for PR command logic
- `tests/github-integration.test.ts` -- Integration tests for issue linking, branch management, PR body generation

## Implementation Phases

### Phase 1: Foundation

Build the `src/lib/github.ts` module with all git/gh helper functions. This is the foundation that all three features depend on.

### Phase 2: Core Implementation

Build the `kova pr` command, integrate `--issue` into plan/run, add auto-branch to plan. Update index.ts and completions registry.

### Phase 3: Integration & Polish

Write comprehensive tests, verify cross-platform behavior (Windows shell for git/gh), run full test suite, validate.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-github-lib
  - Role: Build the src/lib/github.ts module with all git/gh helper functions
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-github-cmds
  - Role: Build the pr.ts command, integrate --issue and auto-branch into plan.ts and run.ts, update index.ts and completions.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-tests
  - Role: Write all unit and integration tests for Tier 2 features
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

### 1. Build GitHub Integration Library Module

- **Task ID**: build-github-lib
- **Depends On**: none
- **Assigned To**: builder-github-lib
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read these files for context:
  - `C:/PROJ/kova-cli/src/lib/subprocess.ts` -- execa usage pattern (shell: isWindows)
  - `C:/PROJ/kova-cli/src/lib/constants.ts` -- TASKS_DIR
  - `C:/PROJ/kova-cli/src/lib/checkpoint.ts` -- readCheckpoint, getLatestCheckpoint
  - `C:/PROJ/kova-cli/src/commands/build.ts` -- getLatestPlan
  - `C:/PROJ/kova-cli/src/commands/plan.ts` -- parsePlanTasks, extractSection pattern
  - `C:/PROJ/kova-cli/src/types.ts`
  - `C:/PROJ/kova-cli/package.json`
- Create `src/lib/github.ts` with these exported functions:

**Git helpers** (use execa with `shell: process.platform === "win32"`):

```typescript
// Check if current directory is a git repository
async function isGitRepo(cwd: string): Promise<boolean>;
// Run: git rev-parse --is-inside-work-tree

// Get current branch name
async function getCurrentBranch(cwd: string): Promise<string | null>;
// Run: git branch --show-current

// Check if branch is a main branch (main, master, develop)
function isMainBranch(branchName: string): boolean;
// Returns true if branchName matches main, master, or develop

// Create and checkout a new branch
async function createBranch(cwd: string, branchName: string): Promise<boolean>;
// Run: git checkout -b <branchName>
// Returns true on success, false on failure (branch already exists, etc.)

// Convert a plan name to a branch name: "my-cool-feature" -> "feat/my-cool-feature"
function planNameToBranch(planName: string): string;
// Strip .md, lowercase, replace spaces with dashes, prefix with "feat/"
```

**GitHub CLI helpers**:

```typescript
// Check if gh CLI is installed
async function isGhInstalled(cwd: string): Promise<boolean>;
// Run: gh --version

// Check if gh is authenticated
async function isGhAuthenticated(cwd: string): Promise<boolean>;
// Run: gh auth status
// Returns true if exit code 0

// Fetch a GitHub issue by number
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}
async function fetchIssue(
  cwd: string,
  issueNumber: number,
): Promise<GitHubIssue | null>;
// Run: gh issue view <number> --json number,title,body,labels
// Parse JSON output, return null on failure

// Build issue context string for plan prompt injection
function buildIssueContext(issue: GitHubIssue): string;
// Returns formatted string:
// "## GitHub Issue #N: <title>\n\n<body>\n\nLabels: <labels>\n\nClosing this issue: Closes #N"
```

**PR helpers**:

```typescript
// Generate PR title from plan name
function generatePrTitle(planName: string): string;
// Convert kebab-case to Title Case: "add-user-profiles" -> "Add User Profiles"

// Generate PR body from plan content and checkpoint
interface PrBodyOptions {
  planContent: string;
  planName: string;
  checkpointPath: string | null;
}
function generatePrBody(options: PrBodyOptions): string;
// Extract objective from plan
// List tasks with status from checkpoint (if available)
// Add agent summary
// Add "Generated with Kova" footer
// Format as markdown

// Create a pull request using gh CLI
interface CreatePrOptions {
  cwd: string;
  title: string;
  body: string;
  base?: string;
  draft?: boolean;
}
interface CreatePrResult {
  success: boolean;
  url: string | null;
  error: string | null;
}
async function createPullRequest(
  options: CreatePrOptions,
): Promise<CreatePrResult>;
// Run: gh pr create --title "..." --body "..." [--base main] [--draft]
// Parse output for PR URL
// Return success/failure with URL or error message
```

All execa calls should use `shell: process.platform === "win32"` for Windows compatibility. All functions should catch errors gracefully and return null/false rather than throwing (except where the caller expects it).

- Run `cd C:/PROJ/kova-cli && npm run build` to verify compilation

### 2. Build `kova pr` Command

- **Task ID**: build-pr-command
- **Depends On**: build-github-lib
- **Assigned To**: builder-github-cmds
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/lib/github.ts` for available APIs
- Read `C:/PROJ/kova-cli/src/commands/build.ts` for `getLatestPlan` import
- Read `C:/PROJ/kova-cli/src/lib/checkpoint.ts` for `getCheckpointPath`
- Create `src/commands/pr.ts`:

```typescript
export interface PrOptions {
  title?: string;
  body?: string;
  draft?: boolean;
  base?: string;
}

export async function prCommand(options: PrOptions): Promise<void> {
  const projectDir = process.cwd();

  // 1. Verify git repo
  if (!(await isGitRepo(projectDir))) {
    logger.error("Not a git repository. Initialize with: git init");
    process.exit(1);
  }

  // 2. Verify gh CLI
  if (!(await isGhInstalled(projectDir))) {
    logger.error(
      "GitHub CLI (gh) not found. Install from: https://cli.github.com",
    );
    process.exit(1);
  }

  if (!(await isGhAuthenticated(projectDir))) {
    logger.error("GitHub CLI not authenticated. Run: gh auth login");
    process.exit(1);
  }

  // 3. Check branch
  const branch = await getCurrentBranch(projectDir);
  if (!branch) {
    logger.error("Could not determine current branch.");
    process.exit(1);
  }
  if (isMainBranch(branch)) {
    logger.error(
      `Cannot create PR from ${branch}. Switch to a feature branch first.`,
    );
    logger.info("Tip: Use 'kova plan' which auto-creates feature branches.");
    process.exit(1);
  }

  // 4. Find latest plan for PR body generation
  const tasksDir = path.join(projectDir, TASKS_DIR);
  const latestPlan = getLatestPlan(tasksDir);
  let planContent = "";
  let planName = branch; // fallback to branch name if no plan found

  if (latestPlan) {
    planContent = fs.readFileSync(latestPlan, "utf-8");
    planName = path.basename(latestPlan, ".md");
  }

  // 5. Generate title and body (or use overrides)
  const title = options.title ?? generatePrTitle(planName);
  const body =
    options.body ??
    generatePrBody({
      planContent,
      planName,
      checkpointPath: latestPlan ? getCheckpointPath(latestPlan) : null,
    });

  logger.info(`Creating PR: ${title}`);
  logger.info(`Branch: ${branch} -> ${options.base ?? "main"}`);
  if (options.draft) logger.info("Mode: draft");

  // 6. Create PR
  const result = await createPullRequest({
    cwd: projectDir,
    title,
    body,
    base: options.base,
    draft: options.draft,
  });

  if (result.success && result.url) {
    logger.success(`PR created: ${result.url}`);
  } else {
    logger.error(`Failed to create PR: ${result.error ?? "unknown error"}`);
    process.exit(1);
  }
}
```

- Register `pr` command in `src/index.ts`:

```typescript
// PR command
program
  .command("pr")
  .description("Create a GitHub Pull Request from the last build")
  .option("--title <title>", "Override PR title")
  .option("--body <body>", "Override PR body")
  .option("--draft", "Create as draft PR")
  .option("--base <branch>", "Target branch (default: main)")
  .action(
    wrapCommandAction(async (options) => {
      const { prCommand } = await import("./commands/pr.js");
      await prCommand(options);
    }),
  );
```

- Run `npm run build` and verify `node bin/kova.js pr --help`

### 3. Integrate Issue Linking into Plan and Run Commands

- **Task ID**: integrate-issue-linking
- **Depends On**: build-github-lib
- **Assigned To**: builder-github-cmds
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: true (can run alongside task 2 if using same resumed agent)
- Read `C:/PROJ/kova-cli/src/commands/plan.ts`
- Read `C:/PROJ/kova-cli/src/commands/run.ts`
- Read `C:/PROJ/kova-cli/src/lib/github.ts`

**Modify plan.ts**:

1. Update PlanOptions:

```typescript
export interface PlanOptions {
  model?: string;
  autoBuild?: boolean;
  output?: string;
  template?: string;
  issue?: string; // NEW: GitHub issue number
  noBranch?: boolean; // NEW: disable auto-branch
}
```

2. Add imports:

```typescript
import {
  fetchIssue,
  buildIssueContext,
  isGhInstalled,
  isGitRepo,
  getCurrentBranch,
  isMainBranch,
  createBranch,
  planNameToBranch,
} from "../lib/github.js";
```

3. In `planCommand()`, AFTER template handling but BEFORE Claude invocation, add issue linking:

```typescript
// Fetch GitHub issue context if --issue specified
if (options.issue) {
  const issueNum = parseInt(options.issue, 10);
  if (isNaN(issueNum)) {
    logger.error(`Invalid issue number: ${options.issue}`);
    process.exit(1);
  }
  const ghAvailable = await isGhInstalled(projectDir);
  if (!ghAvailable) {
    logger.warn(
      "GitHub CLI (gh) not installed. Skipping issue context. Install from: https://cli.github.com",
    );
  } else {
    const issue = await fetchIssue(projectDir, issueNum);
    if (issue) {
      const issueContext = buildIssueContext(issue);
      effectivePrompt = `${issueContext}\n\n${effectivePrompt}`;
      logger.info(`Linked issue #${issueNum}: ${issue.title}`);
    } else {
      logger.warn(
        `Could not fetch issue #${issueNum}. Continuing without issue context.`,
      );
    }
  }
}
```

4. In `planCommand()`, AFTER Claude invocation and plan file detection, BEFORE displaying summary, add auto-branch:

```typescript
// Auto-create feature branch if on main/master/develop and --no-branch not set
if (!options.noBranch && resolvedPlanPath) {
  try {
    const isRepo = await isGitRepo(projectDir);
    if (isRepo) {
      const currentBranch = await getCurrentBranch(projectDir);
      if (currentBranch && isMainBranch(currentBranch)) {
        const planBaseName = path.basename(resolvedPlanPath, ".md");
        const branchName = planNameToBranch(planBaseName);
        const created = await createBranch(projectDir, branchName);
        if (created) {
          logger.success(`Created branch: ${branchName}`);
        }
      }
    }
  } catch {
    // Branch creation failure is non-fatal
    logger.debug("Auto-branch creation skipped or failed.");
  }
}
```

**Modify run.ts**:

1. Update RunOptions:

```typescript
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
  issue?: string; // NEW
  branch?: string; // NEW: custom branch name
  noBranch?: boolean; // NEW
}
```

2. Pass issue and noBranch through to planCommand:

```typescript
await planCommand(prompt, {
  model: options.model,
  template: options.template,
  autoBuild: options.auto !== false,
  output: undefined,
  issue: options.issue,
  noBranch: options.noBranch,
});
```

**Update index.ts**:

Add these flags to the plan command:

```typescript
.option("--issue <number>", "Link a GitHub issue for context")
.option("--no-branch", "Disable auto-branch creation")
```

Add these flags to the run command:

```typescript
.option("--issue <number>", "Link a GitHub issue for context")
.option("--branch <name>", "Custom branch name")
.option("--no-branch", "Disable auto-branch creation")
```

- Run `npm run build`

### 4. Update Completions Registry

- **Task ID**: update-completions
- **Depends On**: build-pr-command, integrate-issue-linking
- **Assigned To**: builder-github-cmds
- **Agent Type**: backend-engineer
- **Model**: haiku
- **Parallel**: false
- Read `C:/PROJ/kova-cli/src/lib/completions.ts`
- Add `pr` command to the command registry in `getCommandRegistry()`:

```typescript
{
  name: "pr",
  description: "Create a GitHub Pull Request from the last build",
  options: [
    { flags: "--title", description: "Override PR title" },
    { flags: "--body", description: "Override PR body" },
    { flags: "--draft", description: "Create as draft PR" },
    { flags: "--base", description: "Target branch" },
  ],
},
```

- Add `--issue` and `--no-branch` to plan command options in the registry
- Add `--issue`, `--branch`, and `--no-branch` to run command options in the registry
- Run `npm run build`
- Verify `node bin/kova.js completions bash` includes "pr" command
- Verify `node bin/kova.js --help` lists pr command
- Verify `node bin/kova.js pr --help` shows all flags
- Verify `node bin/kova.js plan --help` shows --issue and --no-branch flags
- Run `npm test` to verify all 302 existing tests still pass

### 5. Write Tier 2 Unit Tests

- **Task ID**: write-tier2-unit-tests
- **Depends On**: update-completions
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read all new/modified source files
- Write `tests/github.test.ts`:
  **Git helper tests** (mock execa):
  - Test `isGitRepo()` returns true when git command succeeds (mock execa to resolve)
  - Test `isGitRepo()` returns false when git command fails (mock execa to reject)
  - Test `getCurrentBranch()` returns branch name from stdout
  - Test `getCurrentBranch()` returns null on failure
  - Test `isMainBranch("main")` returns true
  - Test `isMainBranch("master")` returns true
  - Test `isMainBranch("develop")` returns true
  - Test `isMainBranch("feat/my-feature")` returns false
  - Test `isMainBranch("fix/bug-123")` returns false
  - Test `planNameToBranch("add-user-profiles")` returns "feat/add-user-profiles"
  - Test `planNameToBranch("Fix Login Bug")` returns "feat/fix-login-bug" (lowercase + dash)
  - Test `planNameToBranch("my plan.md")` strips .md extension

  **GitHub CLI helper tests** (mock execa):
  - Test `isGhInstalled()` returns true when gh --version succeeds
  - Test `isGhInstalled()` returns false when gh not found
  - Test `isGhAuthenticated()` returns true when gh auth status succeeds
  - Test `isGhAuthenticated()` returns false when not logged in
  - Test `fetchIssue()` parses JSON output correctly
  - Test `fetchIssue()` returns null on failure
  - Test `buildIssueContext()` includes issue number and title
  - Test `buildIssueContext()` includes "Closes #N"
  - Test `buildIssueContext()` includes labels when present
  - Test `buildIssueContext()` handles empty body

  **PR helper tests**:
  - Test `generatePrTitle("add-user-profiles")` returns "Add User Profiles"
  - Test `generatePrTitle("fix-login-bug")` returns "Fix Login Bug"
  - Test `generatePrTitle("a")` returns "A" (single word)
  - Test `generatePrBody()` includes objective from plan
  - Test `generatePrBody()` includes task count
  - Test `generatePrBody()` includes "Generated with Kova" footer
  - Test `generatePrBody()` handles empty plan content gracefully
  - Test `createPullRequest()` success returns URL (mock execa)
  - Test `createPullRequest()` failure returns error (mock execa)
  - Test `createPullRequest()` passes --draft flag when draft=true
  - Test `createPullRequest()` passes --base flag when provided

  For execa mocking: use `vi.mock("execa", ...)` to mock the execa function. Return objects with `{ stdout: "...", exitCode: 0 }` shape.

- Write `tests/pr.test.ts`:
  - Test PR title generation from various plan names
  - Test PR body generation includes all sections
  - Test PR body with checkpoint data includes task status

- Run `npm test` -- all tests must pass

### 6. Write Tier 2 Integration Tests

- **Task ID**: write-tier2-integration-tests
- **Depends On**: write-tier2-unit-tests
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Write `tests/github-integration.test.ts`:
  - Test full issue context injection: create mock issue object, call buildIssueContext, verify it contains issue number, title, body, and "Closes #N"
  - Test branch name derivation from various plan names: spaces, dots, uppercase, kebab-case
  - Test `isMainBranch` with edge cases: "main", "master", "develop", "Main" (case sensitivity), "main-feature" (should be false), "release/main" (should be false)
  - Test PR body generation end-to-end: create a realistic plan content string, call generatePrBody, verify output contains objective, tasks, footer
  - Test PR body with checkpoint: create mock checkpoint with mixed task statuses, verify body includes status summary
  - Test completions registry includes "pr" command with 4 options
  - Test completions bash output includes "pr" command
  - Test plan command PlanOptions has issue and noBranch fields (type check via construction)
  - Test run command RunOptions has issue, branch, noBranch fields
- Run `npm test` -- ALL tests must pass (302 existing + new)
- Run `npm test` again to verify no flaky tests
- Run `npm run build` to verify clean compilation

### 7. Final Validation

- **Task ID**: validate-all
- **Depends On**: build-github-lib, build-pr-command, integrate-issue-linking, update-completions, write-tier2-unit-tests, write-tier2-integration-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check:
  - All 302 existing tests still pass
  - 40+ new tests added and passing
  - `kova pr --help` shows all flags (--title, --body, --draft, --base)
  - `kova plan --help` shows --issue and --no-branch flags
  - `kova run --help` shows --issue, --branch, --no-branch flags
  - `kova --help` lists pr command
  - `kova completions bash` includes "pr" in command list
  - github.ts uses `shell: process.platform === "win32"` for all execa calls
  - No TypeScript `any` types in new code
  - All file paths use `path.join()`
  - `npm pack --dry-run` succeeds
  - `npm run build` compiles cleanly
  - No flaky tests (two runs same result)
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. All 302 existing tests continue to pass (zero regressions)
2. `npm run build` compiles cleanly with no errors
3. 40+ new tests added, all passing
4. `kova pr` command exists with --title, --body, --draft, --base flags
5. `kova pr --help` shows all flags
6. `kova plan --issue 42` flag exists and accepted by CLI
7. `kova plan --no-branch` flag exists and accepted by CLI
8. `kova run --issue 42` flag exists and passed through to plan
9. `kova run --branch feat/custom` flag exists
10. `kova run --no-branch` flag exists
11. `isGitRepo()` correctly detects git repositories via execa
12. `getCurrentBranch()` returns branch name from git
13. `isMainBranch()` identifies main, master, develop
14. `planNameToBranch()` converts plan names to valid branch names
15. `fetchIssue()` parses gh CLI JSON output correctly
16. `buildIssueContext()` formats issue for plan prompt injection
17. `generatePrTitle()` converts kebab-case to Title Case
18. `generatePrBody()` includes objective, tasks, and Kova footer
19. `createPullRequest()` invokes gh pr create with correct arguments
20. All execa calls use `shell: process.platform === "win32"` (Windows compat)
21. No TypeScript `any` types in new or modified code
22. `kova completions bash` includes "pr" command
23. `npm pack --dry-run` succeeds
24. No flaky tests (run suite twice, same results)

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-cli && npm run build` -- Verify clean compilation
- `npm run lint` -- Verify no TypeScript errors
- `npm test` -- Run full test suite (should be 340+ tests, 0 failures)
- `npm test` -- Run again to verify no flaky tests
- `node bin/kova.js --version` -- Still outputs 0.1.0
- `node bin/kova.js --help` -- Lists pr command
- `node bin/kova.js pr --help` -- Shows --title, --body, --draft, --base
- `node bin/kova.js plan --help` -- Shows --issue and --no-branch
- `node bin/kova.js run --help` -- Shows --issue, --branch, --no-branch
- `node bin/kova.js completions bash | grep -c "pr"` -- Should find pr in bash completions
- `npm pack --dry-run` -- Verify package contents

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is C:/PROJ/kova-cli/
- Do NOT break any existing functionality. All 302 tests must pass.
- NO new npm dependencies. Use execa (already installed) for all git and gh CLI calls.
- The `gh` CLI is an external dependency that users must install separately. All `gh` operations must check for gh availability first and provide graceful degradation with helpful install instructions.
- The `git` commands are assumed to be available (Kova runs in code projects). Still check `isGitRepo()` before git operations.
- For execa mocking in tests, mock the `execa` module (not global fetch). Use `vi.mock("execa")` with custom implementations that return the expected stdout/exitCode.
- Branch creation is intentionally non-blocking: if it fails (branch exists, git not available, etc.), warn and continue. Never block the plan command for a branch creation failure.
- PR body generation should be robust: handle empty plan content, missing checkpoint, missing sections gracefully.
- The `generatePrTitle()` function should handle edge cases: single word, already-Title-Case, dots, underscores.
- All GitHub/git error messages should include actionable next steps (install gh, run gh auth login, etc.).

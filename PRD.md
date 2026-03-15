# Kova - Product Requirements Document

**Version**: 1.0
**Date**: 2026-03-14
**Status**: Draft
**Author**: Claude Fast Development System
**Package**: `kova-cli` on npm
**Mascot**: Wolf (coordinated pack of specialists)

---

## 1. Executive Summary

Kova is a hybrid developer tool (npm CLI + future web dashboard) that packages a sophisticated multi-agent AI coding orchestration system for distribution. It transforms project-local Claude Code skill files into an installable, configurable product that any developer can use to plan, execute, and validate complex multi-file coding tasks using specialized AI agents.

**The core insight**: Existing autonomous coding tools (Ralphy, Aider) use a single general-purpose agent in a loop. Kova introduces **planned multi-agent orchestration** with specialist routing, explicit dependency modeling, contract-first execution, independent quality validation, and cost-optimized model tiering -- capabilities that don't exist in any distributed tool today.

**Target market**: Developers and teams using Claude Code who need structured, reliable execution of complex coding tasks across multiple files and domains.

**Distribution**: npm CLI package (Phase 1) + web monitoring dashboard (Phase 2+).

---

## 1.1 Brand Identity

### Name: Kova

**Meaning**: A unique, invented name -- short, fast to type, globally unambiguous. 4 letters, zero search conflicts.

### Mascot: The Wolf Pack

The wolf pack is the perfect metaphor for Kova's multi-agent orchestration:

| Wolf Pack Role                             | Kova Equivalent                                                  |
| ------------------------------------------ | ---------------------------------------------------------------- |
| **Alpha** (plans the hunt)                 | `/kova plan` -- analyzes codebase, designs approach              |
| **Scout** (reconnaissance)                 | `master-orchestrator` -- explores and maps the codebase          |
| **Flankers** (specialists covering angles) | `frontend-specialist`, `backend-engineer`, `supabase-specialist` |
| **Drivers** (push toward objective)        | `/kova build` -- executes tasks in dependency order              |
| **Closer** (finishes the hunt)             | `quality-engineer` -- validates and confirms completion          |

**Tagline**: "Plan the hunt. Run the pack."

**Alternative taglines**:

- "Your AI wolf pack for code."
- "Specialists in formation."
- "Plan. Specialize. Advance."

### Visual Identity

- **Logo**: Minimal wolf head silhouette, sharp geometric lines
- **Color palette**: Deep charcoal (#1A1A2E) + electric blue (#4361EE) + wolf silver (#C0C0C8)
- **Icon**: Wolf head works at 16px (favicon), 64px (npm), and full size (website hero)
- **Aesthetic**: Clean, technical, precise -- not playful or cartoonish. The wolf is a predator, not a pet.

### Voice and Tone

- **CLI output**: Direct, no fluff. Status updates read like mission briefings.
- **Documentation**: Clear, example-driven. Respect the developer's time.
- **Marketing**: Confident but not arrogant. "Better tools, not louder claims."

---

## 2. Problem Statement

### 2.1 The Problem

Developers using AI coding assistants face three core challenges with complex tasks:

1. **No Planning**: Tools like Ralphy start executing immediately without analyzing the codebase, mapping dependencies, or designing an approach. This leads to rework, missed edge cases, and architectural drift.

2. **No Specialization**: Every task -- frontend, backend, database, security -- is handled by the same general-purpose agent. A generalist writing database migrations is less reliable than a database specialist.

3. **No Coordination**: When multiple agents work in parallel, they are blind to each other's changes. Agent A modifies an API contract; Agent B builds a frontend against the old contract. Result: broken integration.

### 2.2 Why Now

- Claude Code's Agent tool supports specialist agent types, task dependencies, and agent resume
- Claude Code's experimental Agent Teams feature enables peer-to-peer agent coordination
- The AI coding tools market is projected to reach $34.58B in 2026 (Grand View Research)
- No distributed tool combines planning + specialization + dependency modeling + validation
- Ralphy (the closest competitor) validates demand but lacks multi-agent orchestration

### 2.3 What Exists Today

A proven orchestration system exists as project-local `.claude/` files in the Francis Myles International project:

- `/team-plan` command: Creates structured implementation plans with dependency graphs
- `/build` command: Executes plans via hub-and-spoke sub-agent dispatch
- `/team-build` command: Executes plans via contract-first Agent Teams with peer-to-peer coordination
- 17+ specialist agent definitions (frontend, backend, database, security, quality, etc.)
- Skills system (session-management, sub-agent-invocation, codebase-navigation)
- Hook validators (plan file creation, required section enforcement)
- Context recovery system (continuous monitoring, threshold-based backups)

**The problem**: This system is locked in a single project's `.claude/` folder. It cannot be installed, shared, or used by anyone else.

---

## 3. Product Vision

### 3.1 One-Liner

"Plan before you code. Specialize every agent. Validate independently."

### 3.2 Vision Statement

Kova makes every Claude Code user as effective as the best AI-assisted development team by giving them structured planning, specialist agents, dependency-aware execution, and independent quality validation -- installed in 60 seconds.

### 3.3 Success Metrics (12-Month Targets)

| Metric                       | Target             | Measurement        |
| ---------------------------- | ------------------ | ------------------ |
| npm weekly downloads         | 5,000+             | npm stats          |
| GitHub stars                 | 2,000+             | GitHub             |
| Active users (monthly)       | 1,000+             | Telemetry (opt-in) |
| Plans created per user/month | 8+                 | Telemetry          |
| Build success rate           | 85%+               | Telemetry          |
| Dashboard paid conversions   | 5-10% of CLI users | Stripe             |
| NPS score                    | 50+                | Survey             |

---

## 4. User Personas

### 4.1 Solo Developer (Primary)

- Uses Claude Code daily for feature development
- Frustrated by large tasks failing mid-execution with no recovery
- Wants structured approach but doesn't want to manually set up orchestration
- Cares about cost (wants haiku for simple tasks, not opus for everything)
- Technical: comfortable with npm, CLI tools, git

### 4.2 Tech Lead / Team Lead

- Manages a team building with Claude Code
- Needs visibility into what agents are doing and how tasks are progressing
- Wants to define project rules (boundaries, coding standards) once and have all agents follow them
- Interested in the web dashboard for monitoring and collaboration
- Will pay for team features ($99-299/month)

### 4.3 Agency / Freelancer

- Works across multiple client projects with different tech stacks
- Needs auto-detection (don't make me configure everything per project)
- Wants plan templates for common patterns (new feature, bug fix, refactor)
- Values the speed multiplier of parallel specialist agents
- Cost-sensitive: model tiering is a major selling point

---

## 5. Competitive Landscape

### 5.1 Direct Competitors

| Tool          | Distribution | Planning       | Multi-Agent                              | Specialization           | Dependencies               | Validation                  | Price            |
| ------------- | ------------ | -------------- | ---------------------------------------- | ------------------------ | -------------------------- | --------------------------- | ---------------- |
| **Ralphy**    | npm CLI      | None           | Parallel via worktrees (no coordination) | None (single generalist) | Implicit (checklist order) | Self-validates (same agent) | Free             |
| **Aider**     | pip CLI      | Conversational | No                                       | None                     | None                       | Git diff review             | Free             |
| **Codex CLI** | npm CLI      | Implicit       | No                                       | None                     | None                       | Test-driven                 | Free (API costs) |

### 5.2 Indirect Competitors

| Tool               | Type              | Planning                  | Multi-Agent                       | Price      |
| ------------------ | ----------------- | ------------------------- | --------------------------------- | ---------- |
| **Cursor**         | IDE               | Task spec                 | Yes (8 parallel, no coordination) | $20/mo     |
| **GitHub Copilot** | IDE extension     | Sub-agent planning        | Sequential agents                 | $10-19/mo  |
| **Devin**          | SaaS              | Full autonomous           | Yes                               | $20-500/mo |
| **Cline**          | VS Code extension | Explicit (Plan/Act modes) | No                                | Free       |

### 5.3 Competitive Positioning

```
                    Simple ←────────────────────→ Sophisticated

  Single Agent      Aider ─── Ralphy ─── Codex CLI

  Multi Agent       Cline ─── Cursor ─── Copilot ─── CLAUDE ORCHESTRATOR

  Autonomous                                         Devin
```

**Kova's unique position**: The only distributed tool that combines:

1. Dedicated planning phase with codebase analysis
2. 17+ specialist agent types
3. Explicit task dependency modeling
4. Contract-first team execution
5. Independent quality validation
6. Cost-optimized model tiering (haiku/sonnet/opus)

No competitor offers all six.

---

## 6. Product Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE ORCHESTRATOR                    │
├──────────────┬──────────────────┬────────────────────────┤
│   CLI Layer  │  Orchestration   │   Dashboard Layer      │
│   (npm pkg)  │  Engine          │   (web app, Phase 2)   │
├──────────────┼──────────────────┼────────────────────────┤
│ init         │ /team-plan       │ Plan visualization     │
│ plan         │ /build           │ Progress monitoring     │
│ build        │ /team-build      │ Build history          │
│ team-build   │ Skills system    │ Team collaboration     │
│ status       │ Hook validators  │ Analytics dashboard    │
│ config       │ Agent routing    │ Plan templates library │
│ update       │ Model tiering    │ Notification center    │
└──────┬───────┴────────┬─────────┴──────────┬─────────────┘
       │                │                    │
       ▼                ▼                    ▼
  Local Files      Claude Code CLI      Event Stream
  (.claude/)       (subprocess)         (CLI → Dashboard)
```

### 6.2 Component Architecture

```
kovaestrator/
├── package.json
├── tsconfig.json
├── bin/
│   └── kova.js                         # #!/usr/bin/env node entry point
├── src/
│   ├── index.ts                        # CLI setup (Commander.js)
│   ├── commands/
│   │   ├── init.ts                     # Project initialization
│   │   ├── plan.ts                     # Invoke /team-plan via Claude Code
│   │   ├── build.ts                    # Invoke /build via Claude Code
│   │   ├── team-build.ts              # Invoke /team-build via Claude Code
│   │   ├── status.ts                   # Read checkpoint, display progress
│   │   ├── config.ts                   # View/edit configuration
│   │   └── update.ts                   # Update templates from npm
│   ├── lib/
│   │   ├── detect.ts                   # Auto-detect project type
│   │   ├── scaffold.ts                 # Copy templates to .claude/
│   │   ├── config.ts                   # Read/write kova.yaml
│   │   ├── checkpoint.ts              # File-based progress tracking
│   │   ├── subprocess.ts              # Claude Code CLI invocation
│   │   ├── notifications.ts           # Webhook dispatch (Discord/Slack)
│   │   ├── telemetry.ts              # Opt-in anonymous usage analytics
│   │   └── model-selector.ts         # Auto-detect optimal model per task
│   └── ui/
│       ├── progress.tsx               # ink-based terminal progress display
│       └── status.tsx                 # ink-based status table
├── templates/
│   ├── commands/
│   │   ├── team-plan.md               # Plan creation command template
│   │   ├── build.md                   # Hub-and-spoke execution template
│   │   └── team-build.md             # Agent Teams execution template
│   ├── skills/
│   │   ├── session-management/
│   │   │   └── SKILL.md              # Session workflow skill
│   │   ├── sub-agent-invocation/
│   │   │   └── SKILL.md              # Agent routing skill
│   │   └── codebase-navigation/
│   │       └── SKILL.md              # Codebase exploration skill
│   ├── hooks/
│   │   ├── Validators/
│   │   │   ├── validate-new-file.mjs
│   │   │   └── validate-file-contains.mjs
│   │   ├── FormatterHook/
│   │   │   └── formatter.mjs
│   │   └── SkillActivationHook/
│   │       └── skill-activation-prompt.mjs
│   ├── agents/
│   │   └── agent-rules.json           # 17+ specialist agent definitions
│   ├── skills/
│   │   └── skill-rules.json           # Skill activation triggers
│   ├── settings.json                   # Hook configuration template
│   ├── CLAUDE.md.template             # Project instructions template
│   └── kova.yaml.template     # Configuration template
├── docs/
│   ├── getting-started.md
│   ├── commands.md
│   ├── configuration.md
│   ├── agents.md
│   ├── plan-format.md
│   └── troubleshooting.md
└── tests/
    ├── detect.test.ts
    ├── scaffold.test.ts
    ├── config.test.ts
    ├── checkpoint.test.ts
    └── model-selector.test.ts
```

### 6.3 Technology Stack

| Component           | Technology          | Rationale                                                   |
| ------------------- | ------------------- | ----------------------------------------------------------- |
| **Language**        | TypeScript 5.x      | Type safety, Claude Code ecosystem alignment                |
| **CLI Framework**   | Commander.js        | 35M+ weekly downloads, zero dependencies, 18-25ms startup   |
| **Build Tool**      | tsup                | Zero-config esbuild wrapper, perfect for CLIs               |
| **Terminal UI**     | ink (React for CLI) | Rich terminal output, used by Gatsby/Yarn                   |
| **Subprocess**      | execa               | 1M+ weekly, promise-based, streaming support                |
| **Config**          | cosmiconfig         | 200K+ weekly, standard discovery pattern (ESLint/Prettier)  |
| **Testing**         | Vitest              | Fast, TypeScript-native, compatible with existing ecosystem |
| **Linting**         | Biome               | Zero-config, fast, used in source project                   |
| **Package Manager** | npm                 | Broadest compatibility for distribution                     |

---

## 7. Feature Specifications

### 7.1 Phase 1: CLI Foundation (MVP)

#### F1.1: `kova init`

**Purpose**: Initialize a project for orchestrated development in under 30 seconds.

**Behavior**:

1. Detect project type (language, framework, package manager, existing commands)
2. Check for existing `.claude/` directory (offer merge or overwrite)
3. Scaffold `.claude/` directory with all templates
4. Generate `kova.yaml` with detected configuration
5. Generate `CLAUDE.md` with project-specific instructions
6. Create `.claude/tasks/` directory
7. Print setup summary with next steps

**Auto-Detection Logic**:

| Signal          | Detection Method                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language        | `tsconfig.json` (TS), `pyproject.toml` (Python), `go.mod` (Go), `Cargo.toml` (Rust), `package.json` (JS)                                                                            |
| Framework       | Dependencies in package.json: `next` (Next.js), `expo` (Expo), `react` (React), `vue` (Vue), `@angular/core` (Angular), `django` (Django), `fastapi` (FastAPI), `express` (Express) |
| Package Manager | Lock files: `package-lock.json` (npm), `yarn.lock` (yarn), `pnpm-lock.yaml` (pnpm), `bun.lockb` (bun)                                                                               |
| Commands        | `scripts` in package.json: `test`, `lint`, `build`, `typecheck`, `dev`                                                                                                              |
| Database        | Dependencies: `@supabase/supabase-js` (Supabase), `prisma` (Prisma), `drizzle-orm` (Drizzle), `mongoose` (MongoDB)                                                                  |
| Auth            | Dependencies: `better-auth`, `next-auth`, `@supabase/auth-helpers`, `passport`                                                                                                      |
| Payments        | Dependencies: `stripe`, `@polar-sh/sdk`, `dodopayments`                                                                                                                             |

**Output**:

```
kova init

Detected:
  Language:    TypeScript
  Framework:   Next.js 15
  Package Mgr: pnpm
  Database:    Supabase
  Auth:        BetterAuth
  Test:        vitest
  Lint:        biome check

Created:
  .claude/commands/team-plan.md
  .claude/commands/build.md
  .claude/commands/team-build.md
  .claude/skills/session-management/SKILL.md
  .claude/skills/sub-agent-invocation/SKILL.md
  .claude/hooks/Validators/validate-new-file.mjs
  .claude/hooks/Validators/validate-file-contains.mjs
  .claude/agents/agent-rules.json
  .claude/skills/skill-rules.json
  .claude/settings.json
  kova.yaml

Next steps:
  1. Review kova.yaml and adjust settings
  2. Run: kova plan "your task description"
  3. Review the plan, then: kova build
```

**Flags**:

- `--force`: Overwrite existing `.claude/` directory
- `--merge`: Merge with existing `.claude/` files (preserve user customizations)
- `--dry-run`: Show what would be created without creating anything
- `--no-detect`: Skip auto-detection, use defaults
- `--preset <name>`: Use a preset (nextjs, expo, django, express, etc.)

---

#### F1.2: `kova plan <prompt>`

**Purpose**: Create a structured implementation plan with team orchestration.

**Behavior**:

1. Validate that `.claude/` directory exists (suggest `init` if not)
2. Read `kova.yaml` for project configuration
3. Invoke Claude Code CLI as subprocess with `/team-plan` command
4. Pass user prompt and project context to Claude Code
5. Wait for plan creation (with spinner/progress indicator)
6. Validate plan file was created (check `.claude/tasks/`)
7. Display plan summary in terminal
8. Ask for approval before proceeding

**Subprocess Invocation**:

```typescript
import { execa } from "execa";

const result = await execa(
  "claude",
  ["--print", "--skill", "team-plan", "--args", userPrompt],
  {
    cwd: projectDir,
    stdio: "pipe",
    timeout: 300000, // 5 minute timeout
  },
);
```

**Output**:

```
kova plan "add user profile editing with avatar upload"

Planning...  (using opus model)

Plan created: .claude/tasks/user-profile-editing.md

Summary:
  Objective:  Add profile editing screen with avatar upload
  Phases:     3 (Foundation, Core, Polish)
  Tasks:      7
  Agents:     frontend-specialist, backend-engineer, supabase-specialist, quality-engineer
  Est. Models: 2x haiku, 3x sonnet, 1x opus, 1x sonnet (validation)

Task Graph:
  1. [haiku]  setup-storage-bucket (no deps)
  2. [sonnet] build-upload-api (depends on 1)
  3. [sonnet] build-profile-form (depends on 1)
  4. [sonnet] build-avatar-component (depends on 2, 3)
  5. [haiku]  update-navigation (depends on 4)
  6. [sonnet] integration-tests (depends on 4, 5)
  7. [sonnet] quality-validation (depends on all)

Proceed with build? [Y/n/edit]
```

**Flags**:

- `--model <model>`: Override planning model (default: opus)
- `--template <name>`: Use plan template (feature, bugfix, refactor, migration)
- `--auto-build`: Skip approval, immediately proceed to build
- `--output <path>`: Custom output path for plan file

---

#### F1.3: `kova build [plan-path]`

**Purpose**: Execute a plan using hub-and-spoke sub-agent dispatch.

**Behavior**:

1. Read plan file (default: most recent in `.claude/tasks/`)
2. Parse team members, tasks, dependencies, acceptance criteria
3. Create checkpoint file (`.claude/tasks/<plan>.progress.json`)
4. Invoke Claude Code CLI with `/build` command and plan path
5. Stream progress to terminal (via ink UI)
6. Update checkpoint file as tasks complete
7. Display final report with pass/fail results
8. Send webhook notifications (if configured)

**Checkpoint File**:

```json
{
  "plan": "user-profile-editing.md",
  "started_at": "2026-03-14T10:00:00Z",
  "status": "in_progress",
  "tasks": {
    "setup-storage-bucket": {
      "status": "completed",
      "agent_type": "supabase-specialist",
      "model": "haiku",
      "agent_id": "abc123",
      "started_at": "2026-03-14T10:00:05Z",
      "completed_at": "2026-03-14T10:00:52Z",
      "duration_s": 47
    },
    "build-upload-api": {
      "status": "in_progress",
      "agent_type": "backend-engineer",
      "model": "sonnet",
      "agent_id": "def456",
      "started_at": "2026-03-14T10:00:53Z"
    },
    "build-profile-form": {
      "status": "pending"
    }
  },
  "validation": null
}
```

**Terminal Progress Display** (ink):

```
kova build

Building: user-profile-editing.md
Progress: [=====>          ] 3/7 tasks (42%)

  [done]    setup-storage-bucket     haiku    47s
  [done]    build-upload-api         sonnet   2m 18s
  [done]    build-profile-form       sonnet   1m 45s
  [running] build-avatar-component   sonnet   started 1m ago
  [blocked] update-navigation        haiku    waiting on: build-avatar-component
  [pending] integration-tests        sonnet
  [pending] quality-validation       sonnet

Estimated remaining: ~4 minutes
```

**Flags**:

- `--resume`: Resume from checkpoint (skip completed tasks)
- `--parallel <n>`: Max parallel agents (default: from config)
- `--model-override <model>`: Use this model for all tasks
- `--dry-run`: Show execution plan without running
- `--verbose`: Show agent output in real-time
- `--no-validate`: Skip quality engineer validation step

---

#### F1.4: `kova team-build [plan-path]`

**Purpose**: Execute a plan using contract-first Agent Teams with peer-to-peer coordination.

**Behavior**:

1. Validate `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
2. Read and parse plan file
3. Analyze contract chain (dependency waves)
4. Create checkpoint file
5. Invoke Claude Code CLI with `/team-build` command
6. Stream wave-based progress to terminal
7. Update checkpoint as contracts are delivered and tasks complete
8. Display final validation report

**Wave-Based Progress Display**:

```
kova team-build

Building: user-profile-editing.md (Agent Teams mode)
Wave: 2/3

  Wave 1 (Foundation):
    [done] setup-storage-bucket  → Contract: storage schema delivered

  Wave 2 (Core - parallel):
    [done]    build-upload-api        → Contract: API endpoints delivered
    [running] build-profile-form      started 2m ago
    [running] build-avatar-component  started 1m ago

  Wave 3 (Validation):
    [pending] integration-tests
    [pending] quality-validation

Team: 4 agents active, 1 contract pending
```

**Flags**: Same as `build` plus:

- `--wave-timeout <seconds>`: Max time per wave (default: 600)

---

#### F1.5: `kova status`

**Purpose**: Check progress of current or recent builds.

**Behavior**:

1. Find most recent checkpoint file in `.claude/tasks/`
2. Read and parse checkpoint
3. Display formatted status table
4. Show timing information

**Output**:

```
kova status

Plan: user-profile-editing.md
Status: In Progress
Started: 2026-03-14 10:00:00 (6 minutes ago)

Tasks:
  [done]    setup-storage-bucket     haiku    47s
  [done]    build-upload-api         sonnet   2m 18s
  [done]    build-profile-form       sonnet   1m 45s
  [running] build-avatar-component   sonnet   3m 12s (active)
  [blocked] update-navigation        haiku    waiting: build-avatar-component
  [pending] integration-tests        sonnet
  [pending] quality-validation       sonnet

Progress: 3/7 (42%)
Elapsed: 6m 2s
Est. Remaining: ~4m
```

---

#### F1.6: `kova config`

**Purpose**: View and edit orchestrator configuration.

**Behavior**:

- `kova config`: Display current configuration
- `kova config set models.trivial haiku`: Set a config value
- `kova config add-rule "use server actions"`: Add a project rule
- `kova config add-boundary "*.lock"`: Add file protection boundary

---

#### F1.7: Auto Model Selection

**Purpose**: Automatically choose the optimal model (haiku/sonnet/opus) per task based on complexity signals.

**Classification Logic**:

```typescript
function selectModel(task: PlanTask, config: OrchestratorConfig): Model {
  const signals = {
    fileCount: task.files?.length || 0,
    hasDependents: task.dependents?.length > 0,
    dependentCount: task.dependents?.length || 0,
    touchesSecurity: /auth|security|rls|permission|token|session/i.test(
      task.description,
    ),
    touchesPayments: /stripe|payment|billing|subscription|checkout/i.test(
      task.description,
    ),
    touchesDatabase: /migration|schema|index|rls|trigger|function/i.test(
      task.description,
    ),
    isArchitectural: /refactor|redesign|migrate|overhaul/i.test(
      task.description,
    ),
    isSimple: /rename|typo|config|format|update version|add comment/i.test(
      task.description,
    ),
    isValidation: task.agentType === "quality-engineer",
  };

  // Haiku: simple, low-risk tasks
  if (signals.isSimple && signals.fileCount <= 1 && !signals.hasDependents) {
    return "haiku";
  }

  // Opus: architectural, security-critical, or high-dependency tasks
  if (
    signals.isArchitectural ||
    (signals.touchesSecurity && signals.fileCount > 2) ||
    signals.dependentCount >= 3 ||
    signals.fileCount >= 5
  ) {
    return "opus";
  }

  // Sonnet: everything else (moderate complexity)
  return "sonnet";
}
```

**Override**: Users can set model per task in the plan file or globally via `kova.yaml`.

---

#### F1.8: Token Usage Tracking and Session Budget Display

**Purpose**: After every task and at build completion, display token consumption and remaining session budget so users always know where they stand.

**How Claude Code Limits Work** (critical context for this feature):

Claude Code uses a **two-tier limit system**:

| Limit                     | Mechanism                                                                                               | Reset                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| **5-hour rolling window** | Tokens become available continuously as oldest usage "rolls off" (conveyor belt, NOT fixed reset)       | Rolling from first message |
| **7-day weekly cap**      | Total tokens across all sessions per week; exhausting this blocks access even if 5-hour window has room | Every 7 days from start    |

Token allocations (approximate):

| Plan               | 5-Hour Window | Weekly Cap         |
| ------------------ | ------------- | ------------------ |
| Pro ($20/mo)       | ~44K tokens   | 40-80 Sonnet hours |
| Max 5x (~$80/mo)   | ~88K tokens   | Moderate           |
| Max 20x (~$320/mo) | ~220K tokens  | 40 Opus hours      |

**No official API exists** to check remaining tokens programmatically. The orchestrator must track usage itself.

**Implementation Approach**:

1. **Self-Tracking**: Parse Claude Code subprocess output for token usage data. Each Claude Code invocation returns token counts in its response metadata. Sum these per task.

2. **Session File Parsing**: Claude Code writes JSONL session files locally containing per-request breakdowns:

   ```json
   {
     "modelUsage": {
       "inputTokens": 12500,
       "outputTokens": 3200,
       "cacheReadInputTokens": 8000,
       "cacheCreationInputTokens": 1500
     },
     "totalCostUSD": 0.042
   }
   ```

   The orchestrator reads the most recent session file and sums token usage since build start.

3. **Budget Calculation**: Users configure their plan in `kova.yaml`. The orchestrator calculates remaining tokens by subtracting cumulative usage from the plan's 5-hour allocation.

**Per-Task Output** (displayed after each task completes):

```
  [done] build-upload-api  sonnet  2m 18s
         Tokens: 18,420 input + 4,210 output = 22,630 total
         Session: 45,280 / 88,000 used (48.5%)  |  42,720 remaining
         Est. cost: $0.08 this task  |  $0.19 total build
```

**Build Summary Output** (displayed at end of build):

```
Build Complete: user-profile-editing.md

  Tasks: 7/7 passed
  Duration: 4m 22s

  Token Usage:
  ┌──────────────────────────┬─────────┬──────────┬─────────┐
  │ Task                     │ Input   │ Output   │ Total   │
  ├──────────────────────────┼─────────┼──────────┼─────────┤
  │ setup-storage-bucket     │ 8,200   │ 2,100    │ 10,300  │
  │ build-upload-api         │ 18,420  │ 4,210    │ 22,630  │
  │ build-profile-form       │ 15,800  │ 3,600    │ 19,400  │
  │ build-avatar-component   │ 12,300  │ 2,800    │ 15,100  │
  │ update-navigation        │ 5,400   │ 1,200    │ 6,600   │
  │ integration-tests        │ 14,200  │ 3,100    │ 17,300  │
  │ quality-validation       │ 11,600  │ 2,400    │ 14,000  │
  ├──────────────────────────┼─────────┼──────────┼─────────┤
  │ TOTAL                    │ 85,920  │ 19,410   │ 105,330 │
  └──────────────────────────┴─────────┴──────────┴─────────┘

  Session Budget:
    Plan: Max 5x (88,000 tokens / 5-hour window)
    Used this build: 105,330 tokens
    Window status: Rolling (started 1h 12m ago, resets in ~3h 48m)
    Weekly cap: 62% consumed

  Cost Estimate: $0.34 total
    Savings from model tiering: $0.82 (haiku for 2 tasks saved ~$0.48 vs all-sonnet)

  Next build budget: ~42,670 tokens available (assuming no other usage)
```

**Configuration**:

```yaml
# kova.yaml
usage_tracking:
  enabled: true # Enable token tracking
  plan: "max5" # User's Claude plan (pro, max5, max20, api)
  show_per_task: true # Show tokens after each task
  show_build_summary: true # Show full summary at build end
  show_cost_estimate: true # Show estimated cost
  warn_at_percent: 80 # Warn when session budget is 80% consumed
  pause_at_percent: 95 # Pause and ask before continuing at 95%
```

**Budget Warning** (when approaching limit):

```
  WARNING: Session budget at 82% (72,160 / 88,000 tokens used)
  Remaining tasks: 2 (est. ~25,000 tokens)
  This build may exceed your 5-hour window limit.

  Options:
    [C] Continue anyway
    [P] Pause and resume later (checkpoint saved)
    [S] Switch remaining tasks to haiku to save tokens
```

**Checkpoint Integration**: Token usage is persisted in the checkpoint file so `--resume` accurately reflects cumulative usage:

```json
{
  "plan": "user-profile-editing.md",
  "token_usage": {
    "total_input": 85920,
    "total_output": 19410,
    "total_combined": 105330,
    "cost_estimate_usd": 0.34,
    "per_task": {
      "setup-storage-bucket": {
        "input": 8200,
        "output": 2100,
        "model": "haiku"
      },
      "build-upload-api": { "input": 18420, "output": 4210, "model": "sonnet" }
    },
    "session_start": "2026-03-14T10:00:00Z",
    "plan_type": "max5",
    "window_allocation": 88000
  }
}
```

---

### 7.2 Phase 2: Resilience and Visibility

#### F2.1: File-Based Checkpointing

- Write checkpoint immediately after each task status change
- Include agent IDs for resume capability
- Support `--resume` flag to skip completed tasks after a crash
- Checkpoint survives Claude Code crashes, rate limits, and context compaction

#### F2.2: Live Progress Mode

- `kova build --live`: Real-time terminal dashboard
- Uses ink for React-based terminal rendering
- Updates every 5 seconds by reading checkpoint file
- Shows active agents, completed tasks, estimated time remaining

#### F2.3: Webhook Notifications

```yaml
# kova.yaml
notifications:
  on_build_start:
    discord: "https://discord.com/api/webhooks/..."
  on_build_complete:
    discord: "https://discord.com/api/webhooks/..."
    slack: "https://hooks.slack.com/services/..."
  on_build_fail:
    slack: "https://hooks.slack.com/services/..."
```

**Payload**:

```json
{
  "event": "build_complete",
  "plan": "user-profile-editing.md",
  "status": "success",
  "tasks_total": 7,
  "tasks_passed": 7,
  "tasks_failed": 0,
  "duration_seconds": 340,
  "models_used": { "haiku": 2, "sonnet": 4, "opus": 1 },
  "timestamp": "2026-03-14T10:05:40Z"
}
```

---

### 7.3 Phase 3: Enhanced Planning

#### F3.1: Plan Templates

Pre-built templates for common patterns:

| Template      | Phases                          | Typical Agents                  | Use Case                  |
| ------------- | ------------------------------- | ------------------------------- | ------------------------- |
| `feature`     | 3 (Foundation, Core, Polish)    | frontend + backend + quality    | New feature development   |
| `bugfix`      | 2 (Investigate, Fix)            | debugger + quality              | Bug investigation and fix |
| `refactor`    | 3 (Analyze, Refactor, Validate) | code-simplifier + quality       | Code improvement          |
| `migration`   | 3 (Schema, Data, Cleanup)       | supabase + backend + quality    | Database migration        |
| `security`    | 2 (Audit, Remediate)            | security-auditor + quality      | Security hardening        |
| `performance` | 2 (Profile, Optimize)           | performance-optimizer + quality | Performance improvement   |

```bash
kova plan --template feature "add user profiles"
kova plan --template bugfix "login redirect loop on mobile"
kova plan --template migration "add soft delete to all tables"
```

#### F3.2: Plan-and-Build Combined Command

```bash
# Single command: plan + approve + build
kova run "add user profiles"

# Equivalent to:
# kova plan "add user profiles"
# [user approves]
# kova build
```

Auto-selects `/build` vs `/team-build` based on task coupling analysis.

---

### 7.4 Phase 4: Multi-Engine Support

#### F4.1: Engine Abstraction

```yaml
# kova.yaml
engines:
  default: "claude-code"
  overrides:
    frontend-specialist: "cursor"
    backend-engineer: "claude-code"
    quality-engineer: "claude-code"
```

**Supported Engines** (Phase 4):

- `claude-code`: Full feature support (planning, specialization, dependencies, teams)
- `cursor`: Task execution only (no teams, no dependencies)
- `codex`: Task execution only
- `aider`: Task execution only

**Limitation**: `/team-build` (Agent Teams) remains Claude Code-only. Multi-engine only works with `/build` (hub-and-spoke) where the hub dispatches to different engines per agent.

---

### 7.5 Phase 5: Web Dashboard (Future)

#### F5.1: Dashboard Features

- **Plan Board**: Visual Kanban of tasks from active plans
- **Progress Monitor**: Real-time build progress with agent activity
- **Build History**: Timeline of past builds with duration, success rate, cost
- **Analytics**: Model usage, cost trends, success rate by agent type
- **Team Collaboration**: Shared plans, comments, approval workflows
- **Template Library**: Community-shared plan templates
- **Notification Center**: Webhook management and event history

#### F5.2: Dashboard Architecture

```
CLI (local)                      Dashboard (cloud)
─────────────                    ─────────────────
Runs Claude Code                 Reads event stream
Manages files                    Displays progress
Writes checkpoints ──event──→    Stores history
                     stream      Provides analytics
                                 Team collaboration
```

**Key principle**: The dashboard NEVER sees source code. It only receives:

- Plan structure (task names, dependencies, status)
- Execution events (task started, completed, failed)
- Timing and model usage data
- Validation results (pass/fail, no code content)

---

## 8. Configuration Specification

### 8.1 kova.yaml (Full Schema)

```yaml
# Kova Configuration
# Generated by: kova init
# Docs: https://github.com/[org]/kovaestrator

# Project metadata (auto-detected)
project:
  name: "my-project"
  language: "TypeScript"
  framework: "Next.js"
  package_manager: "pnpm"

# Model routing (auto or manual)
models:
  auto: true # Enable auto model selection
  trivial: "haiku" # Override for trivial tasks
  moderate: "sonnet" # Override for moderate tasks
  complex: "opus" # Override for complex tasks
  planning: "opus" # Model for /team-plan

# Quality gates
quality:
  test: "npm test" # Test command
  lint: "npm run lint" # Lint command
  typecheck: "npm run typecheck" # Type check command
  build: "npm run build" # Build command
  validate_after_each_task: false # Run quality gates per task
  validate_at_end: true # Run quality gates after all tasks

# Agent specialization (can override defaults)
agents:
  frontend: "frontend-specialist"
  backend: "backend-engineer"
  database: "supabase-specialist"
  testing: "quality-engineer"
  security: "security-auditor"
  performance: "performance-optimizer"

# File protection boundaries
boundaries:
  never_touch:
    - "*.lock"
    - ".env*"
    - "node_modules/**"

# Project rules (injected into all agent prompts)
rules:
  - "use server actions, not API routes"
  - "all database queries go through lib/services/"
  - "follow existing naming conventions"

# Execution preferences
execution:
  default_mode: "build" # "build" or "team-build"
  max_parallel_agents: 4
  enable_resume: true
  enable_agent_teams: false # Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
  task_timeout_seconds: 300 # Per-task timeout

# Notifications
notifications:
  on_build_complete:
    discord: null # Discord webhook URL
    slack: null # Slack webhook URL
    custom: null # Custom webhook URL

# Telemetry (anonymous, opt-in)
telemetry:
  enabled: false

# Plan validation
plan_validation:
  required_sections:
    - "Task Description"
    - "Objective"
    - "Relevant Files"
    - "Step by Step Tasks"
    - "Acceptance Criteria"
    - "Team Orchestration"
  require_dependencies: true
  require_acceptance_criteria: true
```

---

## 9. Scaffolded Files Detail

### 9.1 Files Created by `init`

| File                                                  | Source    | Customizable | Purpose                   |
| ----------------------------------------------------- | --------- | ------------ | ------------------------- |
| `.claude/commands/team-plan.md`                       | Template  | Yes          | Plan creation command     |
| `.claude/commands/build.md`                           | Template  | Yes          | Hub-and-spoke execution   |
| `.claude/commands/team-build.md`                      | Template  | Yes          | Agent Teams execution     |
| `.claude/skills/session-management/SKILL.md`          | Template  | Yes          | Session workflow          |
| `.claude/skills/sub-agent-invocation/SKILL.md`        | Template  | Yes          | Agent routing             |
| `.claude/hooks/Validators/validate-new-file.mjs`      | Template  | No           | Plan file validator       |
| `.claude/hooks/Validators/validate-file-contains.mjs` | Template  | No           | Plan section validator    |
| `.claude/agents/agent-rules.json`                     | Template  | Yes          | Agent activation triggers |
| `.claude/skills/skill-rules.json`                     | Template  | Yes          | Skill activation triggers |
| `.claude/settings.json`                               | Generated | Yes          | Hook configuration        |
| `.claude/tasks/`                                      | Directory | N/A          | Plan file storage         |
| `kova.yaml`                                           | Generated | Yes          | Project configuration     |
| `CLAUDE.md`                                           | Generated | Yes          | Project instructions      |

### 9.2 CLAUDE.md Generation

The generated `CLAUDE.md` combines:

1. Orchestration system instructions (how /team-plan, /build, /team-build work)
2. Project-specific configuration from auto-detection
3. User-defined rules from `kova.yaml`
4. Agent model tiering instructions
5. Quality gate configuration

---

## 10. User Flows

### 10.1 First-Time Setup

```
Developer installs:     npm install -g kovaestrator
Developer initializes:  cd my-project && kova init
System detects:         TypeScript, Next.js, pnpm, Supabase
System scaffolds:       .claude/ directory with all templates
Developer reviews:      kova.yaml (adjusts rules/boundaries)
Ready to use:           kova plan "my first task"
```

### 10.2 Daily Usage

```
Developer has a task:   "Add search to the product catalog"
Developer plans:        kova plan "add search to product catalog"
System creates plan:    .claude/tasks/product-search.md
Developer reviews:      Sees 5 tasks, 3 agents, dependency graph
Developer approves:     Y
System builds:          kova build (auto-starts)
Developer monitors:     Terminal shows real-time progress
System validates:       Quality engineer checks all acceptance criteria
System reports:         5/5 tasks passed, 4m 22s total
Developer commits:      git add . && git commit
```

### 10.3 Crash Recovery

```
Build running:          3/7 tasks complete, task 4 in progress
Claude Code crashes:    Rate limit / context overflow / network error
Developer restarts:     kova build --resume
System reads checkpoint: Skips tasks 1-3 (completed)
System resumes task 4:  Uses saved agent ID if available
Build continues:        Tasks 4-7 execute normally
```

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric           | Target       |
| ---------------- | ------------ |
| CLI startup time | < 200ms      |
| `init` command   | < 10 seconds |
| `status` command | < 500ms      |
| Checkpoint write | < 50ms       |
| Plan display     | < 1 second   |

### 11.2 Compatibility

| Requirement       | Specification              |
| ----------------- | -------------------------- |
| Node.js           | >= 18.0.0                  |
| Operating Systems | macOS, Linux, Windows 11   |
| Claude Code       | >= 1.0.0                   |
| Shell             | bash, zsh, PowerShell, cmd |
| Package Managers  | npm, yarn, pnpm, bun       |

### 11.3 Security

- No source code ever leaves the local machine
- No secrets stored in configuration files
- Webhook URLs stored in local config only
- Telemetry is anonymous and opt-in
- Dashboard (Phase 5) never receives code content
- All subprocess invocations use parameterized arguments (no shell injection)

### 11.4 Reliability

- Checkpoint files written atomically (write to temp, rename)
- Graceful handling of missing Claude Code CLI
- Graceful handling of missing configuration files
- Clear error messages with actionable suggestions
- No data loss on crash (checkpoint-based recovery)

---

## 12. Monetization Strategy

### 12.1 Phase 1: Free and Open Source

- npm package is free forever
- Open source on GitHub (MIT license)
- Goal: adoption and community building
- Revenue: $0 (investment phase)

### 12.2 Phase 2: Dashboard Freemium

| Tier           | Price   | Features                                                          |
| -------------- | ------- | ----------------------------------------------------------------- |
| **Free**       | $0/mo   | CLI (all features), 3 dashboard plan views/month                  |
| **Pro**        | $29/mo  | Unlimited dashboard, build history, analytics                     |
| **Team**       | $99/mo  | Pro + team collaboration, shared templates, 5 seats               |
| **Enterprise** | $299/mo | Team + SSO, audit logs, custom agent definitions, unlimited seats |

### 12.3 Revenue Projections (Conservative)

| Month | CLI Users | Dashboard Users | Paid Users | MRR     |
| ----- | --------- | --------------- | ---------- | ------- |
| 3     | 500       | 0               | 0          | $0      |
| 6     | 2,000     | 200             | 20         | $1,160  |
| 9     | 5,000     | 800             | 80         | $5,320  |
| 12    | 10,000    | 2,000           | 200        | $14,200 |

---

## 13. Implementation Roadmap

### Phase 1: CLI Foundation (Weeks 1-6)

| Week | Deliverable                                           |
| ---- | ----------------------------------------------------- |
| 1    | Project setup: TypeScript, Commander.js, tsup, Vitest |
| 1    | `init` command: auto-detection + scaffolding          |
| 2    | Template files: commands, skills, hooks, agents       |
| 2    | `config` command: view/set configuration              |
| 3    | `plan` command: Claude Code subprocess invocation     |
| 3    | `build` command: Claude Code subprocess invocation    |
| 4    | `status` command: checkpoint reading + display        |
| 4    | Auto model selection logic                            |
| 5    | Terminal UI: ink-based progress display               |
| 5    | Error handling, edge cases, crash recovery            |
| 6    | Documentation, README, examples                       |
| 6    | npm publish, GitHub repo setup                        |

### Phase 2: Resilience (Weeks 7-8)

| Week | Deliverable                                    |
| ---- | ---------------------------------------------- |
| 7    | File-based checkpointing with atomic writes    |
| 7    | `--resume` flag for crash recovery             |
| 8    | Webhook notifications (Discord, Slack, custom) |
| 8    | `team-build` command integration               |

### Phase 3: Enhanced Planning (Weeks 9-10)

| Week | Deliverable                                                                  |
| ---- | ---------------------------------------------------------------------------- |
| 9    | Plan templates (feature, bugfix, refactor, migration, security, performance) |
| 9    | `run` combined command (plan + approve + build)                              |
| 10   | `update` command (update templates from npm)                                 |
| 10   | Community feedback integration, bug fixes                                    |

### Phase 4: Multi-Engine (Weeks 11-14)

| Week  | Deliverable                              |
| ----- | ---------------------------------------- |
| 11-12 | Engine abstraction layer                 |
| 13-14 | Cursor and Codex adapter implementations |

### Phase 5: Web Dashboard (Weeks 15-26)

| Week  | Deliverable                                        |
| ----- | -------------------------------------------------- |
| 15-17 | Dashboard backend (event ingestion, storage)       |
| 18-20 | Dashboard frontend (plan board, progress, history) |
| 21-23 | Team collaboration features                        |
| 24-26 | Analytics, monetization, launch                    |

---

## 14. Risks and Mitigations

| Risk                                   | Probability | Impact | Mitigation                                                               |
| -------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------ |
| Claude Code CLI API changes            | Medium      | High   | Pin to Claude Code version ranges, abstract subprocess interface         |
| Agent Teams feature stays experimental | Medium      | Medium | `/build` (hub-and-spoke) works without it; `/team-build` is optional     |
| Ralphy captures market first           | Medium      | Medium | Differentiate on planning quality and specialist routing, not simplicity |
| Low npm adoption                       | Medium      | High   | Invest in documentation, examples, and community content                 |
| Checkpoint file corruption             | Low         | High   | Atomic writes, backup checkpoints, validation on read                    |
| Multi-engine adapters break            | Medium      | Medium | Phase 4 is optional; core value is Claude Code orchestration             |
| Dashboard development costs            | High        | Medium | Defer to Phase 5; validate demand with CLI-only first                    |

---

## 15. Open Questions

1. **Package name**: Decided -- `kova-cli` on npm, CLI command `kova`, mascot is the wolf pack.

2. **License**: MIT (maximum adoption) vs BSL (protects commercial use)? MIT recommended for Phase 1.

3. **Agent Teams dependency**: Should `/team-build` be included in MVP or deferred until Agent Teams is stable?

4. **Telemetry scope**: What anonymous data is acceptable to collect? Install count, command usage, model distribution, build success rate?

5. **Template versioning**: When we update templates, how do we handle users who customized their `.claude/` files? Merge strategy vs overwrite with backup?

6. **Dashboard tech stack**: Next.js + Supabase (familiar) vs lighter alternative (Hono + SQLite)?

7. **Pricing validation**: Are the proposed tiers ($29/$99/$299) aligned with developer willingness to pay? Need user research.

---

## 16. Appendix A: Competitive Feature Matrix

| Feature                | Kova              | Ralphy       | Aider     | Cursor  | Copilot    | Devin      |
| ---------------------- | ----------------- | ------------ | --------- | ------- | ---------- | ---------- |
| Planning phase         | Yes               | No           | No        | Partial | Partial    | Yes        |
| Specialist agents      | 17+ types         | No           | No        | No      | Role-based | Yes        |
| Task dependencies      | Explicit          | Implicit     | No        | No      | Linear     | Yes        |
| Contract-first teams   | Yes               | No           | No        | No      | No         | No         |
| Independent validation | Yes               | No           | No        | No      | Auto-retry | Yes        |
| Model tiering          | haiku/sonnet/opus | N/A          | Pluggable | Auto    | Auto       | Auto       |
| File protection        | Configurable      | Configurable | No        | No      | No         | Yes        |
| Crash recovery         | Checkpoint        | File-based   | Git       | Auto    | Cloud      | Cloud      |
| Multi-engine           | Phase 4           | 8 engines    | Pluggable | N/A     | N/A        | N/A        |
| Notifications          | Phase 2           | Yes          | No        | No      | GitHub     | Slack      |
| Web dashboard          | Phase 5           | No           | No        | N/A     | GitHub     | Yes        |
| Price                  | Free (CLI)        | Free         | Free      | $20/mo  | $10-19/mo  | $20-500/mo |
| Distribution           | npm               | npm          | pip       | IDE     | Extension  | SaaS       |

---

## 17. Appendix B: File Inventory from Source System

The following files from the Francis Myles International project's `.claude/` directory will be templated and packaged:

### Commands (3 files)

- `commands/team-plan.md` -- Plan creation with dependency graph and team composition
- `commands/build.md` -- Hub-and-spoke execution with isolated sub-agents
- `commands/team-build.md` -- Contract-first Agent Teams with peer-to-peer coordination

### Skills (2 core files)

- `skills/session-management/SKILL.md` -- 5-phase session workflow (assess, gather, plan, execute, commit)
- `skills/sub-agent-invocation/SKILL.md` -- Agent routing, parallel execution, resume patterns

### Hooks (4 files)

- `hooks/Validators/validate-new-file.mjs` -- Enforces plan file creation
- `hooks/Validators/validate-file-contains.mjs` -- Enforces required plan sections
- `hooks/FormatterHook/formatter.mjs` -- Auto-formats code after edits
- `hooks/SkillActivationHook/skill-activation-prompt.mjs` -- Recommends skills per prompt

### Configuration (3 files)

- `agents/agent-rules.json` -- 23 agent type definitions with keyword triggers
- `skills/skill-rules.json` -- 25+ skill activation rules
- `settings.json` -- Hook configuration and permissions

### Generated (2 files)

- `kova.yaml` -- Project-specific configuration (generated by `init`)
- `CLAUDE.md` -- Project instructions (generated by `init` from template + detection)

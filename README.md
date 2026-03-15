# Kova

**Plan the hunt. Run the pack.**

Kova is an AI coding orchestration CLI that coordinates specialized agents to plan, execute, and validate complex multi-file coding tasks. Unlike tools that use a single agent in a loop, Kova uses 17+ specialist agents with dependency-aware execution and independent quality validation.

## Quick Start

```bash
npm install -g kova-cli
cd your-project
kova init
kova plan "add user authentication with role-based access"
kova build
```

## Features

- **Planning before execution** - Analyze codebase, identify dependencies, design phased approach before writing code
- **17+ specialist agents** - Frontend, backend, database, security, performance, quality validation, and more
- **Explicit task dependencies** - Tasks wait for prerequisites; failed tasks block dependents
- **Model tiering** - Haiku for simple tasks, sonnet for moderate, opus for complex (3-10x cost savings vs. always using opus)
- **Checkpoint recovery** - Resume after crashes without losing progress or repeating work
- **Token usage tracking** - Per-task breakdown + build summary; budget warnings at 80% and 95%
- **Cross-platform** - macOS, Linux, Windows

## Commands

| Command                       | Purpose                                           | Key Flags                                         |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `kova init`                   | Initialize Kova in your project                   | `--force` - reinitialize                          |
| `kova plan <prompt>`          | Create an implementation plan with task graph     | `--output <path>` - save to custom location       |
| `kova build [plan-path]`      | Execute plan (hub-and-spoke)                      | `--dry-run`, `--skip-validation`, `--max-retries` |
| `kova team-build [plan-path]` | Execute plan with Agent Teams (peer coordination) | `--dry-run`, `--skip-validation`                  |
| `kova status`                 | Check build progress and task states              | `--verbose` - full task details                   |
| `kova config`                 | View/edit configuration                           | `--set key=value`, `--reset`                      |
| `kova reset`                  | Clear all state and start fresh                   | `--confirm`                                       |

## Configuration

Kova uses `kova.yaml` in your project root. Initialize with defaults:

```bash
kova init
```

Example `kova.yaml`:

```yaml
version: 1

project:
  name: "my-app"
  description: "TypeScript React + Node.js"
  root: "."

agents:
  default_model: "sonnet" # haiku, sonnet, or opus
  max_parallel_agents: 4
  retry_failed_agents: true
  timeout_minutes: 60

execution:
  mode: "build" # "build" or "team-build"
  require_validation: true
  token_budget: 500000 # warn at 80%, stop at 100%

codebase:
  language: "typescript"
  framework: "react"
  auto_detect: true

boundaries:
  protected_files:
    - ".env*"
    - "secrets/**"
    - "package-lock.json"
  allowed_paths:
    - "src/"
    - "lib/"
    - "functions/"
```

## Agent Types

| Agent                   | Specialty                         | Best For                                      | Default Model |
| ----------------------- | --------------------------------- | --------------------------------------------- | ------------- |
| `frontend-specialist`   | React, Vue, UI components         | Building screens, components, styling         | sonnet        |
| `backend-engineer`      | Node.js, APIs, business logic     | Services, routes, controllers                 | sonnet        |
| `supabase-specialist`   | PostgreSQL, migrations, RLS       | Database schema, queries, edge functions      | opus          |
| `quality-engineer`      | Testing, validation, code review  | Validating output against acceptance criteria | sonnet        |
| `security-auditor`      | Auth, encryption, vulnerabilities | Security-critical code, RLS policies          | opus          |
| `performance-optimizer` | Profiling, optimization, scaling  | Database indexes, API efficiency              | opus          |
| `general-purpose`       | All domains                       | Fallback for unspecialized work               | sonnet        |

## Model Tiering

Kova assigns models based on task complexity to optimize cost:

| Model    | Complexity | Cost per 1M tokens | When to Use                                                       |
| -------- | ---------- | ------------------ | ----------------------------------------------------------------- |
| `haiku`  | Trivial    | ~$0.80             | Single file edits, typos, config updates                          |
| `sonnet` | Moderate   | ~$3.00             | 2-5 file changes, bug fixes, standard CRUD                        |
| `opus`   | Complex    | ~$15.00            | Architecture decisions, security audits, multi-domain integration |

Tasks automatically select the appropriate model. Override in plan:

```yaml
tasks:
  - name: "Add login form"
    agent: "frontend-specialist"
    model: "haiku" # override default
```

## Token Tracking

Kova monitors token usage throughout your build:

```
Starting build...
[frontend-specialist] "Add login form" - estimated 12,500 tokens
[backend-engineer] "Create auth API" - estimated 28,000 tokens
...
Build complete.
Token summary:
  Total used: 184,300 / 500,000 (36.9%)
  By agent:
    frontend-specialist: 42,100
    backend-engineer: 78,200
    quality-engineer: 64,000
```

Warnings appear at 80% and 95% of budget. Set `token_budget` in `kova.yaml`.

## Workflow Example

### 1. Plan

```bash
$ kova plan "add stripe payment processing to give page"
Creating plan...

Analyzing codebase...
- Found 34 files in src/
- Identified app/give.tsx (current donate page)
- Detected Stripe publishable key already configured
- Found stripe-donate Edge Function

Designing solution...
Generated plan: /kova-plans/2026-03-14-stripe-payments.md

Plan summary:
  - 7 tasks across 4 agents
  - 3 phases (API updates, component, testing)
  - Estimated cost: ~85,000 tokens
  - Estimated time: 8 minutes
```

### 2. Review

Open the plan file and verify scope, task order, and blockers:

```yaml
# kova-plans/2026-03-14-stripe-payments.md
phase: 1
agent: backend-engineer
task: "Update donation API contract"
blockedBy: []
description: "..."
```

### 3. Build

```bash
$ kova build kova-plans/2026-03-14-stripe-payments.md
Executing plan...

Phase 1: Infrastructure
  [backend-engineer] "Update donation API contract"
    ✓ Completed (2m 15s, 18,400 tokens)

Phase 2: Frontend (blocked by Phase 1)
  [frontend-specialist] "Implement Stripe Elements"
    ✓ Completed (1m 48s, 22,100 tokens)
  [frontend-specialist] "Add payment form validation"
    ✓ Completed (42s, 8,900 tokens)

Phase 3: Validation (blocked by Phase 2)
  [quality-engineer] "Validate payment flow"
    ✓ Completed (3m 22s, 14,200 tokens)

Build complete: SUCCESS
Total time: 8m 47s
Total tokens: 63,600 / 500,000 (12.7%)
```

### 4. Validate

The `quality-engineer` automatically validates all changes against acceptance criteria. Review the validation report:

```bash
$ kova status --verbose
Build: PASSED
Quality validation: PASSED

Changes:
  Modified: 3 files
  Created: 0 files
  Deleted: 0 files

Git diff ready. Commit with:
  $ git add . && git commit -m "feat: add stripe payment processing to give page"
```

## Requirements

- **Node.js** >= 18
- **Claude Code CLI** installed and authenticated (`claude --version` should work)
- **Git** repository in your project

## Installation

```bash
npm install -g kova-cli
```

Or use directly without global install:

```bash
npx kova-cli init
npx kova-cli plan "your prompt"
npx kova-cli build
```

## Authentication

Kova uses Claude Code's authentication. Ensure you're logged in:

```bash
claude login
```

Kova will read your Claude session and use your configured API key.

## Documentation

- [Full User Guide](./docs/GUIDE.md) - Detailed walkthrough of all commands and workflows
- [Plan File Reference](./docs/PLAN-REFERENCE.md) - YAML schema for plan files
- [Agent Reference](./docs/AGENTS.md) - Capabilities of each agent type
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Product Requirements](./PRD.md) - Full product vision and roadmap

## Contributing

Contributions welcome. Please open an issue first to discuss.

```bash
git clone https://github.com/klokare/kova-cli
cd kova-cli
npm install
npm run dev
```

## License

MIT

## Tagline

Plan the hunt. Run the pack.

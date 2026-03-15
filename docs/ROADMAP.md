# Kova Improvement Roadmap

**Last Updated**: 2026-03-14
**Current Version**: 0.1.0 (Phase 1 + Phase 2 complete)
**Total Tests**: 156 passing

## Current State

Kova CLI is a working npm package with:

- 7 CLI commands (init, plan, build, team-build, status, config, version)
- Auto-detection of project type (language, framework, PM, database, auth, payments)
- Template scaffolding (.claude/ directory with commands, skills, hooks, agents)
- Checkpoint-based progress tracking with crash recovery (--resume)
- Token usage tracking with budget warnings (80%, 95% thresholds)
- Webhook notifications (Discord, Slack, custom)
- Live progress monitoring (--live flag)
- Cross-platform support (Windows, macOS, Linux)
- Auto model selection (haiku/sonnet/opus based on task complexity)
- 156 passing tests, 0 flaky

## Recommended Build Order

The tiers are ordered by impact-per-effort ratio, not by tier number:

```
Tier 3 (Quick Wins)         -- 1 week    -- NEXT
Tier 1 (UX Fundamentals)    -- 2-3 weeks -- After Tier 3
Tier 2 (GitHub Integration) -- 2-3 weeks -- After Tier 1
Tier 4 (Plugin System)      -- 3-4 weeks -- After adoption validation
Tier 5 (VS Code Extension)  -- 3-4 weeks -- Parallel with Tier 4
Tier 6 (Web Dashboard)      -- 8-12 weeks -- After Tiers 1-3 prove adoption
```

---

## Tier 3: Quick Wins (Priority 1 -- ~1 week)

Already specified in the PRD. Highest ROI features that can ship immediately.

### 3.1 Combined `kova run` Command

**What**: Single command that chains plan + approve + build.
**Why**: Fastest path from idea to code. Reduces 3 commands to 1.
**How**: `kova run "add user profiles"` invokes plan, shows summary, asks Y/n, then builds.
**Effort**: Small (2-3 days)
**Impact**: High

```bash
# Before (3 steps)
kova plan "add user profiles"
# review...
kova build

# After (1 step)
kova run "add user profiles"
```

Auto-selects build vs team-build based on task coupling analysis in the plan.

### 3.2 Plan Templates

**What**: Pre-built templates for common patterns.
**Why**: Faster planning, consistent structure, lower learning curve.
**How**: `kova plan --template feature "add user profiles"`
**Effort**: Small (2-3 days)
**Impact**: Medium

| Template      | Phases                          | Typical Agents                  | Use Case                  |
| ------------- | ------------------------------- | ------------------------------- | ------------------------- |
| `feature`     | 3 (Foundation, Core, Polish)    | frontend + backend + quality    | New feature development   |
| `bugfix`      | 2 (Investigate, Fix)            | debugger + quality              | Bug investigation and fix |
| `refactor`    | 3 (Analyze, Refactor, Validate) | code-simplifier + quality       | Code improvement          |
| `migration`   | 3 (Schema, Data, Cleanup)       | supabase + backend + quality    | Database migration        |
| `security`    | 2 (Audit, Remediate)            | security-auditor + quality      | Security hardening        |
| `performance` | 2 (Profile, Optimize)           | performance-optimizer + quality | Performance improvement   |

### 3.3 `kova update` Command

**What**: Update scaffolded templates from the latest npm version.
**Why**: When Kova ships improved command/skill/hook templates, users can update without re-init.
**How**: `kova update` diffs local templates against package templates, shows changes, applies.
**Effort**: Small (1-2 days)
**Impact**: Medium

```bash
kova update
# Checking for template updates...
# Updated: commands/team-plan.md (15 lines changed)
# Updated: hooks/Validators/validate-new-file.mjs (3 lines changed)
# Skipped: settings.json (locally modified)
# 2 files updated, 1 skipped.
```

---

## Tier 1: UX Fundamentals (Priority 2 -- ~2-3 weeks)

Table-stakes features that every mature CLI tool ships in 2026.

### 1.1 Interactive Mode

**What**: `kova init` uses interactive prompts (inquirer-style) instead of requiring all flags.
**Why**: Reduces learning curve 10x. New users discover options naturally.
**How**: Use `@inquirer/prompts` package for select, confirm, text inputs.
**Effort**: Medium (3-5 days)
**Impact**: High

```bash
kova init
# ? What is your project name? (my-project)
# ? Detected TypeScript + Next.js. Correct? (Y/n)
# ? Which database are you using? (Supabase / Prisma / Drizzle / None)
# ? Enable webhook notifications? (y/N)
```

### 1.2 Shell Completions

**What**: Tab-completion for bash, zsh, and fish shells.
**Why**: 80% faster command discovery. Professional feel.
**How**: Generate completion scripts via Commander.js or custom. `kova completions bash >> ~/.bashrc`
**Effort**: Small (2-3 days)
**Impact**: High

### 1.3 Auto-Update Check

**What**: On CLI startup, check npm registry for newer version. Show banner if update available.
**Why**: Users stay current without manual checking.
**How**: Cache check result for 24 hours. Use `npm view kova-cli version` or registry API.
**Effort**: Small (1-2 days)
**Impact**: Medium

```bash
kova status
# Update available: 0.1.0 -> 0.2.0
# Run: npm install -g kova-cli
```

### 1.4 Better Error Suggestions

**What**: Actionable error messages with typo correction and docs links.
**Why**: Self-serve fixes reduce friction and support burden.
**How**: Levenshtein distance for command suggestions, link to docs in errors.
**Effort**: Medium (2-3 days)
**Impact**: High

```bash
kova pln "add feature"
# Unknown command: pln. Did you mean "plan"?
# Run: kova plan "add feature"
# Docs: https://github.com/kova-cli/kova#commands
```

---

## Tier 2: GitHub Integration (Priority 3 -- ~2-3 weeks)

The #1 adoption multiplier. Completes the "plan to ship" workflow.

### 2.1 `kova pr` Command

**What**: Auto-create a GitHub PR from the last build.
**Why**: Zero-friction workflow from plan to PR. Ralphy already has this.
**How**: Uses `gh` CLI under the hood. Detects branch, generates title/body from plan.
**Effort**: Medium (5-7 days)
**Impact**: Very High

```bash
kova pr
# Creating PR from branch: feat/user-profiles
# Title: Add user profile editing with avatar upload
# Body: Generated from plan (7 tasks, 4 agents, all passed)
# PR #42 created: https://github.com/org/repo/pull/42
```

### 2.2 Issue Linking

**What**: `kova plan --issue 42` pulls GitHub issue description as context.
**Why**: Plans grounded in real requirements, audit trail automation.
**How**: Uses `gh issue view 42 --json` to fetch issue body, inject into plan prompt.
**Effort**: Small (2-3 days)
**Impact**: High

### 2.3 Branch Management

**What**: `kova plan` auto-creates a feature branch from the plan name.
**Why**: Clean git workflow, no manual branch creation.
**How**: `git checkout -b feat/<plan-name>` before invoking Claude.
**Effort**: Small (1-2 days)
**Impact**: Medium

---

## Tier 4: Plugin System + Config Sharing (Priority 4 -- ~3-4 weeks)

Transforms Kova from a tool into a platform.

### 4.1 Plugin System

**What**: Community-contributed agents, hooks, and templates as npm packages.
**Why**: Ecosystem multiplier. ESLint's plugin model drove massive adoption.
**How**: `kova-plugin-*` npm naming convention. Plugins export agents, templates, or hooks.
**Effort**: Large (2-3 weeks)
**Impact**: Very High

```bash
npm install kova-plugin-nextjs
# Adds: Next.js-specific agents, plan templates, and quality checks
```

### 4.2 Shared Config

**What**: `extends: "@company/kova-config"` in kova.yaml.
**Why**: Teams standardize rules, agents, boundaries across all projects.
**How**: Like ESLint's `extends` -- merge base config with local overrides.
**Effort**: Medium (1 week)
**Impact**: High

### 4.3 Opt-in Telemetry

**What**: Anonymous usage analytics (command frequency, model distribution, build success rate).
**Why**: Understand what features matter. Data-driven roadmap decisions.
**How**: Privacy-first, opt-in only. Hash project IDs. No code content ever sent.
**Effort**: Small (2-3 days)
**Impact**: Medium

---

## Tier 5: VS Code Extension (Priority 5 -- ~3-4 weeks, parallel track)

63% of Claude Code adoption is IDE-driven. This is the distribution multiplier.

### 5.1 VS Code Sidebar

**What**: Kova panel in VS Code showing plan board, build progress, status.
**Why**: Developers live in VS Code. Meeting them where they are.
**How**: VS Code extension with webview panel. Reads checkpoint files for status.
**Effort**: Large (3-4 weeks)
**Impact**: Very High

### 5.2 Context Menu Integration

**What**: Right-click a file or folder, "Plan with Kova", "Build with Kova".
**Why**: Zero-friction entry point from file explorer.
**Effort**: Medium (1 week, part of extension)
**Impact**: High

### 5.3 Status Bar

**What**: Build progress in VS Code status bar (icon + percentage).
**Why**: Always-visible progress without switching to terminal.
**Effort**: Small (part of extension)
**Impact**: Medium

---

## Tier 6: Web Dashboard (Priority 6 -- ~8-12 weeks)

The monetization unlock. Build only after Tiers 1-3 prove adoption.

### 6.1 Build History and Analytics

**What**: Persistent history of all builds with duration, token costs, success rates.
**Why**: Core monetization driver. Teams need visibility across projects.
**How**: Next.js + Supabase dashboard. CLI streams events via webhook.
**Effort**: Large (2-3 weeks)
**Impact**: Very High
**Revenue**: Core feature of $29/month Team plan

### 6.2 Team Collaboration

**What**: Shared plans, approval workflows, progress visibility across team members.
**Why**: Team adoption requires shared state. Individual tool -> team tool.
**How**: Real-time sync via Supabase Realtime. Plan comments and approvals.
**Effort**: Large (2-3 weeks)
**Impact**: Very High
**Revenue**: Core feature of $29/month Team plan

### 6.3 Token Usage Dashboard

**What**: Visual dashboard showing cost trends, model distribution, optimization suggestions.
**Why**: Transparent costs drive trust and upgrades.
**How**: Charts showing daily/weekly token usage, cost by model, efficiency trends.
**Effort**: Medium (1-2 weeks)
**Impact**: High
**Revenue**: Upsell feature (highlights savings from model tiering)

### 6.4 Template Marketplace

**What**: Community-shared plan templates browsable from the dashboard.
**Why**: Network effect. Contributors attract users.
**How**: Submit templates via GitHub PR or dashboard. Browse and install via CLI or web.
**Effort**: Medium (2-3 weeks)
**Impact**: High
**Revenue**: Free tier feature that drives adoption

---

## Revenue Model

### Pricing Tiers

| Tier           | Price   | Features                                                            |
| -------------- | ------- | ------------------------------------------------------------------- |
| **Free**       | $0/mo   | CLI (all features), local build history, community templates        |
| **Pro**        | $29/mo  | Cloud build history, token analytics, unlimited webhook channels    |
| **Team**       | $99/mo  | Pro + team collaboration, shared plans, approval workflows, 5 seats |
| **Enterprise** | $299/mo | Team + SSO, audit logs, custom agents, unlimited seats              |

### Revenue Projections (Conservative)

| Month | CLI Users | Paid Users | MRR     |
| ----- | --------- | ---------- | ------- |
| 3     | 500       | 0          | $0      |
| 6     | 2,000     | 20         | $1,160  |
| 9     | 5,000     | 80         | $5,320  |
| 12    | 10,000    | 200        | $14,200 |

---

## Success Metrics

| Milestone            | Target | Timeframe |
| -------------------- | ------ | --------- |
| npm weekly downloads | 1,000  | Month 2   |
| GitHub stars         | 500    | Month 3   |
| npm weekly downloads | 5,000  | Month 6   |
| GitHub stars         | 2,000  | Month 9   |
| First paying team    | 1      | Month 7   |
| MRR                  | $5,000 | Month 9   |
| Community plugins    | 10     | Month 12  |

---

## Risk Assessment

| Risk                           | Probability | Impact | Mitigation                                  |
| ------------------------------ | ----------- | ------ | ------------------------------------------- |
| Claude Code CLI API changes    | Medium      | High   | Abstract subprocess interface, pin versions |
| Ralphy captures market first   | Medium      | Medium | Differentiate on planning + specialization  |
| Low adoption                   | Medium      | High   | Ship Tier 1 UX first, measure, iterate      |
| Agent Teams stays experimental | Medium      | Low    | /build works without it                     |
| Dashboard costs exceed revenue | Medium      | Medium | Defer dashboard until CLI proves adoption   |

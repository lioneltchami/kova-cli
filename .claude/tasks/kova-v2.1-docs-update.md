# Plan: Kova v2.1.0 Documentation & Website Update

## Task Description

Update all Kova documentation across two repositories (kova-cli and kova-website) to reflect the v2.1.0 release. This includes new command docs, guide pages, configuration reference updates, changelog entry, README updates, landing page copy, and sidebar navigation.

## Objective

When complete, every v2.1.0 feature (run, chat, history, bench, hook, mcp, smart fallback, budget guard, multi-file context) is fully documented on kova.dev and in the CLI README. Users can discover, learn, and use all new features from the docs alone.

## Problem Statement

The v2.1.0 release added 8 major features and 6 new CLI commands but the documentation website and README still reflect v1.0/v0.4.x. Users cannot discover or learn about `kova run`, `kova chat`, `kova history`, `kova bench`, `kova hook`, `kova mcp`, smart model fallback, budget guards, or multi-file context loading.

## Solution Approach

Create documentation pages following existing patterns (MDX format with frontmatter, Usage/Flags/Examples/Related sections), update navigation, changelog, landing page copy, and configuration references. Work across two repos: kova-cli (README) and kova-website (all web content).

## Relevant Files

### Existing Files to Update

**kova-cli repo (`/Users/lionel/builders/kova-cli/`):**

- `README.md` - Add v2.1 commands (run, chat, history, bench, hook, mcp) to command tables, update version badge

**kova-website repo (`/Users/lionel/builders/kova-website/`):**

- `content/docs/meta.json` - Add new command and guide entries to sidebar navigation
- `content/docs/index.mdx` - Add v2.1 commands to the commands table
- `content/docs/getting-started/configuration.mdx` - Add orchestration config section (fallback, session_budget)
- `content/docs/commands/config.mdx` - Add orchestration keys to key reference table
- `content/docs/getting-started/quickstart.mdx` - Add `kova run` to quick workflow
- `app/changelog/page.tsx` - Add v2.1.0 changelog entry at top
- `messages/en.json` - Update hero badge to v2.1, update stat values (11 tools, etc.)
- `components/landing/quick-start.tsx` - Update code tabs to show FinOps workflow (track/costs/run)

### New Files to Create

**kova-website repo (`/Users/lionel/builders/kova-website/content/docs/`):**

- `commands/run.mdx` - AI coding task execution command
- `commands/chat.mdx` - Interactive AI chat REPL command
- `commands/history.mdx` - Session history viewer command
- `commands/bench.mdx` - Model benchmarking command
- `commands/hook.mdx` - Claude Code hook installer command
- `commands/mcp.mdx` - MCP server command
- `guides/model-fallback.mdx` - Smart model fallback guide
- `guides/mcp-integration.mdx` - MCP server integration guide

## Implementation Phases

### Phase 1: Foundation (New Command Docs)

Create 6 new MDX command documentation pages following the established pattern from existing docs (frontmatter, Usage, Flags table, Examples with output, Related links). Each page must be complete and accurate based on the actual CLI implementation.

### Phase 2: Guide Pages & Config Updates

Create 2 new guide pages for the cross-cutting v2.1 features (model fallback, MCP integration). Update configuration docs to include the new `orchestration.fallback` and `orchestration.session_budget` config keys.

### Phase 3: Navigation, Changelog & Landing

Wire everything together: update meta.json sidebar, docs index table, changelog, README, landing page i18n, and quick-start component.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.

### Team Members

- Specialist
  - Name: docs-writer-commands
  - Role: Create the 6 new command MDX documentation pages (run, chat, history, bench, hook, mcp)
  - Agent Type: content-writer
  - Resume: true

- Specialist
  - Name: docs-writer-guides
  - Role: Create the 2 new guide pages (model-fallback, mcp-integration) and update configuration docs
  - Agent Type: content-writer
  - Resume: true

- Specialist
  - Name: site-updater
  - Role: Update meta.json, index.mdx, changelog, README, landing page i18n, quick-start component
  - Agent Type: frontend-specialist
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate all documentation is accurate, links work, sidebar renders correctly, no broken pages
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Create Command Documentation Pages

- **Task ID**: create-command-docs
- **Depends On**: none
- **Assigned To**: docs-writer-commands
- **Agent Type**: content-writer
- **Parallel**: true (can run alongside task 2)
- Create `/Users/lionel/builders/kova-website/content/docs/commands/run.mdx` with:
  - Frontmatter: title "kova run", description about AI coding task execution
  - Describe the command: executes an AI coding task with intelligent model routing
  - Usage: `kova run <prompt> [flags]`
  - Flags table: `--model <id>`, `--provider <name>`, `--tier <tier>` (cheap/mid/strong), `--dry-run`, `--auto-apply`, `--context <file>` (repeatable), `--include <glob>` (repeatable), `--budget <usd>`
  - Examples: basic prompt, with model override, with context files, with glob includes, with budget cap, dry-run mode
  - Show example output (streaming response with cost summary)
  - Related links to chat, bench, configuration
- Create `/Users/lionel/builders/kova-website/content/docs/commands/chat.mdx` with:
  - Interactive AI coding chat REPL
  - Usage: `kova chat [flags]`
  - Flags: `--model <id>`, `--provider <name>`, `--tier <tier>`, `--budget <usd>`
  - Examples: basic chat, with budget, with specific model
  - Describe REPL commands: `/cost`, `/model`, `/clear`, `/quit`
  - Related links to run, bench
- Create `/Users/lionel/builders/kova-website/content/docs/commands/history.mdx` with:
  - View past AI session history with costs
  - Usage: `kova history [flags]`
  - Flags: `--tool <tool>`, `--project <name>`, `--days <n>` (default 30), `--limit <n>` (default 50)
  - Examples: basic history, filter by tool, filter by project, last 7 days
  - Show example table output
  - Related links to costs, report
- Create `/Users/lionel/builders/kova-website/content/docs/commands/bench.mdx` with:
  - Benchmark a prompt against multiple models
  - Usage: `kova bench <prompt> [flags]`
  - Flags: `--models <list>` (comma-separated), `--no-tools` (disable tools for pure text)
  - Examples: default benchmark, specific models, no-tools mode
  - Show example comparison table output
  - Related links to run, models, history
- Create `/Users/lionel/builders/kova-website/content/docs/commands/hook.mdx` with:
  - Install Claude Code integration hook for automatic cost tracking
  - Usage: `kova hook [action]`
  - Describe: installs a PostToolUse Stop hook in .claude/settings.json that runs `kova track` after each Claude Code tool use
  - Examples: install hook, show what gets added
  - Show the hook JSON template
  - Related links to track, configuration
- Create `/Users/lionel/builders/kova-website/content/docs/commands/mcp.mdx` with:
  - Start Kova as an MCP (Model Context Protocol) server
  - Usage: `kova mcp`
  - Describe: exposes Kova cost data as MCP resources and tools for AI assistants
  - List resources: costs-today, costs-week, budget-status
  - List tools: get_costs, budget_check, track_usage
  - Examples: start server, configure in Claude Desktop
  - Related links to mcp-integration guide

**IMPORTANT FORMAT REFERENCE**: Follow the exact MDX pattern from existing command docs like `/Users/lionel/builders/kova-website/content/docs/commands/compare.mdx`. Use the same frontmatter format, heading structure, flag table format, example blocks with output, and Related section.

### 2. Create Guide Pages & Update Config Docs

- **Task ID**: create-guides-update-config
- **Depends On**: none
- **Assigned To**: docs-writer-guides
- **Agent Type**: content-writer
- **Parallel**: true (can run alongside task 1)
- Create `/Users/lionel/builders/kova-website/content/docs/guides/model-fallback.mdx` with:
  - Title: "Smart Model Fallback"
  - Explain how Kova automatically falls back to cheaper models on 429/5xx errors
  - Document the fallback chains: opus->sonnet->haiku, o3->gpt-4o->gpt-4.1-mini, gpt-4o->gpt-4.1-mini->gpt-4.1-nano, gpt-4.1->gpt-4.1-mini->gpt-4.1-nano, gemini-2.5-pro->gemini-2.5-flash
  - Explain retryable error detection (429, rate limit, 500/502/503, overloaded, capacity)
  - Show how to enable/disable: `kova config set orchestration.fallback true|false`
  - Show how it works with `kova run` and `kova chat`
  - 1-second delay between retries
  - Related links to run, chat, configuration
- Create `/Users/lionel/builders/kova-website/content/docs/guides/mcp-integration.mdx` with:
  - Title: "MCP Server Integration"
  - Explain what MCP is and why it's useful (AI assistants can query your cost data)
  - Show how to start: `kova mcp`
  - Document all 3 resources with their URIs and what data they return
  - Document all 3 tools with their input schemas and return values
  - Show Claude Desktop configuration example (JSON snippet for mcpServers)
  - Show integration with other MCP clients
  - Related links to mcp command, budget, costs
- Update `/Users/lionel/builders/kova-website/content/docs/getting-started/configuration.mdx`:
  - Add an `orchestration` section to the Global Config Overview JSON
  - Add orchestration section reference with table: `fallback` (boolean, default true), `session_budget` (number, optional, USD)
  - Add Common Configuration Tasks examples for orchestration settings
- Update `/Users/lionel/builders/kova-website/content/docs/commands/config.mdx`:
  - Add `orchestration.fallback` and `orchestration.session_budget` to the Key Reference table
  - Add example for setting orchestration config

### 3. Update Navigation, Index & Cross-References

- **Task ID**: update-navigation-index
- **Depends On**: create-command-docs, create-guides-update-config
- **Assigned To**: site-updater
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Update `/Users/lionel/builders/kova-website/content/docs/meta.json`:
  - Add to Core Commands section (after "commands/report"): `commands/run`, `commands/chat`
  - Add new section `---AI Orchestration---` with: `commands/run`, `commands/chat`, `commands/history`, `commands/bench`, `commands/hook`, `commands/mcp`
  - OR add to existing sections logically: run/chat/bench/history under Core Commands, hook/mcp under Account or a new Integration section
  - Add to Guides section: `guides/model-fallback`, `guides/mcp-integration`
  - **Decision**: Add a new `---AI & Orchestration---` section after Core Commands with run, chat, history, bench, hook, mcp. Add guides to Guides section.
- Update `/Users/lionel/builders/kova-website/content/docs/index.mdx`:
  - Add to Commands table: `kova run`, `kova chat`, `kova history`, `kova bench`, `kova hook`, `kova mcp`
  - Add to Guides list: Model Fallback, MCP Integration links
- Update `/Users/lionel/builders/kova-website/content/docs/getting-started/quickstart.mdx`:
  - Mention `kova run` as the AI coding command in the workflow

### 4. Update Changelog

- **Task ID**: update-changelog
- **Depends On**: create-command-docs, create-guides-update-config
- **Assigned To**: site-updater
- **Agent Type**: frontend-specialist
- **Parallel**: false (same agent as task 3, sequential)
- Update `/Users/lionel/builders/kova-website/app/changelog/page.tsx`:
  - Add v2.1.0 entry at the TOP of the entries array with date "2026-03-20", version "2.1.0", title "AI Orchestration & Smart Fallback", tags ["feature"]
  - Changes list:
    - "`kova run` -- execute AI coding tasks with intelligent model routing and multi-file context"
    - "`kova chat` -- interactive AI coding REPL with session budget tracking"
    - "`kova history` -- view past AI session history with costs and filtering"
    - "`kova bench` -- benchmark prompts against multiple models side-by-side"
    - "`kova hook` -- install Claude Code integration hooks for automatic tracking"
    - "`kova mcp` -- expose cost data as an MCP server for AI assistants"
    - "Smart model fallback -- automatic retry with cheaper models on 429/5xx errors"
    - "Session budget guard -- real-time spend tracking with 80% warning and 100% hard stop"
    - "Multi-file context loading -- attach files and glob patterns to `kova run` prompts"
    - "56 new tests (731 total), zero failures"

### 5. Update README

- **Task ID**: update-readme
- **Depends On**: none
- **Assigned To**: site-updater
- **Agent Type**: frontend-specialist
- **Parallel**: true (can run alongside tasks 1-2)
- Update `/Users/lionel/builders/kova-cli/README.md`:
  - Add to Commands table: `kova run` (Execute AI coding tasks with model routing), `kova chat` (Interactive AI coding REPL), `kova history` (View past AI sessions with costs), `kova bench` (Benchmark prompts across models), `kova hook` (Install Claude Code integration hooks), `kova mcp` (Start MCP server for AI assistants)
  - Add a new section "## AI Orchestration" after Commands describing:
    - Smart model fallback (automatic retry on rate limits)
    - Session budget guards (real-time spend caps)
    - Multi-file context loading (--context and --include flags)
  - Update Quick Start to mention `kova run` as the AI coding command

### 6. Update Landing Page

- **Task ID**: update-landing
- **Depends On**: none
- **Assigned To**: site-updater
- **Agent Type**: frontend-specialist
- **Parallel**: true (can run alongside tasks 1-2)
- Update `/Users/lionel/builders/kova-website/messages/en.json`:
  - Change `hero.badge` from `"v1.0 -- Open Source"` to `"v2.1 -- Open Source"`
  - Change `hero.stat1Value` from `"5"` to `"11"` (11 AI tools tracked)
  - Update `hero.phrase1` to mention 11 tools
  - Update `pricing.faq5A` to list all 11 tools
  - Update `pricing.tierProDescription` to say "All 11 AI tools tracked" instead of "All 5 AI tools"
- Update `/Users/lionel/builders/kova-website/components/landing/quick-start.tsx`:
  - Update tabs to reflect FinOps workflow: Install, Track, Costs, Run, Dashboard
  - Tab 1 (Install): keep as-is
  - Tab 2 (Track): `kova init` then `kova track`
  - Tab 3 (Costs): `kova costs --week` with example output
  - Tab 4 (Run): `kova run "fix the auth bug" --budget 2.00` with example output
  - Tab 5 (Dashboard): `kova sync` then `kova dashboard`

### 7. Final Validation

- **Task ID**: validate-all
- **Depends On**: create-command-docs, create-guides-update-config, update-navigation-index, update-changelog, update-readme, update-landing
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Verify all 6 new command MDX files exist and have correct frontmatter
- Verify all 2 new guide MDX files exist and have correct frontmatter
- Verify meta.json is valid JSON and references all new pages
- Verify index.mdx commands table includes all v2.1 commands
- Verify changelog has v2.1.0 entry at the top
- Verify README.md has all v2.1 commands in the table
- Verify en.json is valid JSON
- Verify configuration.mdx includes orchestration section
- Verify config.mdx key reference includes orchestration keys
- Run `cd /Users/lionel/builders/kova-website && pnpm build` to verify no broken pages
- Run `cd /Users/lionel/builders/kova-cli && pnpm build` to verify CLI still builds
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

- [ ] 6 new command MDX pages created (run, chat, history, bench, hook, mcp)
- [ ] 2 new guide MDX pages created (model-fallback, mcp-integration)
- [ ] meta.json sidebar includes all new pages in logical sections
- [ ] index.mdx commands table lists all v2.1 commands
- [ ] configuration.mdx documents orchestration config keys
- [ ] config.mdx key reference includes orchestration.fallback and orchestration.session_budget
- [ ] changelog has v2.1.0 entry with all 10 changes listed
- [ ] README.md command table includes all 6 new commands
- [ ] en.json hero badge shows v2.1, stat shows 11 tools
- [ ] quick-start.tsx tabs reflect current FinOps workflow
- [ ] kova-website builds successfully with no errors
- [ ] kova-cli builds successfully with no errors
- [ ] All internal doc links resolve correctly

## Validation Commands

Execute these commands to validate the task is complete:

- `cd /Users/lionel/builders/kova-website && pnpm build` - Verify the website builds without broken pages
- `cd /Users/lionel/builders/kova-cli && pnpm build` - Verify CLI still builds
- `cat /Users/lionel/builders/kova-website/content/docs/meta.json | python3 -m json.tool` - Verify meta.json is valid JSON
- `cat /Users/lionel/builders/kova-website/messages/en.json | python3 -m json.tool` - Verify en.json is valid JSON
- `ls /Users/lionel/builders/kova-website/content/docs/commands/{run,chat,history,bench,hook,mcp}.mdx` - Verify all 6 new command docs exist
- `ls /Users/lionel/builders/kova-website/content/docs/guides/{model-fallback,mcp-integration}.mdx` - Verify both guide docs exist

## Notes

- The kova-website uses Fumadocs (Next.js + MDX) with meta.json for sidebar navigation
- All MDX pages follow a consistent pattern: frontmatter (title, description), h1 heading, description paragraph, Usage section, Flags table, Examples with code blocks and output, Related links
- The landing page uses next-intl for i18n -- all text lives in messages/en.json
- The quick-start component has hardcoded tab content (not i18n)
- The changelog is a React component with a typed entries array, not MDX
- Source files for CLI commands are in `/Users/lionel/builders/kova-cli/src/commands/` and `/Users/lionel/builders/kova-cli/src/index.ts` -- reference these for accurate flag names and descriptions

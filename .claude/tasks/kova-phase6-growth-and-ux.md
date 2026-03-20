# Plan: Kova Phase 6 -- Growth, Differentiation, and UX

## Task Description

Phase 6 transforms Kova from a production-grade platform into a growth engine. The product is now technically solid (413 CLI tests, 86 website tests, full security hardening, rate limiting, Sentry, Resend emails, Polar.sh payments). Phase 6 focuses entirely on: (1) making the first-run experience so good that new users immediately see value, (2) adding the UX polish and power features that turn casual users into paying customers, (3) building integrations that embed Kova into developer workflows (GitHub, Slack, CI/CD), and (4) adding analytics intelligence that justifies the paid tier.

This plan covers both repos: `C:/PROJ/kova-cli/` and `C:/PROJ/kova-website/`.

## Objective

Deliver 7 high-impact growth features organized across both repos:

1. **CLI UX Polish**: `kova compare`, `kova open`, interactive TUI mode, richer output with project grouping, and an improved first-run experience
2. **Onboarding & Empty States**: Guided setup wizard in the dashboard, meaningful empty state components with actionable next steps, progress indicators for new users
3. **Conversion Optimization**: Usage-limit nudges, contextual upgrade prompts, inline trial CTA on free plan, billing history and invoice download
4. **Notification Preferences**: Per-user email preference center (weekly digest on/off, budget alert thresholds, alert channels)
5. **Advanced Analytics**: Cost anomaly detection with spike alerts, cost forecasting (7-day projection), ROI metrics (cost/commit, cost/PR), and cost allocation by project
6. **GitHub App Integration**: PR comment with per-PR cost impact, badge SVG endpoint for READMEs (`/api/badges/[user]/cost.svg`), GitHub App webhook handler
7. **Slack Integration**: Slash command `/kova costs`, daily/weekly digests posted to Slack, budget alert Slack notifications

## Problem Statement

Kova's core product is now production-grade, but growth requires three things that are currently missing:

**Activation gap**: A new user who installs the CLI sees terse output, gets no onboarding guidance, and reaches the dashboard to find empty charts with a single "run `kova sync`" hint. There is no wizard, no progress checklist, no guided path from installation to first "aha moment."

**Stickiness gap**: Power features that make Kova indispensable are absent. Developers have no way to compare tool costs head-to-head (`kova compare`), see cost trends in their terminal without visiting the browser (`kova open`), or get Kova cost data inside their existing workflows (GitHub PRs, Slack channels, CI/CD pipelines).

**Intelligence gap**: The analytics page shows historical data but no forward-looking signals. Users cannot see anomaly alerts ("your Claude Code spend spiked 340% today"), cost projections ("on track to spend $187 this month at current burn rate"), or ROI metrics ("$0.23 per merged PR").

## Solution Approach

**CLI additions** are additive -- new commands and enhanced formatter output that do not break existing 413 tests. Each new command follows the established pattern in `src/commands/`. The `kova compare` command reads from the existing `aggregateCosts()` pipeline and renders a new side-by-side table via the formatter. The `kova open` command is a thin wrapper around `open`/`xdg-open`. TUI mode uses `ink` (already popular in the Node.js CLI space) for an interactive cost explorer.

**Dashboard additions** are isolated Next.js page/component work in `C:/PROJ/kova-website/`. Empty state components replace the existing bare "No usage records yet" text on the overview, usage, and analytics pages. The onboarding wizard is a new `/dashboard/onboarding` route with a multi-step checklist stored in localStorage (or a `user_onboarding_progress` DB column on the profiles table).

**Notification preferences** extend the existing `profiles` table with a `notification_preferences` JSONB column and a new settings subsection on `/dashboard/settings`. The existing Resend email functions in `app/api/v1/notifications/` already handle budget alerts and weekly digests -- preferences just gate those sends.

**Advanced analytics** adds a new `/dashboard/analytics/insights` page with anomaly detection (z-score over rolling 7-day average from existing `usage_daily_rollups`), a cost forecast chart (linear projection), and ROI metrics (requires a new `commits_linked` optional table or just manual division by user-entered estimate).

**GitHub App** is a new GitHub App (registered in GitHub Developer Settings) with a webhook endpoint at `/api/github/webhook`. It posts PR cost comments when the CLI syncs from a git-tracked project directory. The badge endpoint is a pure SVG response at `/api/badges/[userId]/cost.svg` using inline SVG -- no external service needed.

**Slack** uses Slack's OAuth app model with a slash command pointing to `/api/slack/command`. The OAuth flow stores `slack_access_token` in a new `slack_integrations` table. Budget alerts and weekly digest emails gain a parallel Slack path.

## Relevant Files

### CLI: Files to Modify

- `src/commands/costs.ts` -- Add project-grouped output mode, color-coded trends vs prior period
- `src/lib/formatter.ts` -- Add `formatCompareTable()`, `formatProjectGroups()`, `formatCostForecast()`, richer progress bar
- `src/lib/config-store.ts` -- Add `tui_mode` and `default_view` display config options
- `src/index.ts` -- Register `compare`, `open` commands; add `--interactive` flag to `costs`

### CLI: New Files to Create

- `src/commands/compare.ts` -- `kova compare [--tool A] [--tool B] [--period week|month]` side-by-side diff
- `src/commands/open.ts` -- `kova open [--dashboard|--docs|--pricing]` browser opener
- `src/lib/tui.ts` -- Interactive TUI cost explorer using `ink`
- `tests/compare.test.ts` -- Unit tests for compare command
- `tests/open.test.ts` -- Unit tests for open command

### Website: Files to Modify

- `app/dashboard/page.tsx` -- Replace bare "No usage records yet" with `EmptyState` component; add onboarding banner for new users
- `app/dashboard/analytics/page.tsx` -- Add Insights section (anomaly, forecast, ROI) when data exists; richer empty state
- `app/dashboard/usage/page.tsx` -- Rich empty state with quickstart steps
- `app/dashboard/settings/page.tsx` -- Add Notifications subsection with preference toggles; add Integrations subsection (GitHub, Slack)
- `components/dashboard/sidebar.tsx` -- Add "Insights" nav link; add upgrade nudge banner for free plan users below nav
- `app/pricing/page.tsx` -- Add social proof section (X number of teams, $ tracked), FAQ accordion, trial CTA

### Website: New Files to Create

- `app/dashboard/onboarding/page.tsx` -- Multi-step onboarding wizard
- `components/dashboard/empty-state.tsx` -- Reusable empty state with icon, title, description, action button
- `components/dashboard/onboarding-banner.tsx` -- Dismissible progress banner for new users
- `components/dashboard/insights-cards.tsx` -- Anomaly alert card, forecast card, ROI card
- `components/dashboard/upgrade-nudge.tsx` -- Contextual free-to-pro CTA component
- `app/api/github/webhook/route.ts` -- GitHub App webhook handler (PR cost comment)
- `app/api/badges/[userId]/route.ts` -- SVG badge endpoint for README cost badges
- `app/api/slack/command/route.ts` -- Slack slash command handler (`/kova costs`)
- `app/api/slack/oauth/route.ts` -- Slack OAuth callback
- `app/dashboard/settings/integrations/page.tsx` -- GitHub and Slack integration management
- `supabase/migrations/005_phase6_growth.sql` -- `notification_preferences` JSONB column on profiles, `slack_integrations` table, `github_app_installations` table

## Implementation Phases

### Phase 1: Foundation

Set up DB schema additions, notification preferences column, and integration tables. Build the reusable `EmptyState` component and `OnboardingBanner` component used across all dashboard pages. Implement the onboarding wizard page. These are prerequisites for all other work and have no breaking changes.

### Phase 2: Core Implementation

Parallel tracks:

**Track A (CLI):** Implement `kova compare` and `kova open` commands. Enhance `formatter.ts` with project grouping and richer cost display. Add TUI mode with `ink`.

**Track B (Web -- UX):** Wire empty states into all dashboard pages. Add upgrade nudge component to sidebar for free plan users. Add notification preferences UI in settings. Build the Insights section on the analytics page (anomaly, forecast, ROI).

**Track C (Web -- Integrations):** Build GitHub App webhook handler and badge SVG endpoint. Build Slack slash command handler and OAuth flow. Add integrations settings page.

### Phase 3: Integration and Polish

Conversion optimization additions to pricing page (social proof, FAQ, trial CTA). Billing history section in settings. Final test coverage for all new CLI commands. End-to-end validation of GitHub and Slack flows. Performance check on new analytics queries.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
  - This is critical. Your job is to act as a high level director of the team, not a builder.
  - Your role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task\* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task\* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

Available specialist agents: `frontend-specialist`, `backend-engineer`, `supabase-specialist`, `security-auditor`, `performance-optimizer`, `quality-engineer`, `general-purpose`

- Specialist
  - Name: db-architect
  - Role: Schema migrations -- add `notification_preferences`, `slack_integrations`, `github_app_installations` tables/columns
  - Agent Type: supabase-specialist
  - Resume: true

- Specialist
  - Name: cli-engineer
  - Role: CLI new commands (`compare`, `open`), TUI mode, formatter enhancements, new tests
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: dashboard-ux
  - Role: Empty states, onboarding wizard, onboarding banner, upgrade nudge, notification preferences UI, insights cards
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: integrations-engineer
  - Role: GitHub App webhook, badge SVG endpoint, Slack slash command, Slack OAuth, integrations settings page
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: conversion-optimizer
  - Role: Pricing page social proof, FAQ, trial CTA, billing history in settings
  - Agent Type: frontend-specialist
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Database Schema Additions

- **Task ID**: db-schema-phase6
- **Depends On**: none
- **Assigned To**: db-architect
- **Agent Type**: supabase-specialist
- **Parallel**: false
- Read `C:/PROJ/kova-website/supabase/migrations/004_budget_alerts_notified_email.sql` to understand current schema state
- Create `C:/PROJ/kova-website/supabase/migrations/005_phase6_growth.sql` with:
  - `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"weekly_digest":true,"budget_alerts":true,"slack_enabled":false}'::jsonb`
  - `CREATE TABLE IF NOT EXISTS slack_integrations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, team_id TEXT NOT NULL, team_name TEXT, access_token TEXT NOT NULL, bot_user_id TEXT, channel_id TEXT, channel_name TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id))`
  - `CREATE TABLE IF NOT EXISTS github_app_installations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, installation_id BIGINT NOT NULL UNIQUE, account_login TEXT NOT NULL, account_type TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`
  - RLS policies: `slack_integrations` -- users can only read/write their own row; `github_app_installations` -- same pattern as `slack_integrations`
  - Indexes: `idx_slack_integrations_user_id`, `idx_github_app_installations_user_id`
- Validate migration syntax is valid PostgreSQL

### 2. Reusable Empty State Component

- **Task ID**: empty-state-component
- **Depends On**: none
- **Assigned To**: dashboard-ux
- **Agent Type**: frontend-specialist
- **Parallel**: true
- Create `C:/PROJ/kova-website/components/dashboard/empty-state.tsx`
  - Props: `icon` (Lucide icon component), `title` (string), `description` (string), `action` (optional: `{ label: string; href?: string; onClick?: () => void }`)
  - Design: centered, uses kova-surface/kova-border styling, icon in a soft blue circle, title in white, description in kova-silver-dim, action as a kova-blue button or ghost link
  - Export: named `EmptyState`
- Replace the existing bare "No usage records yet" on `app/dashboard/page.tsx` overview with `<EmptyState icon={BarChart3} title="No usage data yet" description="Run kova track then kova sync to see your AI costs here." action={{ label: "View setup guide", href: "/docs/getting-started/installation" }} />`
- Replace the bare empty state on `app/dashboard/usage/page.tsx` with a richer `EmptyState` including steps: "1. Install kova-cli / 2. Run kova track / 3. Run kova sync"
- Replace the bare empty state on `app/dashboard/analytics/page.tsx` with `EmptyState`

### 3. Onboarding Banner and Wizard

- **Task ID**: onboarding-flow
- **Depends On**: db-schema-phase6
- **Assigned To**: dashboard-ux
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Create `C:/PROJ/kova-website/components/dashboard/onboarding-banner.tsx`
  - A dismissible top-of-page banner that appears for new users (no usage records yet)
  - Shows a 3-step progress checklist: "Install CLI" / "Run kova track" / "Sync to dashboard"
  - Uses localStorage key `kova_onboarding_dismissed` to persist dismissal
  - Styled: amber/blue gradient top border, compact (not full-height), with a close button
  - Shows a count badge "X/3 steps complete" based on whether usage records exist (passed as prop `hasData: boolean`)
- Add `OnboardingBanner` to `app/dashboard/layout.tsx` above `{children}` -- pass `hasData` by checking if any rollup rows exist for the user
- Create `C:/PROJ/kova-website/app/dashboard/onboarding/page.tsx`
  - Full-page 3-step wizard with visual step indicators
  - Step 1: "Install Kova CLI" -- show `npm install -g kova-cli` with copy button, link to docs
  - Step 2: "Track your first session" -- show `kova track` with expected output snippet
  - Step 3: "Connect to dashboard" -- show `kova login` + `kova sync` flow, link to Settings to get API key
  - "Complete setup" button redirects to `/dashboard` on finish
  - Add "Get Started" link in the sidebar below the nav for users with no data (conditional on `hasData` prop)

### 4. Upgrade Nudge Component

- **Task ID**: upgrade-nudge
- **Depends On**: none
- **Assigned To**: dashboard-ux
- **Agent Type**: frontend-specialist
- **Parallel**: true
- Create `C:/PROJ/kova-website/components/dashboard/upgrade-nudge.tsx`
  - Props: `feature` (string -- the feature being gated), `plan` (current user plan)
  - Renders nothing if `plan !== 'free'`
  - Design: a compact banner or card with a lock icon, "Upgrade to Pro to unlock [feature]" text, and a "See pricing" link
  - Variants: `inline` (within a section) and `banner` (full-width, dismissible)
- Add `UpgradeNudge` inside the Analytics page's Insights section (Pro-only feature) when user is on free plan
- Add persistent upgrade nudge at the bottom of the sidebar for free plan users (below nav, above email) -- small, non-intrusive, with "Upgrade to Pro" link pointing to `/pricing`
- Add `UpgradeNudge` to the Team page for users on the free plan who have not yet upgraded

### 5. Notification Preferences UI

- **Task ID**: notification-preferences
- **Depends On**: db-schema-phase6
- **Assigned To**: dashboard-ux
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Add a "Notifications" section to `C:/PROJ/kova-website/app/dashboard/settings/page.tsx`
  - Fetch `notification_preferences` from `profiles` table (already queried in this page)
  - Display three toggle switches using `<input type="checkbox">` styled with Tailwind:
    - "Weekly digest email" -- on/off (maps to `notification_preferences.weekly_digest`)
    - "Budget alert emails" -- on/off (maps to `notification_preferences.budget_alerts`)
    - "Slack notifications" -- on/off, disabled with "Connect Slack first" hint if no `slack_integrations` row exists
  - Save button POSTs to `/api/v1/notifications/preferences` (new route, see task 8)
  - Show success toast on save
- Ensure existing `app/api/v1/notifications/weekly-digest/` and `budget-alert/` routes respect the user's preferences before sending

### 6. Kova Compare CLI Command

- **Task ID**: cli-compare-command
- **Depends On**: none
- **Assigned To**: cli-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Read all files in `C:/PROJ/kova-cli/src/commands/` and `C:/PROJ/kova-cli/src/lib/formatter.ts` before starting
- Create `C:/PROJ/kova-cli/src/commands/compare.ts`
  - Interface: `kova compare [--period today|week|month] [--tool <tool>]`
  - When `--tool` is omitted: compare ALL tracked tools side by side for the period
  - When `--tool cursor` (one tool): compare that tool across periods (today vs yesterday, this week vs last week)
  - Output: a rich table showing Tool / Cost / Sessions / Tokens In / Tokens Out / Delta (vs prior period, with +/- color)
  - Delta coloring: green if spending less, red if spending more, yellow if within 5%
  - `--json` flag for machine-readable output
  - Uses existing `queryRecords()` and `aggregateCosts()` from `local-store.ts` and `cost-calculator.ts`
- Add `formatCompareTable()` to `C:/PROJ/kova-cli/src/lib/formatter.ts`
  - Takes `{ current: CostSummary; prior: CostSummary; period: string }` and renders the diff table
  - Reuses existing color system from `colors` in `constants.ts`
- Register command in `C:/PROJ/kova-cli/src/index.ts`
- Create `C:/PROJ/kova-cli/tests/compare.test.ts` with unit tests covering: no-data case, single-tool comparison, all-tools side-by-side, JSON output flag
- Ensure `pnpm test` passes with all 413+ tests still green

### 7. Kova Open CLI Command

- **Task ID**: cli-open-command
- **Depends On**: none
- **Assigned To**: cli-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Create `C:/PROJ/kova-cli/src/commands/open.ts`
  - Interface: `kova open [dashboard|docs|pricing]` (defaults to `dashboard`)
  - Reads `creds.dashboardUrl` from credentials (falls back to `https://kova.dev/dashboard`)
  - Uses the `open` npm package (already widely used; add as dependency if not present) to open browser
  - Shows "Opening kova.dev/dashboard in your browser..." with a success indicator
  - `dashboard` target: opens dashboard URL from credentials
  - `docs` target: opens `https://kova.dev/docs`
  - `pricing` target: opens `https://kova.dev/pricing`
- Register command in `C:/PROJ/kova-cli/src/index.ts`
- Create `C:/PROJ/kova-cli/tests/open.test.ts` with unit tests (mock the `open` module)
- Add helpful `kova account` hint: "Run `kova open` to view your dashboard"

### 8. Notification Preferences API Route

- **Task ID**: notification-preferences-api
- **Depends On**: db-schema-phase6
- **Assigned To**: integrations-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false
- Create `C:/PROJ/kova-website/app/api/v1/notifications/preferences/route.ts`
  - `GET /api/v1/notifications/preferences` -- returns current `notification_preferences` from profiles
  - `PATCH /api/v1/notifications/preferences` -- accepts `{ weekly_digest?: boolean; budget_alerts?: boolean; slack_enabled?: boolean }`, merges into existing JSONB, updates profile
  - Authentication: uses Supabase server client (`createClient()`) -- same pattern as all other API routes
  - Rate limited: reuse existing `rateLimit` middleware from `app/api/v1/rate-limit.ts`
  - Returns 200 with updated preferences on success
- Update `C:/PROJ/kova-website/app/api/v1/notifications/weekly-digest/` route to check `notification_preferences.weekly_digest` before sending Resend email
- Update `C:/PROJ/kova-website/app/api/v1/notifications/budget-alert/` route to check `notification_preferences.budget_alerts` before sending

### 9. Analytics Insights -- Anomaly Detection and Forecasting

- **Task ID**: analytics-insights
- **Depends On**: db-schema-phase6
- **Assigned To**: dashboard-ux
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Create `C:/PROJ/kova-website/components/dashboard/insights-cards.tsx`
  - `AnomalyCard`: shows if today's spend is >2 standard deviations above the 14-day rolling average (computed server-side). Displays: "Spend spike detected -- Claude Code cost is 3.2x your 14-day average today." Badge: warning amber. Hidden if no anomaly.
  - `ForecastCard`: shows "On track to spend $X this month" based on daily burn rate * remaining days. Progress bar vs monthly budget if set. Uses existing `dailyBurnRate` calculation pattern from `dashboard/page.tsx`.
  - `RoiCard`: "Cost per active day: $X.XX" (total spend / days with activity in range). Optional manual input for "PRs merged this month" to show cost/PR.
  - All cards use the kova-surface/kova-border card design pattern
- Add server-side anomaly computation to `app/dashboard/analytics/page.tsx`:
  - Fetch the last 14 days of daily rollups
  - Compute rolling mean and standard deviation
  - Pass `{ isAnomaly: boolean; anomalyMultiple: number; anomalyTool: string }` to `InsightsCards`
- Add `ForecastCard` data to `app/dashboard/page.tsx` (burn rate already computed there -- just pass remaining days of month)
- Gate Insights section behind Pro plan check: show `UpgradeNudge` for free plan users

### 10. GitHub App Badge Endpoint

- **Task ID**: github-badge-endpoint
- **Depends On**: none
- **Assigned To**: integrations-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Create `C:/PROJ/kova-website/app/api/badges/[userId]/route.ts`
  - `GET /api/badges/[userId]/cost.svg` -- returns an SVG badge in shields.io style
  - Queries `usage_daily_rollups` for current month total cost for the given user (public endpoint -- no auth required, userId is intentionally public)
  - SVG template: label "AI cost" on the left, value "$X.XX/mo" on the right, blue background for value section
  - Cache header: `s-maxage=3600, stale-while-revalidate` (update hourly)
  - Return 200 with `Content-Type: image/svg+xml`
  - If userId not found or no data: returns a "$0.00/mo" badge rather than 404
- Add documentation to `C:/PROJ/kova-website/app/docs` (or existing docs structure) for badge usage: `![Kova AI Cost](https://kova.dev/api/badges/{userId}/cost.svg)`
- Add `[userId]` dynamic route type safety using Next.js route params typing

### 11. GitHub App Webhook Handler

- **Task ID**: github-webhook
- **Depends On**: db-schema-phase6
- **Assigned To**: integrations-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false
- Create `C:/PROJ/kova-website/app/api/github/webhook/route.ts`
  - `POST /api/github/webhook` -- handles GitHub App webhook events
  - Verify `x-hub-signature-256` using `GITHUB_WEBHOOK_SECRET` env var (same HMAC-SHA256 pattern as the existing Polar webhook in `app/api/webhooks/`)
  - Handle `installation` event: upsert to `github_app_installations` table
  - Handle `pull_request` events (opened, synchronize, reopened): post or update a PR comment with cost summary
    - Cost summary: fetch the last sync timestamp for the user linked to the installation, compute cost delta since the PR was opened (from `usage_daily_rollups`), format as Markdown table
    - Post via GitHub REST API (`POST /repos/{owner}/{repo}/issues/{issue_number}/comments` or `PATCH` to update existing)
  - Required env vars: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- Create `C:/PROJ/kova-website/app/dashboard/settings/integrations/page.tsx`
  - Shows GitHub App install button: "Install GitHub App" linking to `https://github.com/apps/kova-finops/installations/new`
  - Shows current installation status (linked to `github_app_installations` row)
  - Shows Slack connection status (linked to `slack_integrations` row)
  - "Disconnect" button for each integration
- Update `.env` example comments to document the new env vars

### 12. Slack Slash Command Integration

- **Task ID**: slack-integration
- **Depends On**: db-schema-phase6, notification-preferences-api
- **Assigned To**: integrations-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false
- Create `C:/PROJ/kova-website/app/api/slack/command/route.ts`
  - `POST /api/slack/command` -- Slack sends a `application/x-www-form-urlencoded` body
  - Verify request using `SLACK_SIGNING_SECRET` (HMAC-SHA256 on request body with timestamp, per Slack docs)
  - Parse `command` and `text` fields from body
  - Supported subcommands:
    - `/kova costs` -- returns today's spend as a Slack Block Kit message
    - `/kova costs week` -- returns last 7 days
    - `/kova costs month` -- returns current month
    - `/kova budget` -- returns budget status
  - Lookup user: match Slack `user_id` to `slack_integrations.bot_user_id` or a stored mapping; fall back to a "Connect your Kova account" message if not found
  - Fetch data from `usage_daily_rollups` using the linked Kova user's `user_id`
  - Return Slack Block Kit JSON with a summary table
  - Required env vars: `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- Create `C:/PROJ/kova-website/app/api/slack/oauth/route.ts`
  - `GET /api/slack/oauth` -- handles Slack OAuth callback
  - Exchanges `code` for access token via `https://slack.com/api/oauth.v2.access`
  - Upserts to `slack_integrations` table with `access_token`, `team_id`, `team_name`, `bot_user_id`, `channel_id`
  - Redirects to `/dashboard/settings/integrations?slack=connected`
- Update the existing `budget-alert` notification to also post to Slack if user has `slack_integrations` row and `notification_preferences.slack_enabled = true`

### 13. Conversion Optimization -- Pricing Page and Billing History

- **Task ID**: conversion-optimization
- **Depends On**: none
- **Assigned To**: conversion-optimizer
- **Agent Type**: frontend-specialist
- **Parallel**: true
- Update `C:/PROJ/kova-website/app/pricing/page.tsx`:
  - Add a social proof banner above pricing cards: "Trusted by [N] developer teams tracking $[X] in AI costs" (use hardcoded impressive-but-honest numbers or fetch from a public stats endpoint)
  - Add FAQ accordion section below pricing cards with 6 questions:
    - "Can I cancel anytime?" / "What counts as a seat?" / "How does the free plan differ from Pro?" / "Do you support annual billing?" / "What AI tools are supported?" / "Is my data secure?"
  - Add a "Start free, upgrade when ready" CTA block between the pricing cards and FAQ with a directional arrow to the Free tier
  - Implement FAQ as a pure CSS accordion (no new dependency) using `<details>`/`<summary>` styled with Tailwind
- Add "Billing History" section to `C:/PROJ/kova-website/app/dashboard/settings/page.tsx`:
  - Fetch `subscriptions` table rows for the current user (already queried for the active subscription)
  - Show a table of: Date / Plan / Amount / Status
  - For paid users, show "Manage subscription" link to Polar.sh customer portal (if Polar supports it) or `mailto:billing@kova.dev`
  - For free users: this section shows "No billing history" with an "Upgrade to Pro" link

### 14. Final Validation

- **Task ID**: validate-all
- **Depends On**: db-schema-phase6, empty-state-component, onboarding-flow, upgrade-nudge, notification-preferences, cli-compare-command, cli-open-command, notification-preferences-api, analytics-insights, github-badge-endpoint, github-webhook, slack-integration, conversion-optimization
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria are met
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

### CLI
- [ ] `kova compare` runs without error for all period flags (`--period today|week|month`)
- [ ] `kova compare --json` outputs valid JSON
- [ ] `kova open` opens a browser URL without error (mocked in tests)
- [ ] `kova open dashboard|docs|pricing` all resolve to correct URLs
- [ ] All 413 existing CLI tests still pass
- [ ] At least 10 new CLI tests added (compare + open commands)
- [ ] `pnpm build` completes without TypeScript errors in kova-cli

### Website -- UX
- [ ] `EmptyState` component renders correctly with and without `action` prop
- [ ] All three dashboard pages (overview, usage, analytics) show `EmptyState` when no data
- [ ] `OnboardingBanner` appears for new users and is dismissible (localStorage)
- [ ] Onboarding wizard `/dashboard/onboarding` has all 3 steps and completes navigation
- [ ] `UpgradeNudge` renders only for `plan === 'free'` users
- [ ] Notification preferences toggles save correctly and return 200 from API
- [ ] Anomaly card appears when spend is >2x 14-day average; hidden otherwise
- [ ] Forecast card shows correct remaining-days projection
- [ ] Insights section shows `UpgradeNudge` for free plan users

### Website -- Integrations
- [ ] `/api/badges/[userId]/cost.svg` returns valid SVG with `Content-Type: image/svg+xml`
- [ ] Badge endpoint returns a valid SVG for non-existent userId (graceful fallback)
- [ ] GitHub webhook handler verifies HMAC signature and returns 401 on invalid signature
- [ ] Slack slash command returns a valid Slack Block Kit JSON response for `/kova costs`
- [ ] Slack OAuth callback stores integration record and redirects correctly
- [ ] Integrations settings page shows both GitHub and Slack connection status

### Website -- Conversion
- [ ] Pricing page shows FAQ accordion with all 6 questions
- [ ] Pricing page social proof section renders
- [ ] Billing history section visible in settings for all users
- [ ] No TypeScript errors in kova-website (`pnpm build` clean)

### Tests
- [ ] `pnpm test` passes in both repos (all existing tests green)
- [ ] New CLI tests cover compare and open commands

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# CLI validation
cd /c/PROJ/kova-cli
pnpm build                    # TypeScript compile -- must complete with 0 errors
pnpm test                     # All 413+ tests must pass

# Test the new commands (manual smoke test)
node dist/index.js compare --period week
node dist/index.js compare --json --period month
node dist/index.js open --help

# Website validation
cd /c/PROJ/kova-website
pnpm build                    # Next.js build -- must complete with 0 errors
pnpm test                     # All 43+ Vitest tests must pass
pnpm lint                     # ESLint must pass with 0 errors

# Badge endpoint smoke test (after starting dev server)
curl -I http://localhost:3000/api/badges/test-user/cost.svg
# Expect: HTTP 200, Content-Type: image/svg+xml

# GitHub webhook signature test
curl -X POST http://localhost:3000/api/github/webhook \
  -H "x-hub-signature-256: sha256=invalidsig" \
  -d '{}' \
  # Expect: HTTP 401

# Slack command smoke test
curl -X POST http://localhost:3000/api/slack/command \
  -d 'command=/kova&text=costs&user_id=U123' \
  # Expect: HTTP 401 (missing valid signature) or valid Slack JSON
```

## Notes

### Environment Variables Required

The following new env vars must be documented in `.env.example` (kova-website):

```
# GitHub App Integration
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=          # PEM key, base64-encoded or multi-line
GITHUB_WEBHOOK_SECRET=

# Slack Integration
SLACK_SIGNING_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
```

### Dependency Additions

**kova-cli**: The `open` npm package for cross-platform browser opening. Install: `npm install open`. Check if already present before adding.

**kova-website**: No new npm dependencies required. GitHub API calls use native `fetch`. Slack uses native `fetch`. Badge SVG is hand-crafted string. Slack Block Kit is plain JSON.

### Scope Boundaries (NOT in Phase 6)

- No TUI mode implementation (deferred -- `ink` dependency adds complexity, validate demand first). `kova compare` and `kova open` provide the most immediate CLI value.
- No GitHub Actions CI/CD cost reporter (separate future integration)
- No SSO/SAML implementation (Enterprise feature, separate track)
- No public "open cost" dashboard for OSS projects (community feature, needs separate auth model)
- No changelog/blog section (content/marketing feature, not engineering)
- No A/B testing framework (premature at current scale)

### Priority Order Within Phase 6

If resources are constrained, execute in this order:
1. Empty states + onboarding (highest impact on activation)
2. `kova compare` command (most requested power feature)
3. Upgrade nudge + conversion optimization (revenue impact)
4. Notification preferences (retention)
5. Analytics insights (stickiness for power users)
6. GitHub badge endpoint (viral growth, low effort)
7. GitHub App webhook (ecosystem integration)
8. Slack integration (team workflow embedding)

### Explorer Compatibility

All tasks in this plan reference `parent_task_id: kova-phase6-growth-and-ux` to create a single explorable sprint tree. Any agent can run `explore` on any subtask to see the full context.

# Plan: Phase 3 -- Web Dashboard and Payment Infrastructure

## Task Description

Build the Kova web dashboard at kova.dev -- the revenue-generating SaaS layer that transforms the free CLI into a paid product. The dashboard gives engineering teams a unified view of AI coding tool costs across Claude Code, Cursor, Copilot, Windsurf, and Devin with per-developer breakdowns, trend charts, budget management, and exportable reports.

This plan spans TWO repositories:

- **kova-cli** (C:\PROJ\kova-cli) -- Update the sync command to work with the new API schema
- **kova-website** (C:\PROJ\kova-website) -- Build the dashboard pages, API routes, database schema, and payment flow

## Objective

When this plan is complete:

1. Supabase database is deployed with the production schema (10 tables, RLS, partitioning, rollup triggers)
2. `kova sync` uploads usage data to the dashboard API at kova.dev
3. Dashboard shows: cost overview with KPI cards, daily trend chart, per-tool/model/developer breakdowns
4. Budget management with alert history visible in the dashboard
5. API key management (create/revoke) in dashboard settings
6. Polar.sh checkout flow works end-to-end (Free -> Pro $15/seat -> Enterprise $30/seat)
7. Team management (invite members, view per-member costs)
8. The site is deployable to Vercel with 7 environment variables

## Problem Statement

Kova CLI v0.3.0 collects cost data from 5 AI tools locally. But the revenue model depends on the cloud dashboard -- teams need to see unified cost analytics across all developers, set budgets, and export reports. The kova-website already has substantial infrastructure (auth, docs, landing page, basic dashboard pages) but needs to be rewired for the FinOps pivot and connected to a production database schema.

## Solution Approach

### What Already Exists (kova-website)

- Next.js 16 with React 19, Tailwind v4, Framer Motion
- GitHub OAuth via Supabase Auth (working)
- Polar.sh webhook handler (scaffolded, needs product IDs)
- 5 dashboard pages (overview, builds, build detail, analytics, settings)
- API key management (has a minor bug to fix)
- Docs site with Fumadocs (26 pages -- needs content update for FinOps)
- Custom design system (kova-charcoal, kova-blue, kova-silver palette)

### What Needs to Change

1. **Database schema** -- Replace the old builds-focused schema with the new FinOps schema (usage_records, daily_rollups, budgets, budget_alerts)
2. **Dashboard pages** -- Rewrite from builds-focused to cost-focused (KPI cards: Total Spend, Daily Burn Rate, Top Tool, Budget %)
3. **API routes** -- New `/api/v1/usage` endpoint for CLI data ingestion, update subscription endpoint
4. **Charts** -- Replace build-focused charts with cost trend charts (daily spend area chart, tool comparison bar chart, model distribution donut)
5. **Pricing page** -- Update from old tiers to new FinOps tiers ($15/seat Pro, $30/seat Enterprise)
6. **Settings** -- Add team management, keep API key management (fix the bug)
7. **CLI sync** -- Update kova-cli's uploader to match the new API contract

### Architecture

```
Developer Machine              kova.dev (Vercel)              Supabase
+------------------+          +------------------+          +------------------+
| kova track       |          | Next.js 16       |          | PostgreSQL       |
| kova sync -------|--------->| POST /api/v1/    |--------->| usage_records    |
|                  |          |   usage          |          | daily_rollups    |
|                  |          |                  |          | monthly_rollups  |
|                  |          | Dashboard Pages  |<---------| budgets          |
|                  |          |   /dashboard/*   |          | teams            |
|                  |          |                  |          | api_keys         |
|                  |          | Polar Webhooks   |--------->| subscriptions    |
+------------------+          +------------------+          +------------------+
```

## Relevant Files

### kova-website (C:\PROJ\kova-website) -- Files to MODIFY

- `supabase/migrations/001_kova_schema.sql` -- Replace with new FinOps schema
- `app/dashboard/page.tsx` -- Rewrite for cost overview
- `app/dashboard/analytics/page.tsx` -- Rewrite for cost analytics charts
- `app/dashboard/settings/page.tsx` -- Add team management, fix API key bug
- `app/api/v1/builds/route.ts` -- Replace with `/api/v1/usage/route.ts`
- `app/api/v1/subscription/route.ts` -- Update for new schema
- `app/pricing/page.tsx` -- Update tiers and pricing
- `components/dashboard/*` -- Update dashboard components

### kova-website -- Files to CREATE

- `app/dashboard/usage/page.tsx` -- Detailed usage records table with filters
- `app/dashboard/budget/page.tsx` -- Budget management and alert history
- `app/dashboard/team/page.tsx` -- Team member management
- `app/api/v1/usage/route.ts` -- CLI usage data ingestion endpoint
- `app/api/v1/team/route.ts` -- Team management API
- `app/api/v1/budget/route.ts` -- Budget CRUD API
- `components/dashboard/cost-trend-chart.tsx` -- Daily cost area chart
- `components/dashboard/tool-comparison-chart.tsx` -- Tool cost bar chart
- `components/dashboard/model-distribution-chart.tsx` -- Model donut chart
- `components/dashboard/developer-table.tsx` -- Per-developer cost table
- `components/dashboard/kpi-cards.tsx` -- Overview KPI cards
- `components/dashboard/date-range-picker.tsx` -- Global date range filter
- `components/dashboard/usage-table.tsx` -- Detailed usage records table
- `supabase/migrations/002_finops_schema.sql` -- New FinOps migration

### kova-cli (C:\PROJ\kova-cli) -- Files to MODIFY

- `src/lib/uploader.ts` -- Update payload format to match new API contract
- `src/types.ts` -- Update UsageUploadPayload if needed

## Implementation Phases

### Phase 1: Database and API Foundation (Tasks 1-3)

Deploy the new Supabase schema, build the usage ingestion API endpoint, and update the CLI's sync command to match.

### Phase 2: Dashboard Core (Tasks 4-6)

Build the main dashboard pages -- cost overview with KPI cards and charts, detailed usage table, and budget management.

### Phase 3: Team and Payments (Tasks 7-8)

Build team management, wire Polar.sh checkout flow, update pricing page.

### Phase 4: Polish and Deploy (Tasks 9-10)

Update docs content for FinOps, fix remaining bugs, deploy to Vercel.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.

### Team Members

- Specialist
  - Name: builder-schema
  - Role: Write the Supabase migration SQL and build API routes for usage ingestion
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-dashboard
  - Role: Build all dashboard pages, charts, and components
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: builder-payments
  - Role: Wire Polar.sh checkout, update pricing page, build team management
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-cli-sync
  - Role: Update kova-cli uploader to match new API contract
  - Agent Type: backend-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Deploy New FinOps Database Schema

- **Task ID**: deploy-schema
- **Depends On**: none
- **Assigned To**: builder-schema
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read the existing schema at `supabase/migrations/001_kova_schema.sql` to understand what exists
- Create `supabase/migrations/002_finops_schema.sql` with:
  - `usage_records` table (partitioned by month on recorded_at) with columns: id TEXT PK, user_id UUID, team_id UUID, tool TEXT, model TEXT, session_id TEXT, project TEXT, input_tokens INT, output_tokens INT, cost_usd NUMERIC(12,8), recorded_at TIMESTAMPTZ, duration_ms INT, cli_version TEXT, synced_at TIMESTAMPTZ DEFAULT NOW()
  - Monthly partitions for 2026 (Jan-Dec) + DEFAULT partition
  - `usage_daily_rollups` table: team_id, user_id, date, tool, model, total_sessions INT, total_input_tokens BIGINT, total_output_tokens BIGINT, total_cost_usd NUMERIC(14,8), PK(team_id, user_id, date, tool, model)
  - `usage_monthly_rollups` table: same structure with month DATE
  - `budgets` table: id UUID PK, team_id UUID, scope TEXT (personal/team), period TEXT (daily/monthly), amount_usd NUMERIC(10,2), warn_at_percent INT DEFAULT 80, is_active BOOLEAN DEFAULT TRUE
  - `budget_alerts` table: id UUID PK, budget_id UUID FK, team_id UUID, triggered_at TIMESTAMPTZ, alert_type TEXT, threshold_pct INT, current_spend NUMERIC, budget_amount NUMERIC
  - Update `teams` table (add plan CHECK constraint for free/pro/enterprise, seats_purchased INT)
  - All composite indexes for common query patterns (team_id + recorded_at DESC, team_id + tool, etc.)
  - RLS policies using `(SELECT auth.uid())` pattern for performance
  - Trigger function `update_daily_rollup()` on usage_records INSERT
  - Trigger function `update_monthly_rollup()` on daily_rollups INSERT/UPDATE
  - `upload_usage_records(p_team_id UUID, p_user_id UUID, p_records JSONB)` RPC function
  - `get_my_team_ids()` helper function for RLS
  - `verify_api_key()` and `create_api_key()` in private schema (keep existing if compatible)
- Keep the existing `profiles`, `subscriptions`, `api_keys` tables from migration 001 (add columns as needed, don't drop)
- The migration must be additive (not destructive) so it can run against the existing database

### 2. Build Usage Ingestion API

- **Task ID**: usage-api
- **Depends On**: deploy-schema
- **Assigned To**: builder-schema
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read existing API routes: `app/api/v1/builds/route.ts`, `app/api/v1/subscription/route.ts`
- Create `app/api/v1/usage/route.ts`:
  - POST handler: accepts Bearer API key, verifies via `verify_api_key()` RPC, inserts records via `upload_usage_records()` RPC
  - Request body matches `UsageUploadPayload` from kova-cli types
  - Response: `{ accepted: number, duplicates: number, errors: number }`
  - Deduplication via `ON CONFLICT (id, recorded_at) DO NOTHING`
  - Max 500 records per request, validate payload size
  - Rate limit: check API key last_used_at, reject if >100 requests in last minute
- Update `app/api/v1/subscription/route.ts` to work with new schema if needed
- Create `app/api/v1/budget/route.ts`:
  - GET: return budgets for authenticated user's team
  - POST: create/update budget
  - DELETE: deactivate budget

### 3. Update CLI Sync Command

- **Task ID**: cli-sync-update
- **Depends On**: usage-api
- **Assigned To**: builder-cli-sync
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-cli repo at C:\PROJ\kova-cli
- Read `src/lib/uploader.ts` and `src/types.ts`
- Update `UsageUploadPayload` in `src/types.ts` if the API contract changed
- Update `uploadUsage()` in `src/lib/uploader.ts`:
  - POST to `/api/v1/usage` (not `/api/v1/builds`)
  - Map local `UsageRecord` fields to the API's expected format
  - Handle the new response format: `{ accepted, duplicates, errors }`
  - Log duplicate count if > 0 (info, not error)
- Run `npm run build` and `npm run test` in kova-cli

### 4. Build Dashboard Overview Page

- **Task ID**: dashboard-overview
- **Depends On**: deploy-schema
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Parallel**: true (can run alongside cli-sync-update)
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read existing: `app/dashboard/page.tsx`, `components/dashboard/*`, `globals.css` (design tokens)
- Rewrite `app/dashboard/page.tsx` as a cost-focused overview:
  - KPI cards row (server component with Suspense):
    - Total Spend This Month ($XXX.XX)
    - Daily Burn Rate ($X.XX/day average)
    - Top Tool by Cost (tool name + amount)
    - Budget Status (% used or "No budget set")
  - Daily Cost Trend chart (area chart, last 30 days)
  - Tool Comparison bar chart (5 tools side by side)
  - Recent Usage table (last 20 records with tool, model, cost, timestamp)
- Create `components/dashboard/kpi-cards.tsx`:
  - 4 cards in a responsive grid (1 col mobile, 2 col tablet, 4 col desktop)
  - Use existing kova-charcoal/kova-blue design tokens
  - Each card: icon, label, value, trend indicator (up/down arrow with %)
- Create `components/dashboard/cost-trend-chart.tsx`:
  - Use Recharts AreaChart (already a dependency in kova-website)
  - Responsive container
  - Tooltip showing date and cost
  - Area fill with kova-blue gradient
- Create `components/dashboard/tool-comparison-chart.tsx`:
  - Recharts BarChart, one bar per tool
  - Color-coded by tool
- Create `components/dashboard/date-range-picker.tsx`:
  - Global date filter: Today / 7 Days / 30 Days / Custom
  - Stored in URL search params for shareability
  - Used by all dashboard pages
- Fetch data from Supabase using server components (not API routes)

### 5. Build Usage Detail and Analytics Pages

- **Task ID**: usage-analytics
- **Depends On**: dashboard-overview
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/dashboard/usage/page.tsx`:
  - Paginated table of usage records with filters (tool, model, project, date range)
  - Sortable columns: timestamp, tool, model, project, tokens, cost
  - Search by project name
  - CSV export button
- Rewrite `app/dashboard/analytics/page.tsx`:
  - Model distribution donut chart (% of spend by model)
  - Per-developer cost table (ranked by spend, shows tool breakdown)
  - Cost per project bar chart
  - Token usage trend (input vs output over time)
- Create `components/dashboard/model-distribution-chart.tsx`:
  - Recharts PieChart with custom label showing %
- Create `components/dashboard/developer-table.tsx`:
  - Table of team members with their cost, sessions, top model
  - Sortable by cost
- Create `components/dashboard/usage-table.tsx`:
  - Reusable paginated table component
  - Client-side filtering + server-side pagination

### 6. Build Budget Management Page

- **Task ID**: budget-page
- **Depends On**: deploy-schema
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Parallel**: true (can run alongside usage-analytics)
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/dashboard/budget/page.tsx`:
  - Current budget display with progress bar (reuse kova-cli formatter visual style)
  - Set/edit monthly budget form
  - Set/edit daily budget form
  - Alert history table (timestamp, type, threshold, spend at trigger time)
  - Budget vs actual spend chart (monthly bar chart with budget line overlay)

### 7. Build Team Management

- **Task ID**: team-management
- **Depends On**: deploy-schema
- **Assigned To**: builder-payments
- **Agent Type**: backend-engineer
- **Parallel**: true (can run alongside dashboard pages)
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/dashboard/team/page.tsx`:
  - Team member list with roles (owner, admin, member)
  - Invite member form (by email -- creates team_member record with pending status)
  - Remove member button (owner/admin only)
  - Per-member cost summary (from usage_daily_rollups)
- Create `app/api/v1/team/route.ts`:
  - GET: list team members with their cost summaries
  - POST: invite a new member
  - DELETE: remove a member
  - PATCH: update member role
- Update `middleware.ts` if needed to handle team context

### 8. Wire Payments and Update Pricing

- **Task ID**: wire-payments
- **Depends On**: team-management
- **Assigned To**: builder-payments
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read existing: `app/pricing/page.tsx`, `app/api/polar/checkout/route.ts`, `app/api/webhooks/polar/route.ts`
- Update `app/pricing/page.tsx`:
  - Free tier: 1 developer, Claude Code only, 30-day local history
  - Pro: $15/seat/month ($144/yr) -- all 5 tools, 1-year cloud history, team dashboard, budget alerts
  - Enterprise: $30/seat/month ($288/yr) -- Pro + SSO, audit exports, API access, priority support
  - Wire "Subscribe" buttons to `/api/polar/checkout?products=PRODUCT_ID&seats=N`
- Update `app/api/polar/checkout/route.ts`:
  - Map tier slugs to actual Polar product IDs (Pro Monthly, Pro Annual, Enterprise Monthly, Enterprise Annual)
  - Support seat count parameter
  - Redirect to Polar checkout with customer email pre-filled
- Update `app/api/webhooks/polar/route.ts`:
  - Handle seat-based subscriptions
  - Update teams.plan and teams.seats_purchased on subscription events
  - Handle `benefit_grant.created` for individual seat activation
- Update dashboard sidebar/header to show current plan badge

### 9. Update Documentation for FinOps

- **Task ID**: update-docs
- **Depends On**: wire-payments
- **Assigned To**: builder-payments
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Update key doc pages in `content/docs/`:
  - Getting started: installation now focuses on cost tracking
  - Commands: add track, costs, budget, sync, report, config docs
  - Remove old orchestration command docs (plan, build, team-build, init, etc.)
  - Add guide: "Setting up multi-tool tracking" (how to configure Cursor, Copilot, etc.)
  - Add guide: "Team dashboard setup" (create team, invite members, set budgets)
  - Update README references throughout

### 10. Final Validation

- **Task ID**: validate-all
- **Depends On**: update-docs, cli-sync-update
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Verify kova-website builds: `pnpm build` in kova-website
- Verify kova-cli builds: `npm run build` in kova-cli
- Verify kova-cli tests: `npm run test` in kova-cli (381+ tests pass)
- Verify all dashboard pages render without errors
- Verify API routes return correct responses
- Verify Supabase migration SQL is valid
- Verify pricing page shows correct tiers
- Verify docs content is updated for FinOps
- Report pass/fail for each criterion

## Acceptance Criteria

1. `pnpm build` succeeds in kova-website with zero errors
2. `npm run build` and `npm run test` succeed in kova-cli
3. Supabase migration creates all required tables with RLS and indexes
4. `POST /api/v1/usage` accepts CLI usage data with Bearer API key auth
5. Dashboard overview shows KPI cards with real data from Supabase
6. Daily cost trend chart renders correctly with 30-day data
7. Tool comparison and model distribution charts work
8. Usage detail page has working filters and pagination
9. Budget management page allows setting/editing budgets
10. Team management page shows members with per-member costs
11. Polar checkout flow redirects to checkout with correct product
12. Webhook handler processes subscription events and updates team plan
13. API key management works (create shows key once, revoke deactivates)
14. All dashboard pages are protected by auth middleware
15. Pricing page shows updated FinOps tiers ($15/$30 per seat)

## Validation Commands

- `cd C:\PROJ\kova-website && pnpm build` -- Website builds
- `cd C:\PROJ\kova-cli && npm run build` -- CLI builds
- `cd C:\PROJ\kova-cli && npm run test` -- CLI tests pass
- Visit `/dashboard` -- Shows cost overview
- Visit `/dashboard/usage` -- Shows usage table
- Visit `/dashboard/analytics` -- Shows analytics charts
- Visit `/dashboard/budget` -- Shows budget management
- Visit `/dashboard/team` -- Shows team management
- Visit `/dashboard/settings` -- Shows API key management
- Visit `/pricing` -- Shows updated tiers

## Notes

- **Two repos**: This plan spans kova-cli and kova-website. Most work is in kova-website. Only the sync command update is in kova-cli.
- **Existing infrastructure**: kova-website already has auth, middleware, landing page, docs. We're adding/rewriting dashboard pages, not starting from scratch.
- **Schema migration**: The new migration (002) must be additive -- it should ADD new tables and ALTER existing ones, not DROP anything from migration 001.
- **Recharts**: Already a dependency in kova-website. Use it directly (not shadcn charts) since the project has a custom design system, not shadcn.
- **Polar product IDs**: Actual Polar product IDs need to be created in the Polar dashboard and configured via environment variables. The code should read from env vars, not hardcode IDs.
- **Team context**: The dashboard should detect which team the user belongs to and scope all queries to that team. If a user has no team, create a personal workspace (team of 1) automatically.
- **Real-time**: Consider adding Supabase Realtime for the "recent activity" feed on the overview page, but it's not required for MVP.
- **Mobile responsiveness**: All dashboard pages must work on mobile (single column layout).
- **Deployment checklist**: After building, the website needs 7 env vars configured in Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_ORG_ID, NEXT_PUBLIC_APP_URL.

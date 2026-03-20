# Plan: Kova Phase 5 - Production Hardening, Security Fixes & Growth

## Task Description

Phase 5 takes Kova from a launched product (v0.4.0 with CLI + dashboard) to production-grade quality. A security audit (2026-03-19) uncovered 2 Critical, 6 High, and 7 Medium vulnerabilities that must be fixed before real users handle payment data. Beyond security, this phase addresses: stale landing page copy still referencing the old orchestration CLI identity, zero test coverage in the website, in-memory rate limiting that does not work across serverless instances, N+1 database queries on the dashboard's overview page, missing env var validation that causes silent crashes, no email notifications for budget alerts, no error tracking, a webhook handler with no idempotency guard, and collector edge cases on Windows paths and token deduplication. The deliverable is a product that is observable, tested, hardened, secure, and growing.

## Objective

By the end of Phase 5, kova.dev will have:

- Landing page copy fully updated to FinOps / cost-tracking identity
- Full test coverage across the website (Playwright E2E + Vitest API/unit)
- Verified integration tests in kova-cli covering the sync and collector workflows
- Redis-backed (Upstash) rate limiting replacing the in-memory per-process store
- Email notifications for budget threshold alerts via Resend
- Sentry error tracking on both CLI and website
- Environment variable validation on startup for both repos
- Partition management automated via Supabase scheduled function
- Dashboard queries migrated from raw `usage_records` to `usage_daily_rollups` where appropriate, eliminating N+1 patterns
- Public REST API documentation at kova.dev/docs/api
- Weekly cost digest email per user

## Problem Statement

The product was launched but several categories of technical debt are blocking sustainable growth:

1. **Identity mismatch**: The hero, OG image, layout title, stats component, and structured data still reference "AI Coding Orchestration CLI" copy. New visitors see a product that does not match what they get.
2. **No website tests**: kova-website has zero test files. Regressions in API routes, webhook processing, and dashboard rendering are only caught in production.
3. **Rate limiting is fictional on serverless**: The in-memory sliding window store in `app/api/v1/usage/rate-limit.ts` is process-local. On Vercel, each cold-start gets an empty store, meaning the 100 req/min limit is never actually enforced globally.
4. **N+1 queries on the overview page**: `app/dashboard/page.tsx` fires four separate Supabase queries (usageInRange, thisMonthRecords, prevMonthRecords, budget) all scanning the raw `usage_records` table with no aggregation. For a user with 50k records, each page load does 3 full table scans.
5. **No observability**: `console.error` is the only error reporting. There is no Sentry, no uptime monitoring, no structured logging.
6. **Budget alerts are silent**: `budget_alerts` rows are written to the database by the PostgreSQL trigger but no email or webhook is ever sent. Users only discover alerts by opening the dashboard.
7. **Env var crashes are silent**: Both `createAdminClient()` and the checkout route use `process.env.X!` non-null assertions. If `SUPABASE_SERVICE_ROLE_KEY` or `POLAR_ACCESS_TOKEN` is missing, the entire request crashes with an unhelpful error rather than a developer-friendly startup check.
8. **Partition management is manual**: The schema pre-creates 2026 partitions, but there is no automated job to create 2027 partitions. The `usage_records_default` catch-all partition will silently accumulate data after January 2027.
9. **CLI has no integration test for the full sync path**: There is a `tests/integration/track-to-costs.test.ts` file but no test that mocks the uploader and validates the full `track -> sync` flow end to end.
10. **Collector edge cases**: Windsurf's `makeId` uses `messagesSent` which is non-unique on the same day with the same model; two entries with identical (day, model, mode, messagesSent) but different `promptsUsed` would be deduplicated incorrectly.

## Solution Approach

Work is organized into six parallel tracks, each owned by a specialist:

1. **Content & Brand** (frontend-specialist): Update all stale copy, OG image, structured data, and stats to FinOps identity.
2. **Testing** (quality-engineer): Add Playwright E2E tests for the dashboard flow, Vitest API tests for all route handlers, and additional CLI integration tests.
3. **Infrastructure & Observability** (backend-engineer): Replace in-memory rate limiter with Upstash Redis, add Sentry to both apps, add env var validation, automate partition management.
4. **Performance** (performance-optimizer): Migrate dashboard overview page queries to use rollup tables, add React error boundaries to all dashboard pages.
5. **Notifications** (backend-engineer): Implement budget alert email delivery (Resend) and weekly digest emails via Supabase Edge Function + cron.
6. **CLI Hardening** (backend-engineer): Fix Windsurf deduplication, add graceful offline mode for sync, add full sync integration test.

## Relevant Files

Use these files to complete the task:

**kova-website -- Brand/Content:**

- `/c/PROJ/kova-website/app/layout.tsx` -- stale title and description metadata (still says "AI Coding Orchestration CLI")
- `/c/PROJ/kova-website/app/api/og/route.tsx` -- OG image still shows orchestration copy
- `/c/PROJ/kova-website/components/landing/hero.tsx` -- "Plan the hunt. Run the pack." heading, terminal demos show kova plan/build/pr
- `/c/PROJ/kova-website/components/landing/stats.tsx` -- Shows "Plan Templates" and "Commands Available" instead of FinOps stats
- `/c/PROJ/kova-website/components/landing/social-proof.tsx` -- Testimonials mention orchestration agents, not cost tracking

**kova-website -- API Routes (to test):**

- `/c/PROJ/kova-website/app/api/v1/usage/route.ts` -- POST ingestion; rate-limit.ts is process-local
- `/c/PROJ/kova-website/app/api/v1/usage/rate-limit.ts` -- In-memory store, not globally enforced on serverless
- `/c/PROJ/kova-website/app/api/webhooks/polar/route.ts` -- No replay-attack guard beyond Polar SDK signature; no idempotency log
- `/c/PROJ/kova-website/app/api/v1/budget/route.ts`
- `/c/PROJ/kova-website/app/api/v1/team/route.ts`
- `/c/PROJ/kova-website/app/api/v1/subscription/route.ts`
- `/c/PROJ/kova-website/app/api/polar/checkout/route.ts`

**kova-website -- Dashboard Pages (performance):**

- `/c/PROJ/kova-website/app/dashboard/page.tsx` -- 4 sequential raw table scans; no error boundary
- `/c/PROJ/kova-website/app/dashboard/analytics/page.tsx` -- Fetches all records then aggregates in JS
- `/c/PROJ/kova-website/app/dashboard/budget/page.tsx` -- Missing error boundary
- `/c/PROJ/kova-website/app/dashboard/team/page.tsx`
- `/c/PROJ/kova-website/app/dashboard/settings/page.tsx` -- `user!.id` non-null assertion with no guard

**kova-website -- Infrastructure:**

- `/c/PROJ/kova-website/lib/supabase-admin.ts` -- `process.env.SUPABASE_SERVICE_ROLE_KEY!` with no validation
- `/c/PROJ/kova-website/middleware.ts` -- Auth edge case: no error boundary around updateSession import

**kova-cli -- Collectors:**

- `/c/PROJ/kova-cli/src/lib/collectors/windsurf.ts` -- `makeId` uses messagesSent which is not unique within a day
- `/c/PROJ/kova-cli/src/lib/collectors/cursor.ts` -- `makeId` uses inputTokens, not unique if same timestamp and model with 0 tokens
- `/c/PROJ/kova-cli/src/lib/collectors/devin.ts` -- `makeId` uses acus, not unique if same date has 0 ACUs from two calls
- `/c/PROJ/kova-cli/src/lib/collectors/claude-code.ts` -- `CLAUDE_CODE_DIR` is hardcoded to `~/.claude`, no support for `CLAUDE_HOME` env override

**kova-cli -- Sync & Commands:**

- `/c/PROJ/kova-cli/src/commands/sync.ts` -- No retry logic on transient network errors; no deduplication of already-uploaded records
- `/c/PROJ/kova-cli/src/lib/uploader.ts` -- (to be read; check for missing error handling)
- `/c/PROJ/kova-cli/src/lib/local-store.ts` -- JSON flat file grows unboundedly; no max size guard

**kova-cli -- Tests:**

- `/c/PROJ/kova-cli/tests/integration/track-to-costs.test.ts` -- Exists but does not cover sync path
- `/c/PROJ/kova-cli/tests/collectors/windsurf.test.ts`
- `/c/PROJ/kova-cli/tests/collectors/cursor.test.ts`
- `/c/PROJ/kova-cli/tests/uploader.test.ts`

**Schema (reference only):**

- `/c/PROJ/kova-cli/docs/supabase-schema.sql` -- Schema reference; note `budget_alerts.notified_email` field exists but nothing writes to it

### New Files

**kova-website:**

- `app/api/v1/usage/rate-limit-redis.ts` -- Upstash Redis rate limiter replacing the in-memory version
- `app/api/health/route.ts` -- Health check endpoint (`GET /api/health`) validating env vars and DB connectivity
- `lib/env-validation.ts` -- Startup env var validation with clear error messages
- `lib/sentry.ts` -- Sentry initialization helper
- `lib/resend.ts` -- Resend email client and template functions
- `app/api/notifications/budget-alerts/route.ts` -- Internal webhook called by Supabase cron to send budget emails
- `app/api/notifications/weekly-digest/route.ts` -- Internal webhook for weekly digest emails
- `components/dashboard/error-boundary.tsx` -- React error boundary wrapper for dashboard pages
- `tests/api/usage.test.ts` -- Vitest tests for POST /api/v1/usage
- `tests/api/budget.test.ts` -- Vitest tests for budget CRUD
- `tests/api/webhook.test.ts` -- Vitest tests for Polar webhook handler
- `tests/e2e/dashboard.spec.ts` -- Playwright E2E: login -> view dashboard -> set budget
- `tests/e2e/sync-flow.spec.ts` -- Playwright E2E: CLI sync visible in dashboard

**kova-cli:**

- `tests/integration/sync-upload.test.ts` -- Full track->sync integration test with mocked HTTP
- `src/lib/sync-tracker.ts` -- Tracks which record IDs have been uploaded to avoid re-uploading

## Security Audit Findings (2026-03-19)

These findings from the security audit must be addressed as part of this phase. Tasks below incorporate all fixes.

### Critical

- **C-1**: In-memory rate limiter is per-process, provides zero protection on Vercel serverless (Task 3: redis-rate-limit)
- **C-2**: Webhook route uses `POLAR_WEBHOOK_SECRET!` non-null assertion with no runtime guard -- missing secret could allow forged subscription events (Task 2: env-validation)

### High

- **H-1**: `createAdminClient()` uses `process.env.X!` assertions, crashes unhelpfully when vars missing (Task 2: env-validation)
- **H-2**: `upload_usage_records` RPC accepts unbounded string lengths from CLI (Task 2: env-validation -- add field length validation in route + CHECK constraints in migration)
- **H-3**: `team_members` INSERT RLS has self-insert bypass allowing any user to join any team (Task 2: env-validation -- new migration 003)
- **H-4**: `team_members` has no UPDATE RLS policy (Task 2: env-validation -- new migration 003)
- **H-5**: `budget_alerts` has no write policies, relying on implicit deny (Task 2: env-validation -- new migration 003)
- **H-6**: `POST /api/v1/builds` has no rate limiting or input validation (legacy route -- consider deprecating)

### Medium

- **M-1**: Middleware does not protect API routes (architectural -- document as accepted risk)
- **M-2**: Budget `warn_at_percent` accepts unconstrained values (add CHECK constraint in migration 003)
- **M-3**: Team invite email not format-validated (add regex check in team route)
- **M-4**: Open redirect risk on Polar `session.url` (validate checkout URL domain)
- **M-5**: CSV export vulnerable to formula injection (sanitize =, +, -, @ prefixes)
- **M-6**: CLI does not enforce HTTPS on `dashboardUrl` (Task 8: cli-sync-hardening)
- **M-7**: CLI stores credentials before validation succeeds (Task 8: cli-sync-hardening)

### Low

- **L-1**: `usage_records` INSERT policy gap (implicit deny, add explicit deny in migration 003)
- **L-2**: `usage.json` written without 0o600 permissions (Task 7: cli-collector-fixes)
- **L-3**: No audit trail for team role changes (add updated_at/updated_by columns in migration 003)
- **L-4**: `redirectTo` parameter not validated for open redirect (add relative URL check)
- **L-5**: API error responses leak internal env var names (sanitize 503 responses)

### New Task: Security Migration 003 (incorporated into Task 2)

Create `supabase/migrations/003_security_hardening.sql`:

- Drop and recreate `team_members_insert` policy WITHOUT self-insert bypass (H-3)
- Add `team_members_update` policy for owner only (H-4)
- Add explicit INSERT/UPDATE/DELETE deny policies on `budget_alerts` (H-5)
- Add explicit INSERT deny on `usage_records` (L-1)
- Add field length CHECK constraints on `usage_records` (H-2)
- Add `warn_at_percent BETWEEN 1 AND 100` CHECK on `budgets` (M-2)
- Add `updated_at`, `updated_by` columns to `team_members` (L-3)

### Additional Security Fixes (incorporated into existing tasks)

- Task 2 (env-validation): Add runtime guard for POLAR_WEBHOOK_SECRET (C-2), validate all env vars
- Task 5 (finops-copy): No security impact
- Task 6 (api-tests): Test rate limiting, auth, input validation
- Task 7 (cli-collector-fixes): Add 0o600 permissions on usage.json (L-2)
- Task 8 (cli-sync-hardening): Enforce HTTPS (M-6), validate credentials before storage (M-7)
- CSV formula injection fix (M-5): Add to Task 2 or as separate quick fix
- Email format validation (M-3): Add to team route
- Checkout URL domain validation (M-4): Add to checkout route
- Remove env var names from error responses (L-5): Add to checkout route

## Implementation Phases

### Phase 1: Foundation + Security

Set up test infrastructure, env validation, Sentry, and Redis in both repos. Fix all Critical and High security vulnerabilities. Create migration 003 for RLS hardening.

- Add Vitest + Playwright to kova-website (`pnpm add -D vitest @vitejs/plugin-react playwright @playwright/test`)
- Create `lib/env-validation.ts` that checks all required env vars at process start and throws with a clear message
- Add Sentry SDK to kova-website (`@sentry/nextjs`) and kova-cli (`@sentry/node`)
- Replace `rate-limit.ts` with `rate-limit-redis.ts` using `@upstash/ratelimit` and `@upstash/redis`
- Add health check route at `GET /api/health`

### Phase 2: Core Implementation

Fix the content identity problem, implement all tests, deliver email notifications, and harden collector deduplication.

- **Content**: Rewrite hero, layout metadata, OG image, stats, structured data to FinOps messaging
- **Testing**: API route unit tests, Playwright E2E for dashboard, CLI sync integration tests
- **Notifications**: Budget alert emails via Resend + Supabase Edge Function cron trigger
- **Weekly digest**: Supabase scheduled Edge Function queries past-week spend and sends digest email
- **CLI hardening**: Fix Windsurf/Cursor/Devin `makeId` collisions; add `CLAUDE_HOME` env override; add local-store size guard; add sync retry with exponential backoff
- **Database**: Supabase scheduled function to auto-create next month's partition

### Phase 3: Integration & Polish

- Dashboard query migration to rollup tables (eliminates N+1)
- React error boundaries on all dashboard pages
- Public API documentation page at `/docs/api`
- Final validation pass

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

Available specialist agents: `frontend-specialist`, `backend-engineer`, `supabase-specialist`, `security-auditor`, `performance-optimizer`, `quality-engineer`, `general-purpose`

- Specialist
  - Name: brand-writer
  - Role: Update all stale orchestration-CLI copy to FinOps identity across hero, layout, OG image, stats, and structured data
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: test-builder
  - Role: Build Vitest API tests, Playwright E2E tests, and CLI integration tests for the sync path
  - Agent Type: quality-engineer
  - Resume: true

- Specialist
  - Name: infra-engineer
  - Role: Replace in-memory rate limiter with Redis, add Sentry to both apps, add env var validation, add health check endpoint, automate partition management
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: perf-engineer
  - Role: Migrate dashboard overview and analytics page queries to rollup tables; add React error boundaries to all dashboard pages
  - Agent Type: performance-optimizer
  - Resume: true

- Specialist
  - Name: notif-engineer
  - Role: Implement budget alert email delivery (Resend) and weekly digest emails via Supabase Edge Function
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: cli-hardener
  - Role: Fix collector makeId collisions, add CLAUDE_HOME env override, add local-store size guard, add sync retry logic, add sync-tracker to avoid re-uploading
  - Agent Type: backend-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: final-validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Setup Test Infrastructure in kova-website

- **Task ID**: setup-website-tests
- **Depends On**: none
- **Assigned To**: test-builder
- **Agent Type**: quality-engineer
- **Parallel**: true
- Install Vitest, `@vitejs/plugin-react`, Playwright, and `@playwright/test` as devDependencies in kova-website
- Create `vitest.config.ts` at kova-website root targeting `tests/**/*.test.ts`
- Create `playwright.config.ts` targeting `tests/e2e/**/*.spec.ts`, base URL `http://localhost:3000`
- Add `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"test:watch": "vitest"` to kova-website package.json scripts
- Create `tests/` directory structure: `tests/api/`, `tests/e2e/`, `tests/unit/`
- Write a trivial smoke test (`tests/api/smoke.test.ts`) that passes to confirm setup works

### 2. Add Env Var Validation to kova-website

- **Task ID**: env-validation
- **Depends On**: none
- **Assigned To**: infra-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Create `lib/env-validation.ts` exporting a `validateEnv()` function that checks: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; logs warnings (not crashes) for optional vars: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `SENTRY_DSN`
- Update `lib/supabase-admin.ts` to call `validateEnv()` before creating the client, throwing a descriptive error if required vars are missing instead of a silent undefined crash
- Create `app/api/health/route.ts` that returns `{ status: "ok", timestamp, env: { supabase: bool, polar: bool, redis: bool, resend: bool } }` -- a non-auth endpoint for uptime monitoring
- Document required env vars in `/c/PROJ/kova-website/.env.example` (read the existing file first to see what is already there)

### 3. Replace In-Memory Rate Limiter with Redis

- **Task ID**: redis-rate-limit
- **Depends On**: env-validation
- **Assigned To**: infra-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false
- Install `@upstash/ratelimit` and `@upstash/redis` in kova-website
- Create `app/api/v1/usage/rate-limit-redis.ts` implementing a sliding window rate limiter using `Ratelimit.slidingWindow(100, "60 s")` keyed by `keyPrefix`
- The new module must export the same `checkRateLimit(keyPrefix: string): Promise<RateLimitResult>` interface as the existing `rate-limit.ts` so the usage route requires minimal changes
- Update `app/api/v1/usage/route.ts` to import from `rate-limit-redis.ts`; if `UPSTASH_REDIS_REST_URL` is not configured, fall back to the existing in-memory limiter with a `console.warn` (graceful degradation)
- Keep `rate-limit.ts` for the fallback; do not delete it

### 4. Add Sentry to Both Repos

- **Task ID**: sentry-setup
- **Depends On**: env-validation
- **Assigned To**: infra-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- **kova-website**: Run `npx @sentry/wizard@latest -i nextjs` or manually install `@sentry/nextjs`; create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` with `Sentry.init({ dsn: process.env.SENTRY_DSN })`. Wrap all `console.error` calls in API routes with `Sentry.captureException(err)` before logging
- **kova-cli**: Install `@sentry/node`; initialize in the main CLI entry point (`src/index.ts`) with opt-in telemetry (gated behind `KOVA_TELEMETRY=1` env var -- no tracking by default); wrap `wrapCommandAction` in `error-handler.ts` to call `Sentry.captureException` when `KOVA_TELEMETRY=1`

### 5. Fix Landing Page Identity (FinOps Copy)

- **Task ID**: finops-copy
- **Depends On**: none
- **Assigned To**: brand-writer
- **Agent Type**: frontend-specialist
- **Parallel**: true
- Update `app/layout.tsx`: change title default to `"Kova - AI Dev FinOps"`, description to `"Track AI development costs across Claude Code, Cursor, Copilot, Windsurf, and Devin. One CLI, one dashboard."`, OG title, twitter title to match
- Update `app/api/og/route.tsx`: replace "AI Coding Orchestration CLI" with "AI Dev FinOps" and "Plan the hunt. Run the pack." with "See exactly what your AI tools cost." Update stats row to show "5 AI Tools Tracked | Real-Time Cost Tracking | Pro from $15/seat"
- Update `components/landing/hero.tsx`: replace the two `GradientHeading` lines with FinOps messaging (e.g. "Know what AI costs." / "Before it adds up."); replace the terminal scenarios (which show `kova plan` / `kova build` / `kova pr`) with FinOps terminal scenarios showing `kova track`, `kova sync`, `kova costs`, `kova budget`; update the typewriter phrases; update the stats row at the bottom to show FinOps numbers
- Update `components/landing/stats.tsx`: replace "Plan Templates" / "Commands Available" with FinOps stats such as "5 AI Tools Tracked", "Real-time Cost Data", "Teams Saved"
- Update `components/landing/social-proof.tsx`: replace the three testimonials with FinOps-focused quotes that do not mention orchestration or specialist agents

### 6. Write API Route Tests (Vitest)

- **Task ID**: api-tests
- **Depends On**: setup-website-tests
- **Assigned To**: test-builder
- **Agent Type**: quality-engineer
- **Parallel**: true
- Write `tests/api/usage.test.ts`: mock Supabase admin client and rate limiter; test (a) missing auth header returns 401, (b) invalid API key returns 401, (c) oversized payload returns 413, (d) empty records array returns 400, (e) valid request with mocked RPC returns 201 with `{ accepted, duplicates }`
- Write `tests/api/budget.test.ts`: mock Supabase session client; test GET returns budgets, POST validates scope/period/amount, DELETE requires id param, unauthorized requests return 401
- Write `tests/api/webhook.test.ts`: test that `onSubscriptionCreated` upserts subscription and updates profile plan; test that `onSubscriptionCanceled` sets plan to "free"; test missing webhook secret returns 400 (if Polar SDK validates before calling handler)
- Write `tests/api/rate-limit.test.ts`: test the existing in-memory limiter logic (allows 100 req, blocks 101st, resets after window)

### 7. Fix CLI Collector Deduplication Edge Cases

- **Task ID**: cli-collector-fixes
- **Depends On**: none
- **Assigned To**: cli-hardener
- **Agent Type**: backend-engineer
- **Parallel**: true
- **Windsurf**: Update `makeId` in `windsurf.ts` to include `promptsUsed` in the hash: `windsurf:${day}:${model}:${mode}:${messagesSent}:${promptsUsed}` -- this makes IDs unique when promptsUsed differs for same-day same-model entries
- **Cursor**: Update `makeId` in `cursor.ts` to include `outputTokens` in addition to `inputTokens` to reduce collision risk: `cursor:${timestamp}:${model}:${inputTokens}:${outputTokens}`
- **Devin**: Update `makeId` in `devin.ts` to include the raw date string plus acus plus JSON.stringify(acusByProduct) to ensure uniqueness when daily ACU breakdown differs
- **Claude Code**: Add support for `CLAUDE_HOME` environment variable override in `constants.ts`: `export const CLAUDE_CODE_DIR = process.env['CLAUDE_HOME'] ?? path.join(os.homedir(), '.claude')` -- this allows users with non-standard Claude installations to override the path
- **Local Store**: Add a `MAX_RECORDS = 100_000` guard in `local-store.ts` `appendRecords()` -- if `db.records.length` would exceed the limit after adding new records, prune records older than 90 days before writing; log a warning if pruning occurred
- Update collector tests to add coverage for the fixed deduplication cases

### 8. Add Sync Retry and Idempotency Tracking to CLI

- **Task ID**: cli-sync-hardening
- **Depends On**: cli-collector-fixes
- **Assigned To**: cli-hardener
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read `src/lib/uploader.ts` in full before making changes
- Add exponential backoff retry (max 3 attempts, delays: 1s, 3s, 9s) to `uploadUsage()` for transient errors (network timeouts, HTTP 5xx responses); do not retry on 401 or 413
- Create `src/lib/sync-tracker.ts` that stores a set of uploaded record IDs in `~/.kova/synced.json`; `uploadUsage()` should filter out records already in this set before uploading and add successfully uploaded IDs to the set after success
- Update `syncCommand` to use `syncTracker` so repeated `kova sync` calls do not re-upload the same records
- Write `tests/integration/sync-upload.test.ts`: mock `fetch` with `vi.fn()`; verify that (a) records are uploaded in the correct format, (b) on network error the upload retries up to 3 times, (c) already-synced records are not re-uploaded, (d) duplicate response from server is handled gracefully

### 9. Add Dashboard Error Boundaries

- **Task ID**: dashboard-error-boundaries
- **Depends On**: none
- **Assigned To**: perf-engineer
- **Agent Type**: performance-optimizer
- **Parallel**: true
- Create `components/dashboard/error-boundary.tsx` as a React error boundary that shows a user-friendly "Something went wrong" card with a retry button and optionally logs to Sentry
- Wrap each dashboard page's main content sections in `<ErrorBoundary>`:
  - `app/dashboard/page.tsx`: wrap KpiCards, CostTrendChart, ToolComparisonChart sections separately
  - `app/dashboard/analytics/page.tsx`: wrap AnalyticsCharts and DeveloperTable sections
  - `app/dashboard/budget/page.tsx`: wrap BudgetForm and BudgetVsActualChart sections
  - `app/dashboard/team/page.tsx`: wrap MemberList and InviteMemberForm
- Fix the `user!.id` non-null assertion in `settings/page.tsx` -- add an explicit `if (!user) return null` guard before the profile query

### 10. Migrate Dashboard Queries to Rollup Tables

- **Task ID**: dashboard-query-optimization
- **Depends On**: dashboard-error-boundaries
- **Assigned To**: perf-engineer
- **Agent Type**: performance-optimizer
- **Parallel**: false
- In `app/dashboard/page.tsx`: replace the 3 separate raw `usage_records` scans (usageInRange, thisMonthRecords, prevMonthRecords) with queries against `usage_daily_rollups` -- the rollup table has `(team_id, date, total_cost_usd, total_input_tokens, total_output_tokens, request_count)` which can answer all three questions in one or two queries; note the dashboard page uses `user_id` but the schema uses `team_id + developer_id` -- the page will need to either (a) also query team membership to get team_id first, or (b) use a Supabase RPC that accepts user_id and returns rolled-up data
- In `app/dashboard/analytics/page.tsx`: replace the full `usage_records` SELECT that fetches all records for in-JS aggregation with queries to `usage_daily_rollups` and `usage_monthly_rollups`; project-level breakdown can stay on `usage_records` with a GROUP BY since it is filtered
- Add explicit `limit(1000)` guards on any query that could theoretically return unbounded rows from `usage_records`
- Document query decisions in code comments

### 11. Implement Budget Alert Email Notifications

- **Task ID**: budget-email-alerts
- **Depends On**: env-validation
- **Assigned To**: notif-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Install `resend` npm package in kova-website
- Create `lib/resend.ts` with a `sendBudgetAlertEmail({ to, alertType, period, spentUsd, budgetUsd, percent })` function that uses the Resend API; the email should be a simple HTML template showing the alert details and a link to the dashboard budget page; if `RESEND_API_KEY` is not set, log a warning and skip sending
- Create `app/api/notifications/budget-alerts/route.ts` as an internal POST endpoint (protected by a shared `NOTIFICATIONS_SECRET` header) that: (1) queries `budget_alerts` where `notified_email = FALSE` and `fired_at > NOW() - INTERVAL '1 hour'`, (2) for each alert, looks up the team owner email from `profiles`, (3) calls `sendBudgetAlertEmail()`, (4) sets `notified_email = TRUE` on success
- Create a Supabase Edge Function `supabase/functions/notify-budget-alerts/index.ts` that calls `POST /api/notifications/budget-alerts` -- this function will be triggered by a Supabase cron job every 15 minutes
- Document the cron job setup in comments: `SELECT cron.schedule('notify-budget-alerts', '*/15 * * * *', $$SELECT net.http_post(...)$$)`

### 12. Implement Weekly Cost Digest Email

- **Task ID**: weekly-digest-email
- **Depends On**: budget-email-alerts
- **Assigned To**: notif-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false
- Create `lib/resend.ts` additions for `sendWeeklyDigestEmail({ to, weekStart, weekEnd, totalCostUsd, prevWeekCostUsd, byTool, topProject })`
- Create `app/api/notifications/weekly-digest/route.ts`: queries `usage_daily_rollups` for each active user for the past 7 days, aggregates by tool and project, sends the digest email via Resend
- The endpoint should only send digests to Pro/Enterprise users (check `profiles.plan`)
- Create a Supabase Edge Function `supabase/functions/weekly-digest/index.ts` triggered by a Monday 9am UTC cron: `0 9 * * 1`

### 13. Automate Partition Management

- **Task ID**: partition-automation
- **Depends On**: none
- **Assigned To**: infra-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true
- Create Supabase Edge Function `supabase/functions/create-next-month-partition/index.ts` that calls `SELECT public.create_monthly_partition(DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE)` using the service role key
- Schedule this function to run on the 1st of each month at 00:05 UTC via Supabase cron: `5 0 1 * *`
- The function should log the result (CREATED or EXISTS) to structured output
- Add a comment in `docs/supabase-schema.sql` documenting the automation
- Create `supabase/functions/` directory structure with a shared `_shared/supabase-client.ts` utility

### 14. Write Playwright E2E Tests

- **Task ID**: e2e-tests
- **Depends On**: setup-website-tests
- **Assigned To**: test-builder
- **Agent Type**: quality-engineer
- **Parallel**: true
- Write `tests/e2e/dashboard.spec.ts` testing the full authenticated dashboard flow using a test Supabase account (configure via `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` env vars): login -> redirect to /dashboard -> see KPI cards -> navigate to Budget -> set a monthly budget -> see the budget progress bar update
- Write `tests/e2e/pricing.spec.ts` testing the pricing page: verify all three tier cards render, billing toggle switches prices, seat selector updates totals, "Get Started Free" links to docs
- Write `tests/e2e/auth.spec.ts` testing the auth flow: unauthenticated user visiting /dashboard is redirected to /login with redirectTo param; login page renders correctly; after login, user lands on dashboard
- Configure Playwright to run in CI mode (`--reporter=github`) with screenshots on failure

### 15. Add Public API Documentation Page

- **Task ID**: api-docs
- **Depends On**: none
- **Assigned To**: brand-writer
- **Agent Type**: frontend-specialist
- **Parallel**: true
- Create MDX documentation at `content/docs/api/overview.mdx`, `content/docs/api/authentication.mdx`, `content/docs/api/usage.mdx`, `content/docs/api/rate-limits.mdx` documenting: authentication (Bearer API key), rate limits (100 req/min), the usage ingestion endpoint with full request/response examples, error codes
- The project already uses Fumadocs so these MDX files will be auto-routed to `/docs/api/*`
- Include curl examples and a note about the CLI using these same endpoints

### 16. Final Validation

- **Task ID**: validate-all
- **Depends On**: finops-copy, api-tests, cli-collector-fixes, cli-sync-hardening, dashboard-error-boundaries, dashboard-query-optimization, budget-email-alerts, weekly-digest-email, partition-automation, e2e-tests, api-docs, redis-rate-limit, sentry-setup
- **Assigned To**: final-validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `pnpm build` in kova-website -- verify zero TypeScript errors
- Run `pnpm test` in kova-website -- all Vitest API tests must pass
- Run `pnpm test` in kova-cli -- all 398+ tests must still pass
- Run `pnpm lint` in kova-cli -- zero TypeScript errors
- Verify hero heading no longer says "Plan the hunt. Run the pack."
- Verify `app/layout.tsx` title is FinOps-branded
- Verify `app/api/og/route.tsx` no longer references orchestration copy
- Verify `rate-limit-redis.ts` exists and is imported from `usage/route.ts`
- Verify `lib/env-validation.ts` is imported from `lib/supabase-admin.ts`
- Verify `app/api/health/route.ts` exists and responds to GET
- Verify Windsurf `makeId` includes `promptsUsed`
- Verify `sync-tracker.ts` exists and is used in `uploader.ts`
- Verify error boundaries are present in at least 3 dashboard pages
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. `pnpm build` in kova-website completes with zero errors and zero TypeScript errors
2. `pnpm test` in kova-website runs and all tests pass (minimum: smoke test + API route tests)
3. `pnpm test` in kova-cli passes with 398+ tests (existing suite must not regress)
4. The landing page `app/layout.tsx` default title no longer contains "Orchestration"
5. The hero component does not contain "Plan the hunt" or "Run the pack"
6. `app/api/og/route.tsx` does not contain orchestration copy
7. `app/api/v1/usage/rate-limit-redis.ts` exists
8. `app/api/v1/usage/route.ts` imports from `rate-limit-redis` (not the in-memory version) when Redis is configured
9. `lib/env-validation.ts` exists and is called before `createAdminClient()` runs
10. `app/api/health/route.ts` exists and returns 200 with a JSON status object
11. `src/lib/collectors/windsurf.ts` `makeId` function includes `promptsUsed` in the hash
12. `src/lib/sync-tracker.ts` exists and `uploadUsage()` uses it to skip already-uploaded records
13. `tests/integration/sync-upload.test.ts` exists with at least 4 test cases covering retry, deduplication, and success paths
14. At least one `<ErrorBoundary>` wrapper exists in `app/dashboard/page.tsx`
15. `app/api/notifications/budget-alerts/route.ts` exists
16. `lib/resend.ts` exists with a `sendBudgetAlertEmail` function
17. `supabase/functions/create-next-month-partition/index.ts` exists
18. At least one Playwright E2E test file exists in `tests/e2e/`
19. MDX API documentation exists at `content/docs/api/overview.mdx`

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# kova-website
cd /c/PROJ/kova-website
pnpm build                     # Zero TypeScript errors, zero build errors
pnpm lint                      # Zero lint errors
pnpm test                      # All Vitest tests pass
pnpm test:e2e --reporter=list  # Playwright E2E tests pass (requires running dev server)

# kova-cli
cd /c/PROJ/kova-cli
pnpm test                      # 398+ tests pass, zero regressions
pnpm lint                      # Zero TypeScript errors

# Content spot checks
grep -r "Orchestration CLI" /c/PROJ/kova-website/app/layout.tsx       # Should return nothing
grep -r "Plan the hunt" /c/PROJ/kova-website/components/landing/hero.tsx  # Should return nothing
grep -r "promptsUsed" /c/PROJ/kova-cli/src/lib/collectors/windsurf.ts     # Should exist in makeId

# File existence checks
test -f /c/PROJ/kova-website/app/api/v1/usage/rate-limit-redis.ts && echo "OK: redis rate limiter"
test -f /c/PROJ/kova-website/lib/env-validation.ts && echo "OK: env validation"
test -f /c/PROJ/kova-website/app/api/health/route.ts && echo "OK: health check"
test -f /c/PROJ/kova-cli/src/lib/sync-tracker.ts && echo "OK: sync tracker"
test -f /c/PROJ/kova-website/tests/e2e/dashboard.spec.ts && echo "OK: e2e tests"
test -f /c/PROJ/kova-website/content/docs/api/overview.mdx && echo "OK: api docs"
test -f /c/PROJ/kova-website/app/api/notifications/budget-alerts/route.ts && echo "OK: budget notifications"
test -f /c/PROJ/kova-website/supabase/functions/create-next-month-partition/index.ts && echo "OK: partition automation"
```

## Agent Work Sections

### notif-engineer

**Status**: Completed (Tasks #41 and #42)
**Tasks Completed**:

- Installed `resend` v6.9.4 as a production dependency in kova-website
- Created `supabase/migrations/004_budget_alerts_notified_email.sql` -- adds `notified_email BOOLEAN NOT NULL DEFAULT FALSE` column to `budget_alerts` table (the deployed 002 schema was missing this column; the reference schema in kova-cli docs had it). Also adds a partial index for fast unnotified-alert queries.
- Created `lib/resend.ts` -- lazy-initialized Resend client with `sendBudgetAlertEmail()` and `sendWeeklyDigestEmail()` functions. Both functions are no-ops (with a console.warn) when `RESEND_API_KEY` is not set, enabling safe local development.
- Created `app/api/v1/notifications/budget-alert/route.ts` -- internal POST endpoint protected by `x-notification-secret` header. Queries `budget_alerts` where `notified_email = FALSE` and `triggered_at > NOW() - 1 hour`. For each alert, resolves team owner email via `team_members` + `profiles` tables (two sequential queries per alert). Marks `notified_email = TRUE` on success.
- Created `app/api/v1/notifications/weekly-digest/route.ts` -- internal POST endpoint protected by same secret. Queries `profiles` for Pro/Enterprise users, aggregates `usage_daily_rollups` for current and prior week per user, sends digest via `sendWeeklyDigestEmail()`. Cron schedule documented in file header: `0 9 * * 1` (Monday 9am UTC).
- `pnpm build` passes with zero TypeScript errors. Both routes appear in the build output.

**Implementation Notes**:

- The `budget_alerts` table in migration 002 did not include `notified_email`. Migration 004 adds it additively.
- The budget-alert route uses three queries per unnotified alert (owner lookup, profile lookup, budget period lookup). For high-volume scenarios this could be optimized with a single JOIN query, but at expected alert volumes (O(10s) per hour) this is acceptable.
- The weekly-digest route processes users sequentially. For large user bases this should be refactored to batch sends. At current scale (MVP) sequential is fine.
- `topProject` is always `null` in the weekly digest because `usage_daily_rollups` does not have a project dimension -- project breakdown requires querying `usage_records` with GROUP BY which was intentionally excluded for performance.

**Integration Points**:

- Endpoint paths: `POST /api/v1/notifications/budget-alert` and `POST /api/v1/notifications/weekly-digest`
- Both endpoints require `x-notification-secret` header matching `NOTIFICATION_SECRET` env var
- `RESEND_API_KEY` env var must be set in Vercel for emails to actually send
- Migration 004 must be run against Supabase before the budget-alert endpoint will function correctly

**Next Agent Context**:

- infra-engineer (Task #43): Create `supabase/functions/notify-budget-alerts/index.ts` and `supabase/functions/weekly-digest/index.ts` Edge Functions to call these endpoints on the cron schedules defined in the route file headers.

---

## Notes

**Schema discrepancy to be aware of:** The actual Supabase schema in `docs/supabase-schema.sql` uses `developer_id` as the user field in `usage_records` and `usage_daily_rollups`, but the Next.js dashboard pages query `usage_records` using `.eq("user_id", user.id)`. This works because the deployed schema (in Supabase) may differ from the reference schema. Do not break existing queries -- only add new ones against the rollup tables.

**Rate limiter fallback:** The Redis rate limiter must gracefully degrade to the in-memory version if `UPSTASH_REDIS_REST_URL` is not set. This is critical for local development.

**Sentry opt-in for CLI:** Kova CLI must never send telemetry by default. Sentry in the CLI should only activate when `KOVA_TELEMETRY=1` is explicitly set by the user.

**Resend email testing:** In tests, mock the Resend client so no actual emails are sent. Use `vi.mock('resend')` in Vitest tests.

**Partition automation dependency:** The Supabase Edge Function for partition management requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be set as Edge Function secrets in the Supabase dashboard (not in `.env`).

**Windows path handling in Claude Code collector:** The `projectFallback` regex `replace(/^[A-Za-z]--/, "")` strips drive letter prefixes. This is correct for Windows paths stored in `~/.claude/projects/` where Kova itself runs. No change needed for this -- it is already handled.

**Do not change the Polar webhook handler signature verification:** The `@polar-sh/nextjs` `Webhooks()` wrapper handles HMAC verification automatically. Do not add manual signature checks on top of it.

**Security headers (from SaaS research):** Add HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy to `next.config.ts` via the `headers()` function. This is low-effort, high-impact. Also consider a CSP header with domain allowlisting for Supabase, Polar.sh, and any analytics providers.

**`app/global-error.tsx` is required:** Next.js App Router needs this file to catch React rendering errors at the root level. Without it, unhandled rendering errors go to a blank white page. The Sentry wizard creates this automatically.

**PostHog analytics (Phase 5 growth track):** Consider adding PostHog for conversion funnel tracking (signup -> first sync -> pricing view -> checkout -> subscription). Free tier: 1M events/month. Track key events: `first_sync`, `pricing_page_viewed`, `checkout_initiated`, `subscription_activated`. This informs pricing and onboarding decisions.

**Cost anomaly detection (future differentiator):** Simple z-score based detection (2 standard deviations above 14-day rolling average) can surface spend spikes in the analytics page. No ML required -- pure SQL or TypeScript. High value for engineering managers.

**Cost forecasting:** Linear regression on daily spend data produces "At your current rate, you'll spend ~$X this month" projections. 4 hours of work, high perceived value.

**Weekly digest email:** Schedule via Vercel Cron or Supabase cron. Content: total spend this week, top tools, week-over-week change, CTA to dashboard. Only for Pro/Enterprise users.

**Empty state onboarding:** When a new user hits the dashboard with no data, show an inline quickstart (code block with `npm install -g kova-cli && kova login`) instead of empty charts. Progress indicator: "3 steps to your first insight" -- Install CLI, Run kova track, Run kova sync.

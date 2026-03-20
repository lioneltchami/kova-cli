# Plan: Kova Phase 7 -- Enterprise Readiness, Scalability, and Ecosystem Expansion

## Task Description

Phase 7 transforms Kova from a growth-stage SaaS into an enterprise-grade AI FinOps platform. The product has strong individual and team features (phases 1-6) but lacks what large organizations require: SSO/SAML authentication, fine-grained RBAC beyond the current owner/admin/member roles, full audit logging, compliance exports (GDPR, SOC 2), cost centers and tagging infrastructure, a public REST API v2, outbound webhook delivery, new collectors for emerging AI coding tools (Aider, Continue, Cline, Amazon Q, Bolt, Lovable), CI/CD pipeline integrations (GitHub Actions action, GitLab CI template), an operator admin panel, a public status page, and i18n groundwork.

This is a complex, multi-project plan spanning `C:/PROJ/kova-cli/` (CLI, v0.4.0 today) and `C:/PROJ/kova-website/` (Next.js 16 + Supabase). It is organized into seven capability pillars executed across three phases with strict dependency ordering.

## Objective

Deliver all of the following:

1. **Enterprise Auth** -- SAML/SSO via Supabase Enterprise Auth + WorkOS, enforced per-org; MFA gate; API key scopes (`read`, `write`, `admin`)
2. **Advanced RBAC** -- `billing_admin`, `cost_center_manager`, `viewer` roles on top of existing owner/admin/member; permission matrix enforced at RLS + API layer
3. **Audit Log** -- `audit_events` table capturing every write action (who, what, when, from which IP/API key) with 90-day retention and CSV export
4. **Cost Centers and Tags** -- `cost_centers` table; `cost_center_id` + `tags JSONB` columns on `usage_records`; filtered rollups; budget scoping per cost center
5. **New Collectors** -- Aider (local log), Continue (local log), Cline (local JSONL), Amazon Q (billing API), Bolt.new (API), Lovable (API) -- 6 new collectors bringing total to 11
6. **CLI Enterprise Config** -- proxy support (`http_proxy`, `https_proxy`, custom CA cert path), SSO token auth flow, `kova audit export` command, `kova tag` command for cost-center tagging, `kova policy` command for org policy enforcement
7. **CI/CD Integration** -- `kova-action` GitHub Actions composite action (report cost delta on PR); GitLab CI include template; `kova ci-report` CLI command producing machine-readable JSON summary
8. **REST API v2** -- `/api/v2/` with versioned OpenAPI spec, cursor-based pagination, bulk query endpoints, webhook management CRUD, admin endpoints gated by `admin` scope API key
9. **Outbound Webhook Delivery** -- `webhook_endpoints` + `webhook_deliveries` tables; background delivery worker; retry with exponential backoff; HMAC-SHA256 signing; event types: `usage.synced`, `budget.alert`, `anomaly.detected`
10. **GDPR / Compliance** -- `kova data export` CLI command (full JSON export); `/api/v2/me/export` endpoint (async job queued); data deletion endpoint; 90-day default retention with per-org override; SOC 2 readiness notes
11. **Operator Admin Panel** -- `/admin` Next.js route group (service-role only); user search + plan override; usage query by org; webhook replay; feature flag overrides stored in `operator_flags` table
12. **Public Status Page** -- static `/status` page with uptime data from Supabase Edge Functions health check; incident banner component
13. **i18n Foundation** -- `next-intl` integration in kova-website; English only in v7 but locale-ready message files; CLI output localisation hooks

## Problem Statement

Enterprise procurement teams block Kova purchases without: (a) SSO/SAML for identity federation, (b) audit logs for compliance officers, (c) cost center tagging for chargeback reports, (d) GDPR-compliant data export and deletion, (e) a public API they can integrate into their internal tooling. Growth is capped at individual/team plan buyers until these gates are cleared. Additionally, the collector coverage gap (Aider, Continue, Cline, Amazon Q) leaves revenue on the table because engineering orgs using those tools cannot track them. The CI/CD gap means cost visibility disappears exactly where AI usage is highest (automated pipelines).

## Solution Approach

**Enterprise Auth**: Supabase supports SAML 2.0 via the Enterprise tier. We integrate WorkOS as a SAML broker (they offer a generous free tier) that fronts IdP connections. The `kova sso configure` CLI command and an SSO settings UI page allow org admins to connect their IdP. API keys gain a `scopes` column (array of strings) with enforcement at every API route via a shared `requireScope()` helper.

**RBAC Extension**: Add `billing_admin` and `cost_center_manager` roles to the `team_members.role` CHECK constraint via migration. A permissions lookup table `role_permissions` maps (role, resource, action) triples. API routes call `hasPermission(userId, resource, action)` before executing. RLS policies remain the safety net but permission checks move to application layer for granularity.

**Audit Log**: A single `audit_events` table written by a Postgres trigger on every INSERT/UPDATE/DELETE on the 8 key tables (teams, team_members, usage_records, budgets, api_keys, cost_centers, webhook_endpoints, subscription). Trigger captures `table_name`, `operation`, `old_row`, `new_row`, `actor_id` (from `auth.uid()` or a special `_api_key_id` context variable set by API routes). Retention enforced by a `pg_cron` job (or Supabase scheduled edge function) that deletes rows older than `org.audit_retention_days`.

**Cost Centers**: A new `cost_centers` table (`id`, `team_id`, `name`, `description`, `budget_usd`, `tags JSONB`). `usage_records` gains `cost_center_id FK` and `tags JSONB` columns. The CLI `kova tag` command sets the default cost center for a given project directory in `~/.kova/config.json`. During sync, each record's `project` field is matched against a project-to-cost-center mapping stored in config and in the database `project_cost_center_mappings` table. Rollup views are extended to include `cost_center_id`.

**New Collectors**: Each follows the exact same `Collector` interface already in `src/lib/collectors/types.ts`. Pattern analysis of existing collectors shows two archetypes: local-file parsers (Claude Code, Copilot) and API pollers (Cursor, Windsurf, Devin). New collectors map naturally: Aider (`.aider/` YAML session files), Continue (`.continue/` SQLite or JSON), Cline (VS Code extension local JSON), Amazon Q (AWS CostExplorer API), Bolt (Stackblitz billing API), Lovable (Lovable.dev API).

**CI/CD**: A `kova-action` composite action in a new `kova-action/` subdirectory of kova-cli (or a separate repo with symlink). It runs `kova ci-report --format=json` and posts a cost-delta comment on the PR via GitHub REST API. A `kova ci-report` command reads local records, computes cost for the current git-detected branch, and outputs structured JSON to stdout (machine-readable) or a formatted table (human-readable). A `.gitlab-ci.yml` include template is shipped as a file in `templates/gitlab-ci-kova.yml`.

**REST API v2**: New `/api/v2/` route group. Adds OpenAPI spec at `/api/v2/openapi.json` (generated from Zod schemas via `zod-to-openapi`). Routes: `GET /api/v2/usage` (paginated, filterable), `GET /api/v2/usage/rollup`, `POST /api/v2/usage` (same as v1 for backward compat), `GET /api/v2/cost-centers`, `POST /api/v2/cost-centers`, `GET /api/v2/webhooks`, `POST /api/v2/webhooks`, `DELETE /api/v2/webhooks/:id`, `GET /api/v2/audit-log`, `GET /api/v2/admin/orgs` (admin scope only).

**Webhook Delivery**: A Supabase Edge Function `webhook-delivery-worker` polls `webhook_deliveries WHERE status = 'pending'` every 30 seconds. Delivery attempts POST to the endpoint URL with HMAC-SHA256 signature header. On failure, exponential backoff up to 5 retries then `status = 'failed'`. The dashboard shows a webhook delivery log per endpoint.

**GDPR**: `kova data export` runs locally and exports all records in `~/.kova/usage.json` as a portable JSON file. `/api/v2/me/export` triggers a server-side job that assembles all user data (profile, usage records, budgets, audit events) into a signed S3/R2 URL (or Supabase Storage presigned URL) valid for 24 hours. A `DELETE /api/v2/me` endpoint hard-deletes the user row (cascades via FK). Dashboard has "Download My Data" and "Delete My Account" buttons in Settings.

**Admin Panel**: Protected by a `is_operator` boolean on `profiles` table (or via `NEXT_PUBLIC_OPERATOR_EMAILS` env var checked at middleware). Route group `/admin` with pages: Users (search/filter), Orgs (plan override), Webhook Replay, Feature Flags. All reads use the Supabase service role client; all writes are logged to `operator_audit_events`.

**Status Page**: Static `/status` route. A Supabase Edge Function `health-checker` runs every 5 minutes, writes a row to `health_checks` table (component, status, latency_ms, checked_at). The status page server-component queries the last 24 hours of rows and renders green/yellow/red per component (API, Dashboard, Sync, Webhooks).

**i18n**: Install `next-intl`. Move all hardcoded strings in dashboard layouts and shared components to `/messages/en.json`. Wire `NextIntlClientProvider` at the root layout. All existing text remains English; the infrastructure is ready for community translations in v8+.

## Relevant Files

### kova-cli: Files to Modify

- `src/types.ts` -- Add new `AiTool` union values (aider, continue, cline, amazon_q, bolt, lovable); add `CostCenterConfig`, `ProxyConfig`, `SSOConfig` to `KovaFinOpsConfig`; add `CiReportOutput` type
- `src/lib/constants.ts` -- Add paths for Aider/Continue/Cline local files; add new tool costs for Amazon Q; bump VERSION to "0.5.0"
- `src/lib/config-store.ts` -- Add `proxy`, `sso`, `cost_centers` fields to config schema
- `src/lib/collectors/types.ts` -- No changes needed (interface is generic enough)
- `src/index.ts` -- Register `tag`, `audit`, `ci-report`, `sso`, `policy` commands

### kova-cli: New Files to Create

- `src/lib/collectors/aider.ts` -- Aider local YAML/JSON session file parser
- `src/lib/collectors/continue.ts` -- Continue.dev local session file parser
- `src/lib/collectors/cline.ts` -- Cline VS Code extension local JSON parser
- `src/lib/collectors/amazon-q.ts` -- Amazon Q cost API collector
- `src/lib/collectors/bolt.ts` -- Bolt.new (Stackblitz) billing API collector
- `src/lib/collectors/lovable.ts` -- Lovable.dev API collector
- `src/commands/tag.ts` -- `kova tag <project> --cost-center <id>` command
- `src/commands/audit.ts` -- `kova audit export [--format csv|json] [--since YYYY-MM]` command
- `src/commands/ci-report.ts` -- `kova ci-report [--format json|table] [--base-branch main]` command
- `src/commands/sso.ts` -- `kova sso configure|status|login` subcommands
- `src/commands/policy.ts` -- `kova policy list|set|enforce` for org policy enforcement
- `templates/gitlab-ci-kova.yml` -- GitLab CI include template
- `kova-action/action.yml` -- GitHub Actions composite action definition
- `kova-action/README.md` -- Action usage documentation
- `tests/collectors/aider.test.ts` -- Aider collector unit tests
- `tests/collectors/continue.test.ts`
- `tests/collectors/cline.test.ts`
- `tests/collectors/amazon-q.test.ts`
- `tests/commands/tag.test.ts`
- `tests/commands/ci-report.test.ts`
- `tests/commands/audit.test.ts`

### kova-website: Files to Modify

- `supabase/migrations/007_enterprise_schema.sql` -- audit_events, cost_centers, project_cost_center_mappings, role_permissions, webhook_endpoints, webhook_deliveries, health_checks, operator_flags tables; extend usage_records with cost_center_id + tags; extend team_members role CHECK; extend api_keys with scopes column
- `supabase/migrations/008_gdpr_retention.sql` -- data retention policy functions, pg_cron job for audit log cleanup
- `middleware.ts` -- Add `/admin` route protection (operator check); add `/api/v2` scope enforcement middleware
- `app/layout.tsx` -- Wrap with `NextIntlClientProvider`
- `app/dashboard/settings/page.tsx` -- Add GDPR "Download My Data" + "Delete My Account" section; add SSO settings section; add API key scopes display

### kova-website: New Files to Create

**Supabase / Backend**
- `supabase/migrations/007_enterprise_schema.sql`
- `supabase/migrations/008_gdpr_retention.sql`
- `supabase/functions/webhook-delivery-worker/index.ts` -- Edge function for webhook delivery
- `supabase/functions/health-checker/index.ts` -- Edge function for status page health checks

**API v2 Routes**
- `app/api/v2/usage/route.ts` -- Paginated, filterable usage query
- `app/api/v2/usage/rollup/route.ts` -- Aggregated rollup endpoint
- `app/api/v2/cost-centers/route.ts` -- CRUD for cost centers
- `app/api/v2/webhooks/route.ts` -- List + create webhook endpoints
- `app/api/v2/webhooks/[id]/route.ts` -- Update + delete webhook endpoint
- `app/api/v2/webhooks/[id]/deliveries/route.ts` -- Delivery history
- `app/api/v2/audit-log/route.ts` -- Paginated audit log
- `app/api/v2/me/export/route.ts` -- GDPR data export job trigger
- `app/api/v2/me/route.ts` -- DELETE for account deletion
- `app/api/v2/admin/orgs/route.ts` -- Operator-only org list + plan override
- `app/api/v2/admin/users/route.ts` -- Operator-only user search
- `app/api/v2/openapi.json/route.ts` -- Serves generated OpenAPI spec

**Dashboard Pages**
- `app/dashboard/cost-centers/page.tsx` -- Cost center list with budget vs. actual
- `app/dashboard/cost-centers/[id]/page.tsx` -- Cost center detail with usage breakdown
- `app/dashboard/audit-log/page.tsx` -- Filterable audit log viewer
- `app/dashboard/webhooks/page.tsx` -- Webhook endpoint management + delivery log
- `app/dashboard/sso/page.tsx` -- SSO / SAML configuration page
- `app/status/page.tsx` -- Public status page
- `app/admin/layout.tsx` -- Admin panel layout (operator auth gate)
- `app/admin/page.tsx` -- Admin panel overview
- `app/admin/users/page.tsx` -- User search + plan override
- `app/admin/orgs/page.tsx` -- Org management
- `app/admin/webhooks/page.tsx` -- Webhook replay tool

**Components**
- `components/dashboard/cost-center-selector.tsx` -- Dropdown for filtering by cost center
- `components/dashboard/audit-log-table.tsx` -- Sortable audit log display
- `components/dashboard/webhook-delivery-log.tsx` -- Webhook delivery status list
- `components/dashboard/sso-settings-form.tsx` -- SAML IdP configuration form
- `components/dashboard/gdpr-actions.tsx` -- Export + delete account buttons
- `components/status/status-indicator.tsx` -- Green/yellow/red component status badge

**i18n**
- `messages/en.json` -- All UI strings extracted from dashboard components
- `lib/i18n.ts` -- `next-intl` configuration

## Implementation Phases

### Phase 1: Foundation (Database, Auth Extension, New Collectors)

Establish the schema and data layer before any UI or API work. This phase de-risks the hardest parts: schema migrations, RLS on new tables, and the new collector implementations which involve reverse-engineering undocumented local file formats.

**Schema work**: Migration 007 adds all new tables and columns. Migration 008 adds retention functions. All new tables get RLS immediately. The `audit_events` trigger is installed and tested. Cost center columns are added to `usage_records`.

**New collectors**: Six new collectors following the established `Collector` interface. Aider and Continue use local file parsing (same pattern as Claude Code collector). Cline parses VS Code extension storage SQLite. Amazon Q uses the AWS Cost Explorer API (needs `AWS_ACCESS_KEY_ID` credential). Bolt and Lovable use their respective billing APIs.

**CLI enterprise config**: Config schema extension for proxy settings (`http_proxy`, `https_proxy`, `ca_cert_path`), SSO token auth, and cost center mappings. The `config-store.ts` update is backward-compatible (new fields have defaults).

### Phase 2: Core Implementation (API v2, Webhooks, Enterprise Features)

Build the API v2 surface, webhook delivery infrastructure, RBAC extension, audit log viewer, and CI/CD integration. This is the highest-value phase for enterprise buyers.

**API v2**: All `/api/v2/` routes with OpenAPI spec generation. Scope enforcement via `requireScope()` middleware extracted into `lib/api-auth.ts` shared helper.

**Webhook delivery**: Edge functions for the delivery worker. The `webhook_deliveries` table is polled; HMAC signing is implemented with `crypto.subtle`. Dashboard page to manage endpoints and view delivery history.

**RBAC**: New roles in migration. `role_permissions` lookup populated with default permissions for all roles. Application-layer `hasPermission()` helper function used in API routes and dashboard server components.

**CI/CD**: `kova ci-report` command. `kova-action/action.yml` composite action. GitLab CI template. GitHub Actions action tested against a fixture repository.

**Cost centers**: CLI `kova tag` command. Dashboard cost center pages. API routes. Rollup views updated.

### Phase 3: Integration and Polish (Admin Panel, Status Page, GDPR, i18n, Quality)

Complete the operator experience, compliance features, and quality gates.

**Admin panel**: `/admin` route group with operator middleware guard. User and org management pages. Feature flag system backed by `operator_flags` table. Webhook replay tool.

**Status page**: Health checker edge function. `/status` public page. Incident banner in main layout (shows if `status = 'degraded'` for any component).

**GDPR**: Data export async job. Account deletion endpoint. Dashboard UI components for both. `kova data export` CLI command.

**i18n**: `next-intl` installed. `messages/en.json` populated. Root layout wrapped.

**Quality**: Full test pass across both repos. Playwright E2E for new dashboard flows. API v2 integration tests. Collector unit tests with fixture data.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- Your role is to validate all work is going well and make sure the team is on track to complete the plan.

### Team Members

- Specialist
  - Name: supabase-migrations
  - Role: Write and validate all Supabase migrations (007, 008), RLS policies, trigger functions, and Edge Functions for webhook delivery and health checks
  - Agent Type: supabase-specialist
  - Resume: true

- Specialist
  - Name: cli-collectors
  - Role: Implement all six new CLI collectors (Aider, Continue, Cline, Amazon Q, Bolt, Lovable), extend types.ts and constants.ts, write unit tests with fixture data
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: cli-commands
  - Role: Implement kova tag, kova audit, kova ci-report, kova sso, kova policy commands; GitHub Actions kova-action composite action; GitLab CI template; update config-store.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: api-v2
  - Role: Build all /api/v2/ route handlers, the OpenAPI spec generation, scope enforcement middleware, requireScope helper, and shared api-auth.ts utility
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: dashboard-enterprise
  - Role: Build all new dashboard pages (cost centers, audit log, webhooks, SSO, admin panel) and new dashboard components (cost-center-selector, audit-log-table, webhook-delivery-log, sso-settings-form, gdpr-actions)
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: platform-features
  - Role: Implement status page, i18n foundation (next-intl), operator admin panel pages, GDPR export/deletion endpoints and CLI command
  - Agent Type: frontend-specialist
  - Resume: true

- Quality Engineer (Validator)
  - Name: phase7-validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode) -- run all test suites, check migration correctness, verify API contracts, confirm RLS policies, audit compliance completeness
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Schema Migration 007 -- Enterprise Tables

- **Task ID**: schema-enterprise
- **Depends On**: none
- **Assigned To**: supabase-migrations
- **Agent Type**: supabase-specialist
- **Parallel**: false
- Read all 6 existing migrations to understand current schema fully
- Create `supabase/migrations/007_enterprise_schema.sql` with: `audit_events`, `cost_centers`, `project_cost_center_mappings`, `role_permissions`, `webhook_endpoints`, `webhook_deliveries`, `health_checks`, `operator_flags` tables
- Add `cost_center_id UUID REFERENCES cost_centers(id)` and `tags JSONB DEFAULT '{}'` columns to `usage_records`
- Add `scopes TEXT[] DEFAULT ARRAY['read','write']` column to `private.api_keys`
- Extend `team_members.role` CHECK constraint to include `billing_admin` and `cost_center_manager`
- Add `is_operator BOOLEAN DEFAULT FALSE` to `profiles`
- Enable RLS on all new tables with appropriate policies (team members see their org's data; audit_events read-only for owner/admin; webhook_endpoints managed by owner/admin; health_checks public read)
- Write `audit_trigger_fn()` SECURITY DEFINER function and attach it to teams, team_members, usage_records, budgets, api_keys, cost_centers, webhook_endpoints, subscriptions via `CREATE TRIGGER`
- Populate `role_permissions` with default permission rows for all 5 roles across resources: usage (read/write), budgets (read/write), team (read/manage), cost_centers (read/write), audit_log (read), webhooks (read/manage), api_keys (read/manage)
- All constraints, indexes, and foreign keys must be present

### 2. Schema Migration 008 -- GDPR Retention

- **Task ID**: schema-retention
- **Depends On**: schema-enterprise
- **Assigned To**: supabase-migrations
- **Agent Type**: supabase-specialist
- **Parallel**: false
- Create `supabase/migrations/008_gdpr_retention.sql`
- Add `audit_retention_days INTEGER DEFAULT 90` to `teams` table
- Write `purge_old_audit_events()` SECURITY DEFINER function that deletes `audit_events` older than `teams.audit_retention_days` days
- Write `create_data_export_job(p_user_id UUID)` SECURITY DEFINER RPC function that inserts a row into a `data_export_jobs` table (id, user_id, status, created_at, download_url, expires_at) and returns the job id
- Add `data_export_jobs` table with RLS (users see only their own jobs)
- Write `hard_delete_user(p_user_id UUID)` SECURITY DEFINER function callable only by service role; deletes auth.users row (cascades everything)
- Document pg_cron setup instructions in a comment block (Supabase Pro feature)

### 3. Supabase Edge Functions

- **Task ID**: edge-functions
- **Depends On**: schema-enterprise
- **Assigned To**: supabase-migrations
- **Agent Type**: supabase-specialist
- **Parallel**: false
- Create `supabase/functions/webhook-delivery-worker/index.ts`: query `webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= NOW()` (max 50 rows), for each row fetch the parent `webhook_endpoints` URL and secret, compute HMAC-SHA256 signature over the payload using `crypto.subtle`, POST to URL with `X-Kova-Signature` header, update `webhook_deliveries` row: success sets `status='delivered'`, failure increments `attempt_count`, computes next backoff (2^attempt * 30s, max 3600s), sets `status='pending'` or `status='failed'` after 5 attempts
- Create `supabase/functions/health-checker/index.ts`: check `/api/health` endpoint, Supabase REST endpoint, usage sync endpoint; write results to `health_checks` table (component, status, latency_ms, checked_at)
- Both functions should handle errors gracefully and never crash

### 4. New CLI Collectors -- Local File Parsers

- **Task ID**: collectors-local
- **Depends On**: none
- **Assigned To**: cli-collectors
- **Agent Type**: backend-engineer
- **Parallel**: true
- Read all 5 existing collectors thoroughly before writing any new ones (especially claude-code.ts as the canonical local-file pattern and devin.ts as the canonical API pattern)
- Read `src/types.ts`, `src/lib/constants.ts`, `src/lib/collectors/types.ts` fully
- Create `src/lib/collectors/aider.ts`: Aider stores session data in `.aider.chat.history.md` and cost data in `.aider.model.metadata.json` (or `.aider/` directory). Parse cost and model from these files. Aider also has a `--no-check-update` flag that can write JSON logs. Support scanning `~/.aider/` and current working directory. Export `aiderCollector` matching the `Collector` interface
- Create `src/lib/collectors/continue.ts`: Continue.dev stores sessions in `~/.continue/sessions/` as JSON files (or SQLite). Parse session files, extract model calls, token counts where available. Export `continueCollector`
- Create `src/lib/collectors/cline.ts`: Cline (formerly Claude-Dev) stores data in VS Code extension storage at `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/` (macOS), `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/` (Windows), `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/` (Linux). Parse `api_conversation_history.json` files per task. Export `clineCollector`
- Update `src/types.ts`: add `"aider" | "continue" | "cline" | "amazon_q" | "bolt" | "lovable"` to `AiTool` union
- Update `src/lib/constants.ts`: add path constants for Aider/Continue/Cline and add `"aider"`, `"continue"`, `"cline"` to `TOKEN_COSTS` (where pricing is known)
- Write unit tests with fixture files: `tests/collectors/aider.test.ts`, `tests/collectors/continue.test.ts`, `tests/collectors/cline.test.ts` -- test with sample file contents, verify records shape, test `since` filtering, test error handling on corrupt files

### 5. New CLI Collectors -- API Collectors

- **Task ID**: collectors-api
- **Depends On**: none
- **Assigned To**: cli-collectors
- **Agent Type**: backend-engineer
- **Parallel**: true
- Create `src/lib/collectors/amazon-q.ts`: Amazon Q Developer uses AWS Cost Explorer API (`POST https://ce.us-east-1.amazonaws.com/GetCostAndUsage` or the `@aws-sdk/client-cost-explorer` package). Accept `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` from environment or from `kova config set-key amazon_q <access_key>:<secret>:<region>` format. Query `SERVICE = "Amazon Q Developer"` with daily granularity. Export `amazonQCollector`
- Create `src/lib/collectors/bolt.ts`: Bolt.new (StackBlitz) provides usage data via `https://bolt.new/api/usage` or equivalent. Implement with graceful fallback if API is undocumented (return empty records with an error noting manual entry). Export `boltCollector`
- Create `src/lib/collectors/lovable.ts`: Lovable.dev provides usage via `https://lovable.dev/api/v1/usage` or equivalent. Same graceful fallback pattern. Export `lovableCollector`
- Update `src/lib/constants.ts`: add API URL constants and cost rates for Amazon Q (per API call pricing)
- Write `tests/collectors/amazon-q.test.ts` with mocked fetch responses

### 6. CLI Enterprise Commands

- **Task ID**: cli-enterprise-commands
- **Depends On**: collectors-local, collectors-api
- **Assigned To**: cli-commands
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read all existing commands in `src/commands/` before writing new ones -- match exact style (chalk colors, logger.ts usage, Commander.js patterns)
- Update `src/lib/config-store.ts`: add `proxy: { http_proxy?: string; https_proxy?: string; ca_cert_path?: string }`, `sso: { enabled: boolean; issuer?: string; token?: string; token_expires_at?: string }`, `cost_centers: Array<{ id: string; name: string; projects: string[] }>` to `KovaFinOpsConfig`; update `getDefaultConfig()` with new fields; ensure `updateConfig()` deep-merges new sections
- Create `src/commands/tag.ts`: `kova tag [project] --cost-center <id>` -- reads cost center list from dashboard API, prompts if no `--cost-center`, saves `project -> cost_center_id` mapping to `config.tracking.cost_centers`
- Create `src/commands/audit.ts`: `kova audit export --format [csv|json] --since [YYYY-MM] --output [path]` -- calls `GET /api/v2/audit-log` with Bearer auth, paginates through all pages, writes to file or stdout; also supports `kova audit status` to show retention settings
- Create `src/commands/ci-report.ts`: `kova ci-report --format [json|table] --period [7d|30d] --compare [base-branch]` -- reads local usage records, optionally reads a `.kova-baseline.json` file from the base branch (written by a previous CI run), computes cost delta, outputs to stdout in chosen format. For JSON format output: `{ period_cost_usd, baseline_cost_usd, delta_usd, delta_pct, by_tool, by_model, sessions, report_url }`. For table format: ASCII table identical to `kova compare` style
- Create `src/commands/sso.ts`: `kova sso configure --issuer <url>` (saves to config), `kova sso login` (opens browser to SSO login URL, waits for redirect with token, saves token to config.sso.token), `kova sso status` (shows current SSO config and token expiry)
- Create `src/commands/policy.ts`: `kova policy list` (fetches org policies from API), `kova policy set <key> <value>` (owner/admin only), `kova policy enforce` (reads local config against org policies, warns on violations)
- Update `src/index.ts`: register all 5 new commands; update `src/lib/completions.ts`; update `ALL_TOOLS` in `src/commands/init.ts` to include the 6 new tools
- Write tests: `tests/commands/tag.test.ts`, `tests/commands/ci-report.test.ts`, `tests/commands/audit.test.ts`
- Create `templates/gitlab-ci-kova.yml`: a GitLab CI include template with a `kova-cost-report` job that installs kova, runs `kova track` then `kova ci-report --format json`, and optionally posts a merge request note via GitLab API
- Create `kova-action/action.yml`: GitHub Actions composite action with inputs (kova-api-key, github-token, base-branch, fail-on-increase), steps: install kova CLI via npm, run `kova track`, run `kova ci-report --format json`, post PR comment via GitHub Script, optionally fail if cost increased
- Create `kova-action/README.md`: usage documentation with example workflow YAML

### 7. API v2 Core Routes

- **Task ID**: api-v2-core
- **Depends On**: schema-enterprise
- **Assigned To**: api-v2
- **Agent Type**: backend-engineer
- **Parallel**: false
- Read all existing `/api/v1/` routes thoroughly before starting -- understand the auth pattern (Bearer API key via `verify_api_key` RPC), rate limiting via Upstash, and error response format
- Create `lib/api-auth.ts`: shared helper exporting `verifyApiKey(request)` returning `{ userId, teamId, plan, scopes }` or throwing; `requireScope(context, scope)` that checks the key's `scopes` array; `verifySessionAuth(request)` for cookie-auth routes
- Create `app/api/v2/usage/route.ts`: `GET` with query params `since`, `until`, `tool`, `model`, `project`, `cost_center_id`, `cursor` (cursor-based pagination, page size 100), returns `{ data: UsageRecord[], next_cursor, total_estimate }`; requires `read` scope
- Create `app/api/v2/usage/rollup/route.ts`: `GET` with `group_by=day|week|month|tool|model|cost_center`, `since`, `until` -- returns aggregated data; requires `read` scope
- Create `app/api/v2/cost-centers/route.ts`: `GET` list, `POST` create; requires `read` / `write` scope respectively
- Create `app/api/v2/cost-centers/[id]/route.ts`: `GET`, `PATCH`, `DELETE`; owner/admin only for write
- Create `app/api/v2/webhooks/route.ts`: `GET` list webhook endpoints, `POST` create (validate URL reachability with a test ping); requires appropriate scope
- Create `app/api/v2/webhooks/[id]/route.ts`: `GET`, `PATCH` (update URL/secret/events), `DELETE`
- Create `app/api/v2/webhooks/[id]/deliveries/route.ts`: `GET` paginated delivery history
- Create `app/api/v2/audit-log/route.ts`: `GET` with `since`, `until`, `actor_id`, `table_name`, `operation`, cursor pagination; requires `admin` scope or owner/admin role
- Create `app/api/v2/openapi.json/route.ts`: returns static or dynamically generated OpenAPI 3.1 spec; document all v2 routes including security schemes (Bearer with scopes)

### 8. API v2 Admin and GDPR Routes

- **Task ID**: api-v2-admin
- **Depends On**: api-v2-core, schema-retention
- **Assigned To**: api-v2
- **Agent Type**: backend-engineer
- **Parallel**: false
- Create `app/api/v2/me/export/route.ts`: `POST` triggers `create_data_export_job` RPC, returns job id; `GET` polls job status; job is processed by an Edge Function that queries all user data (profile, usage_records, budgets, audit_events, subscriptions), zips to JSON, uploads to Supabase Storage, writes download URL back to `data_export_jobs`
- Create `app/api/v2/me/route.ts`: `DELETE` -- calls `hard_delete_user` RPC (service role); invalidates all sessions; returns 204
- Create `app/api/v2/admin/orgs/route.ts`: `GET` list all teams (admin scope or operator middleware); `PATCH /:id` to override plan (operator only, logged to operator_audit_events)
- Create `app/api/v2/admin/users/route.ts`: `GET` search users by email/username (operator only); `PATCH /:id` to set `is_operator` or override plan
- Add webhook event triggering: extend the existing `/api/v1/usage` upload route to enqueue a `usage.synced` event in `webhook_deliveries` for all active webhook endpoints on that team

### 9. Dashboard Enterprise Pages

- **Task ID**: dashboard-enterprise-pages
- **Depends On**: api-v2-core
- **Assigned To**: dashboard-enterprise
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Read all existing dashboard pages thoroughly: `app/dashboard/page.tsx`, `app/dashboard/analytics/page.tsx`, `app/dashboard/team/page.tsx`, `app/dashboard/settings/page.tsx` -- understand the exact dark theme, component patterns (KpiCard, recharts usage), data fetching approach (server components + admin client)
- Read all existing dashboard components to understand reusable patterns
- Create `components/dashboard/cost-center-selector.tsx`: a combobox component showing cost center names with "All" option, used as a filter in usage and analytics pages
- Create `components/dashboard/audit-log-table.tsx`: paginated table with columns: timestamp, actor, action, resource, details (expandable). Server-rendered with client-side pagination
- Create `components/dashboard/webhook-delivery-log.tsx`: table showing delivery attempts, status (delivered/pending/failed), response code, latency, timestamp
- Create `components/dashboard/sso-settings-form.tsx`: form with fields for SAML IdP metadata URL or XML upload, entity ID, redirect URL (pre-filled from current host). Client component
- Create `components/dashboard/gdpr-actions.tsx`: two buttons ("Download My Data" + "Delete My Account") with confirmation dialog for the delete action. Client component
- Create `app/dashboard/cost-centers/page.tsx`: list of cost centers with per-center KPIs (budget, spend MTD, % used, member count). Links to detail pages
- Create `app/dashboard/cost-centers/[id]/page.tsx`: detail view with usage breakdown by tool/model, member cost table, budget progress bar
- Create `app/dashboard/audit-log/page.tsx`: filterable audit log using `audit-log-table` component, with date range picker and actor/resource filters
- Create `app/dashboard/webhooks/page.tsx`: webhook endpoint management (add, edit, delete, test ping) plus delivery log per endpoint
- Create `app/dashboard/sso/page.tsx`: SSO/SAML configuration using `sso-settings-form` component; shows connection status and last authentication
- Update `app/dashboard/settings/page.tsx`: add GDPR section using `gdpr-actions` component; add API key scopes display (show `scopes` array per key); add link to SSO page for enterprise users

### 10. Status Page and Admin Panel

- **Task ID**: status-and-admin
- **Depends On**: edge-functions, api-v2-admin
- **Assigned To**: platform-features
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Read `middleware.ts` to understand existing route protection patterns before adding operator guard
- Create `components/status/status-indicator.tsx`: displays green/yellow/red dot with label for a single component's health status
- Create `app/status/page.tsx`: public server component; queries `health_checks` table via admin client for last 24 hours of data; renders a status grid (API, Dashboard, Sync, Webhooks, Database) with uptime percentage; shows an incident banner if any component has `status = 'degraded'` in the last hour
- Update `middleware.ts`: add `/admin` route guard that checks `is_operator = true` on the user's profile (via service role query); redirect non-operators to `/dashboard`
- Create `app/admin/layout.tsx`: admin panel sidebar with navigation (Overview, Users, Orgs, Webhooks, Feature Flags)
- Create `app/admin/page.tsx`: overview with platform KPIs (total users, total orgs, usage records count, revenue estimate from subscriptions)
- Create `app/admin/users/page.tsx`: searchable user table with columns: email, plan, created_at, last_sync; action to override plan (calls `/api/v2/admin/users/:id`)
- Create `app/admin/orgs/page.tsx`: org table with columns: name, plan, member count, cost MTD; action to override plan
- Create `app/admin/webhooks/page.tsx`: lists all failed webhook deliveries across all orgs; replay button that resets status to `pending`

### 11. GDPR Data Export and i18n Foundation

- **Task ID**: gdpr-and-i18n
- **Depends On**: api-v2-admin
- **Assigned To**: platform-features
- **Agent Type**: frontend-specialist
- **Parallel**: false
- Implement the `kova data export` CLI command (in `src/commands/audit.ts` as `kova audit export --local` subcommand, or as a separate `kova data export` command): exports all local `~/.kova/usage.json` data to a portable JSON file at a specified path. No API call required -- pure local operation. Format: `{ exported_at, kova_version, usage_records: [...], config: {...omitting credentials...} }`
- Implement the server-side data export Edge Function: `supabase/functions/export-user-data/index.ts` -- assembles profile, usage_records (all time), budgets, audit_events, subscriptions into a single JSON payload, uploads to Supabase Storage as `exports/{user_id}/{job_id}.json`, updates `data_export_jobs.status = 'ready'` and `download_url`
- Install `next-intl` in kova-website: `pnpm add next-intl`
- Create `lib/i18n.ts`: configure `next-intl` with the request locale; default to `en`; export `getRequestConfig`
- Create `messages/en.json`: extract all hardcoded UI strings from the 8 core dashboard layout components and sidebar (`app/dashboard/layout.tsx`, `components/dashboard/sidebar.tsx`, `app/dashboard/page.tsx` labels, common action labels: "Save", "Cancel", "Delete", "Export", "Loading...", error messages)
- Update `app/layout.tsx` to wrap with `NextIntlClientProvider` passing the locale messages
- Verify no runtime errors with `pnpm build`

### 12. Final Validation

- **Task ID**: validate-all
- **Depends On**: schema-enterprise, schema-retention, edge-functions, collectors-local, collectors-api, cli-enterprise-commands, api-v2-core, api-v2-admin, dashboard-enterprise-pages, status-and-admin, gdpr-and-i18n
- **Assigned To**: phase7-validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Operate in validation mode: inspect and report only, do not modify files
- In `kova-cli`: run `pnpm test` -- verify all 420+ existing tests pass plus new collector and command tests (target: 460+ total)
- In `kova-cli`: run `pnpm lint` (TypeScript strict mode) -- zero errors
- In `kova-cli`: run `pnpm build` -- clean build with no warnings
- In `kova-website`: run `pnpm build` -- clean Next.js production build
- In `kova-website`: run `pnpm test` -- verify all existing + new tests pass
- In `kova-website`: run `pnpm lint`
- Verify `supabase/migrations/007_enterprise_schema.sql`: all new tables have RLS enabled; all FKs reference correct parent tables; `audit_trigger_fn` is attached to all 8 specified tables; `role_permissions` is populated; no `DROP TABLE` or `DROP COLUMN` statements (migrations must be additive)
- Verify `supabase/migrations/008_gdpr_retention.sql`: `data_export_jobs` table has RLS; `hard_delete_user` is SECURITY DEFINER; `purge_old_audit_events` is SECURITY DEFINER
- Verify all 6 new collectors: each exports a named `*Collector` constant; `isAvailable()` is async and returns boolean; `collect()` signature matches `Collector` interface; `CollectorResult.tool` matches the AiTool literal
- Verify all 5 new CLI commands are registered in `src/index.ts` and appear in `kova --help` output (run `node dist/index.js --help` after build)
- Verify `kova-action/action.yml` is valid GitHub Actions composite action syntax (check required fields: `name`, `description`, `runs.using: "composite"`, `runs.steps`)
- Verify `app/api/v2/openapi.json/route.ts` returns a valid JSON response with `openapi: "3.1.0"` field
- Verify `app/status/page.tsx` is publicly accessible (no auth middleware applied to `/status`)
- Verify `app/admin/layout.tsx` has a check that redirects non-operators (inspect middleware or layout auth guard logic)
- Verify `messages/en.json` is valid JSON and is loaded in `app/layout.tsx`
- Report: list every acceptance criterion as PASS or FAIL with evidence

## Acceptance Criteria

1. All 420+ existing kova-cli tests continue to pass; total test count reaches 460+
2. Six new collectors (Aider, Continue, Cline, Amazon Q, Bolt, Lovable) are implemented, each matching the `Collector` interface and exporting a named `*Collector` constant
3. Five new CLI commands (`kova tag`, `kova audit`, `kova ci-report`, `kova sso`, `kova policy`) are registered and appear in `kova --help`
4. `kova ci-report --format json` produces valid JSON with keys: `period_cost_usd`, `baseline_cost_usd`, `delta_usd`, `delta_pct`, `by_tool`, `by_model`, `sessions`
5. `kova-action/action.yml` is a valid GitHub Actions composite action with `kova-api-key` and `github-token` inputs
6. `templates/gitlab-ci-kova.yml` is a valid GitLab CI YAML include template
7. Migration 007 creates all 8 new tables, extends `usage_records` with `cost_center_id` and `tags`, extends `team_members.role` CHECK, adds `api_keys.scopes`, adds `profiles.is_operator`; all new tables have RLS enabled
8. Migration 008 creates `data_export_jobs` table and the three SECURITY DEFINER functions
9. Two Supabase Edge Functions exist: `webhook-delivery-worker` and `health-checker`
10. All `/api/v2/` routes respond with correct status codes; `GET /api/v2/openapi.json` returns a valid OpenAPI 3.1 spec
11. `requireScope()` in `lib/api-auth.ts` is used by all API v2 write routes
12. Dashboard has 5 new pages: cost-centers, audit-log, webhooks, sso, and updated settings with GDPR section
13. `/status` page is publicly accessible and renders health check data
14. `/admin` route group is protected by operator check in middleware or layout
15. `app/layout.tsx` wraps with `NextIntlClientProvider` and `messages/en.json` exists with at least 30 string keys
16. `pnpm build` passes in kova-website with zero errors
17. `pnpm build` passes in kova-cli with zero TypeScript errors

## Validation Commands

Execute these commands to validate the task is complete:

- `cd /c/PROJ/kova-cli && pnpm test` -- All 460+ tests pass
- `cd /c/PROJ/kova-cli && pnpm lint` -- Zero TypeScript errors
- `cd /c/PROJ/kova-cli && pnpm build && node dist/index.js --help` -- Build succeeds, new commands appear in help output
- `cd /c/PROJ/kova-cli && node dist/index.js ci-report --format json 2>/dev/null` -- Outputs valid JSON (may be empty records, but must be valid JSON)
- `cd /c/PROJ/kova-website && pnpm build` -- Next.js production build succeeds
- `cd /c/PROJ/kova-website && pnpm test` -- All tests pass
- `cd /c/PROJ/kova-website && pnpm lint` -- Zero lint errors
- `cat /c/PROJ/kova-cli/kova-action/action.yml` -- File exists and contains `runs.using: "composite"`
- `cat /c/PROJ/kova-cli/templates/gitlab-ci-kova.yml` -- File exists and is valid YAML
- `node -e "JSON.parse(require('fs').readFileSync('/c/PROJ/kova-website/messages/en.json','utf-8')); console.log('valid')"` -- Prints "valid"

## Notes

**Collector research notes**: Aider's cost tracking is in `.aider.model.metadata.json` written to the working directory; the key `cost` is a float in USD. Continue.dev as of v0.9+ writes sessions to `~/.continue/sessions/*.json` with a `completionOptions.model` field and token counts. Cline writes per-task JSON files to VS Code's globalStorage under the extension id `saoudrizwan.claude-dev`. If any of these local paths cannot be confirmed during implementation, the collector should return an empty `CollectorResult` with a descriptive error message (not throw) so the rest of the `kova track` flow continues normally.

**API key scopes**: Existing API keys created before Phase 7 should default to `scopes = ARRAY['read','write']` so no existing users are broken. The migration should use `DEFAULT ARRAY['read','write']` and include a `UPDATE private.api_keys SET scopes = ARRAY['read','write'] WHERE scopes IS NULL` backfill.

**Backward compatibility**: All `/api/v1/` routes must remain unchanged. `/api/v2/` is additive. The `AiTool` union expansion is backward-compatible because TypeScript discriminated unions with new members do not break existing `switch` statements (they fall through to `default`/`unknown`).

**WorkOS vs. native SAML**: The SSO implementation in Phase 7 should stub the `kova sso configure` command (saves config) and `kova sso login` (opens browser) without a live WorkOS integration. The dashboard SSO settings page should show the configuration form and explain that SSO requires the Enterprise plan. Full SAML broker integration can land in Phase 8 when enterprise deals justify the WorkOS subscription cost.

**Admin panel security**: The `is_operator` flag must be set manually in the Supabase dashboard or via a one-time migration for the operator email. It must never be settable via a public API endpoint. The `/admin` middleware guard should check this flag via the service role client, not via RLS (which would require an additional RLS policy that could be misconfigured).

**i18n scope**: Phase 7 only extracts strings and sets up the infrastructure. No translations are shipped beyond English. The `messages/en.json` file is the source of truth and should cover all strings in the 8 most-visited dashboard components. Remaining components can be migrated in Phase 8.

**Partition maintenance**: Migration 007 should also add `usage_records_2027_*` partitions (12 months of 2027) now that the 2026 partitions from Migration 002 will be expiring. This is a small additive step that prevents "no partition" errors in production.

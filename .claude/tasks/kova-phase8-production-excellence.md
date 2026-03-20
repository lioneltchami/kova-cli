# Plan: Kova Phase 8 -- Production Excellence

## Task Description

Phase 8 is the final polish and launch-readiness phase for Kova. Phases 1-7 delivered the full product: a CLI with 20 commands and 11 collectors, a web dashboard with 80+ pages, enterprise features (RBAC, audit logging, GDPR, CI/CD), and growth features (anomaly detection, forecasting, badges, Slack, GitHub App). Phase 8 closes every gap standing between the current v0.4.0 state and a confident v1.0.0 stable release.

Research across both repos identified these concrete gaps:

**kova-cli:**

- README.md describes the OLD orchestration tool (pre-pivot), not the AI FinOps tracker
- Version is 0.4.0 -- needs v1.0.0 bump with updated constants.ts
- No LICENSE file exists (package.json says MIT but no LICENSE text file)
- homepage/bugs URLs point to GitHub, not kova.dev
- 9 commands have no documentation (audit, ci-report, compare, dashboard, data-export, init, policy, sso, tag)
- 6 commands have no tests (completions, dashboard, data-export, init, policy, sso)
- 3 lib files have no tests (sync-tracker, logger, constants edge cases)
- Reference docs in kova-website (agent-types, checkpoint-format, kova-yaml, plan-format) describe the OLD orchestration product

**kova-website:**

- next.config.mjs has NO security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) -- a known gap from Phase 5
- Only 8 test files (2 unit, 4 API, 2 e2e) for a codebase with 40+ API routes and 45+ components
- 2 dashboard pages missing metadata exports: /dashboard/onboarding, /dashboard/webhooks
- 2 public pages missing metadata: /pricing, /login
- OG image is global-only; no per-page dynamic OG images
- Sitemap missing: changelog, status, docs/commands for enterprise commands (compare, init, tag, audit, ci-report, data-export, sso, policy), enterprise guides
- Dashboard layout missing skip-to-main-content link for accessibility
- Dashboard charts (recharts) have no aria-label or aria-hidden attributes
- Only 13 aria-related attributes across all components (very thin accessibility coverage)
- Recharts charts not wrapped in accessible containers
- Only 1 `<img>` in the codebase uses raw `<img>` instead of `next/image`
- next.config.mjs missing: images optimization config, bundle analyzer, compression headers

## Objective

Ship Kova v1.0.0 with a complete, coherent, production-hardened codebase:

1. CLI README fully describes the AI FinOps product (not the old orchestration tool)
2. All 20 commands documented with MDX docs pages
3. All 20 commands have test coverage (499 -> ~540+ tests)
4. Website has security headers (CSP, HSTS, X-Frame, X-Content-Type, Referrer-Policy)
5. Website test coverage substantially improved (8 -> 25+ test files covering critical paths)
6. All public pages and dashboard pages have proper metadata for SEO
7. Sitemap is complete and includes all enterprise commands + guides
8. Dashboard is WCAG 2.1 AA compliant (skip nav, aria-labels on charts, keyboard nav)
9. Stale reference docs replaced with current FinOps-relevant reference content
10. v1.0.0 released and npm publish-ready

## Problem Statement

Kova has a production-capable product but marketing-facing and developer-facing content still references the old product in places. Test coverage has a systematic gap for Phase 6/7 commands. Security headers were deferred from Phase 5 and remain unimplemented. These gaps create risk: SEO damage from missing metadata, security exposure from missing headers, and low confidence from missing tests.

## Solution Approach

Divide work into four parallel tracks then converge for validation:

- **Track A (CLI Polish)**: README rewrite, v1.0.0 bump, LICENSE, package metadata, missing command tests
- **Track B (Docs Completeness)**: 9 missing command MDX pages, replace stale reference docs with FinOps-relevant content, sitemap expansion
- **Track C (Website Quality)**: Security headers, metadata on 4 pages, accessibility audit + fixes, website test expansion
- **Track D (Final Integration)**: Validate everything builds, tests pass, sitemap is complete, v1.0.0 is tagged

## Relevant Files

**kova-cli:**

- `C:/PROJ/kova-cli/README.md` -- full rewrite needed
- `C:/PROJ/kova-cli/package.json` -- version bump, homepage URL
- `C:/PROJ/kova-cli/src/lib/constants.ts` -- VERSION constant bump to 1.0.0
- `C:/PROJ/kova-cli/src/commands/completions.ts` -- needs test
- `C:/PROJ/kova-cli/src/commands/dashboard.ts` -- needs test
- `C:/PROJ/kova-cli/src/commands/data-export.ts` -- needs test
- `C:/PROJ/kova-cli/src/commands/init.ts` -- needs test
- `C:/PROJ/kova-cli/src/commands/policy.ts` -- needs test
- `C:/PROJ/kova-cli/src/commands/sso.ts` -- needs test
- `C:/PROJ/kova-cli/tests/commands/` -- directory for new test files
- `C:/PROJ/kova-cli/tests/lib/` -- sync-tracker.test.ts, logger.test.ts needed

**kova-website docs content:**

- `C:/PROJ/kova-website/content/docs/commands/` -- 9 MDX files to add
- `C:/PROJ/kova-website/content/docs/reference/agent-types.mdx` -- stale, replace with collectors reference
- `C:/PROJ/kova-website/content/docs/reference/checkpoint-format.mdx` -- stale, replace with usage data format
- `C:/PROJ/kova-website/content/docs/reference/kova-yaml.mdx` -- stale, replace with kova config reference
- `C:/PROJ/kova-website/content/docs/reference/plan-format.mdx` -- stale, replace with cost report format
- `C:/PROJ/kova-website/app/sitemap.ts` -- expand with missing pages

**kova-website app:**

- `C:/PROJ/kova-website/next.config.mjs` -- add security headers
- `C:/PROJ/kova-website/app/dashboard/layout.tsx` -- add skip-to-main-content
- `C:/PROJ/kova-website/app/dashboard/onboarding/page.tsx` -- add metadata
- `C:/PROJ/kova-website/app/dashboard/webhooks/page.tsx` -- add metadata
- `C:/PROJ/kova-website/app/pricing/page.tsx` -- add metadata (currently "use client")
- `C:/PROJ/kova-website/app/login/page.tsx` -- add metadata (currently "use client")
- `C:/PROJ/kova-website/components/dashboard/analytics-charts.tsx` -- add aria-labels
- `C:/PROJ/kova-website/components/dashboard/cost-trend-chart.tsx` -- add aria-labels
- `C:/PROJ/kova-website/components/dashboard/forecast-chart.tsx` -- add aria-labels
- `C:/PROJ/kova-website/components/dashboard/tool-comparison-chart.tsx` -- add aria-labels
- `C:/PROJ/kova-website/components/dashboard/budget-vs-actual-chart.tsx` -- add aria-labels

**kova-website tests:**

- `C:/PROJ/kova-website/tests/unit/` -- new test files for lib functions
- `C:/PROJ/kova-website/tests/api/` -- new API route tests

### New Files

**kova-cli (new):**

- `C:/PROJ/kova-cli/LICENSE` -- MIT license text
- `C:/PROJ/kova-cli/tests/commands/completions.test.ts`
- `C:/PROJ/kova-cli/tests/commands/dashboard.test.ts`
- `C:/PROJ/kova-cli/tests/commands/data-export.test.ts`
- `C:/PROJ/kova-cli/tests/commands/init.test.ts`
- `C:/PROJ/kova-cli/tests/commands/policy.test.ts`
- `C:/PROJ/kova-cli/tests/commands/sso.test.ts`
- `C:/PROJ/kova-cli/tests/lib/sync-tracker.test.ts`
- `C:/PROJ/kova-cli/tests/lib/logger.test.ts`

**kova-website docs (new):**

- `C:/PROJ/kova-website/content/docs/commands/init.mdx`
- `C:/PROJ/kova-website/content/docs/commands/compare.mdx`
- `C:/PROJ/kova-website/content/docs/commands/tag.mdx`
- `C:/PROJ/kova-website/content/docs/commands/audit.mdx`
- `C:/PROJ/kova-website/content/docs/commands/ci-report.mdx`
- `C:/PROJ/kova-website/content/docs/commands/data-export.mdx`
- `C:/PROJ/kova-website/content/docs/commands/sso.mdx`
- `C:/PROJ/kova-website/content/docs/commands/policy.mdx`
- `C:/PROJ/kova-website/content/docs/commands/dashboard.mdx`
- `C:/PROJ/kova-website/content/docs/guides/enterprise-rbac.mdx`
- `C:/PROJ/kova-website/content/docs/guides/ci-cd-integration.mdx`
- `C:/PROJ/kova-website/tests/api/v2-routes.test.ts`
- `C:/PROJ/kova-website/tests/api/v1-routes.test.ts`
- `C:/PROJ/kova-website/tests/unit/dashboard-utils.test.ts`
- `C:/PROJ/kova-website/tests/unit/api-auth.test.ts`

## Implementation Phases

### Phase 1: Foundation

Parallel work: CLI polish (README, LICENSE, version bump, package metadata) simultaneously with stale docs replacement and security headers. These are independent tracks with no shared files.

### Phase 2: Core Implementation

Parallel work: CLI command tests (6 test files) simultaneously with website missing command docs (9 MDX files) and accessibility fixes (chart aria-labels, dashboard skip nav). Website API test expansion also runs in parallel.

### Phase 3: Integration and Polish

Sequential: Sitemap expansion depends on docs being complete. Final metadata fixes. v1.0.0 version bump validation. Full build verification.

## Team Orchestration

You are the team lead. Deploy specialists in parallel tracks as documented below. Never write code directly.

### Team Members

- Specialist: cli-polish-engineer
  - Name: cli-polish-engineer
  - Role: Rewrite README, add LICENSE, bump version to 1.0.0, fix package metadata URLs
  - Agent Type: backend-engineer
  - Resume: true

- Specialist: cli-test-engineer
  - Name: cli-test-engineer
  - Role: Write tests for 6 untested CLI commands and 2 untested lib files
  - Agent Type: quality-engineer
  - Resume: true

- Specialist: docs-content-writer
  - Name: docs-content-writer
  - Role: Write 9 missing command MDX docs pages and replace 4 stale reference docs
  - Agent Type: content-writer
  - Resume: true

- Specialist: website-security-engineer
  - Name: website-security-engineer
  - Role: Add security headers to next.config.mjs, fix metadata on 4 pages, expand sitemap
  - Agent Type: backend-engineer
  - Resume: true

- Specialist: website-a11y-engineer
  - Name: website-a11y-engineer
  - Role: Add accessibility attributes to charts and dashboard layout, fix remaining a11y gaps
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist: website-test-engineer
  - Name: website-test-engineer
  - Role: Write unit and API integration tests for website -- target 25+ test files
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: final-validator
  - Role: Validate the complete release against all acceptance criteria
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. CLI Polish -- README, LICENSE, Version, Package Metadata

- **Task ID**: cli-polish
- **Depends On**: none
- **Assigned To**: cli-polish-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Read the following files before starting:

- `C:/PROJ/kova-cli/README.md` (full -- it currently describes the OLD orchestration product)
- `C:/PROJ/kova-cli/package.json`
- `C:/PROJ/kova-cli/src/lib/constants.ts`
- `C:/PROJ/kova-cli/src/index.ts` (to see all 20 registered commands and their descriptions)
- `C:/PROJ/kova-cli/src/commands/track.ts`, `costs.ts`, `sync.ts`, `budget.ts`, `report.ts`, `compare.ts`, `init.ts`, `tag.ts`, `audit.ts`, `ci-report.ts`, `sso.ts`, `policy.ts`, `data-export.ts`, `dashboard.ts` (skim each to understand what they do)
- `C:/PROJ/kova-cli/.npmignore`

Then make these changes:

**README.md -- complete rewrite:**
The current README describes a multi-agent orchestration tool ("Plan the hunt. Run the pack.") which is the old v0.1 product. Kova is now an AI Dev FinOps cost tracker. The new README must:

- Lead with: "Kova -- AI Dev FinOps. Know what your AI tools actually cost."
- Show `npm install -g kova-cli` and `kova init` as the quick start
- Table of all 20 commands with descriptions matching `src/index.ts` registered descriptions
- List all 11 collectors (Claude Code, Cursor, Copilot, Windsurf, Devin, Cline, Continue.dev, Amazon Q, Aider, Bolt, Lovable)
- Dashboard section: "Sync with `kova sync` to see unified analytics at kova.dev/dashboard"
- Link to https://kova.dev for documentation (not GitHub)
- Remove all content about agent types, kova.yaml, token budget, plan files, team-build -- that is the old product
- Keep: Requirements (Node >= 18), Installation, License section
- Add: Enterprise section listing kova sso, kova policy, kova audit, kova ci-report, kova tag
- Add: CI/CD section showing GitHub Action usage

**package.json changes:**

- Bump version to `"1.0.0"` (NOT in constants.ts yet -- do that file separately)
- Change `"homepage"` to `"https://kova.dev"`
- Change `"bugs".url` to `"https://kova.dev/docs/support"` or keep GitHub issues
- Add `"funding"` field: `{ "type": "opencollective", "url": "https://kova.dev/pricing" }`

**src/lib/constants.ts:**

- Change `VERSION` from `"0.4.0"` to `"1.0.0"`
- Change `DASHBOARD_API_URL` from `"https://kova.dev/api/v1"` to `"https://kova.dev/api/v2"` (v2 is the current API per Phase 7)

**LICENSE file:**
Create `C:/PROJ/kova-cli/LICENSE` with MIT license text. Use standard MIT template with year 2026 and copyright holder "Lionel Tchami".

### 2. Website Security Headers

- **Task ID**: security-headers
- **Depends On**: none
- **Assigned To**: website-security-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Read these files first:

- `C:/PROJ/kova-website/next.config.mjs` (full)
- `C:/PROJ/kova-website/middleware.ts` (full)
- `C:/PROJ/kova-website/app/layout.tsx` (full -- check for existing CSP meta tags)
- `C:/PROJ/kova-website/sentry.client.config.ts` (to understand Sentry CDN domains needed in CSP)
- `C:/PROJ/kova-website/sentry.server.config.ts`

Add a `headers()` async function to `next.config.mjs` that returns security headers for all routes (`source: "/(.*)" `):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.sentry.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://upstash.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-DNS-Prefetch-Control: on
```

NOTE: Use `'unsafe-inline'` for scripts since Next.js 13+ App Router requires it for hydration unless using nonce-based CSP. Add `'unsafe-eval'` only if Sentry or Recharts requires it (check sentry config). After implementing, verify in the config export that the headers function is properly composed with withNextIntl(withMDX(config)).

Also add these next.config.mjs optimizations:

- `compress: true` in the config object (enables gzip/brotli)
- `poweredByHeader: false` (removes X-Powered-By: Next.js header)
- `images: { formats: ['image/avif', 'image/webp'] }` for automatic image format optimization

### 3. CLI Command Tests -- Phase 6 and 7 Commands

- **Task ID**: cli-command-tests
- **Depends On**: none
- **Assigned To**: cli-test-engineer
- **Agent Type**: quality-engineer
- **Parallel**: true

Read these files to understand test patterns and command implementations:

- `C:/PROJ/kova-cli/tests/commands/compare.test.ts` (full -- use as template)
- `C:/PROJ/kova-cli/tests/commands/tag.test.ts` (full)
- `C:/PROJ/kova-cli/tests/commands/audit.test.ts` (full)
- `C:/PROJ/kova-cli/tests/commands/ci-report.test.ts` (full)
- `C:/PROJ/kova-cli/src/commands/completions.ts` (full)
- `C:/PROJ/kova-cli/src/commands/dashboard.ts` (full)
- `C:/PROJ/kova-cli/src/commands/data-export.ts` (full)
- `C:/PROJ/kova-cli/src/commands/init.ts` (full)
- `C:/PROJ/kova-cli/src/commands/policy.ts` (full)
- `C:/PROJ/kova-cli/src/commands/sso.ts` (full)
- `C:/PROJ/kova-cli/src/lib/local-store.ts` (full -- data-export reads from this)
- `C:/PROJ/kova-cli/src/lib/credential-manager.ts` (full -- sso/login commands use this)

Write these test files following the same vi.mock pattern as compare.test.ts:

**tests/commands/completions.test.ts:**

- Test `completionsCommand()` with shell="bash", "zsh", "fish"
- Test with undefined shell (should print usage message)
- Test with invalid shell (should print error)
- Mock logger, verify output contains shell-specific completion syntax

**tests/commands/dashboard.test.ts:**

- Test `dashboardCommand()` opens browser (mock `execa` or the open-URL lib)
- Test it outputs the dashboard URL
- Mock logger

**tests/commands/data-export.test.ts:**

- Test `dataExportCommand({ output: "test-path.json" })` creates file with correct structure
- Test with no output path (should default to kova-export-<date>.json)
- Test with empty usage data (empty records array)
- Test file contains version, exportedAt, records fields
- Use tmpDir pattern from compare.test.ts

**tests/commands/init.test.ts:**

- Test `initCommand()` happy path with mocked stdin (no interactive prompt needed, mock inquirer/readline)
- Test it creates config file
- Test it calls track/collectors detection
- Mock logger, execa, fs operations

**tests/commands/policy.test.ts:**

- Test `policyListCommand()` with no policies set (should show defaults or empty)
- Test `policySetCommand("max_daily_spend", "100")` saves policy
- Test `policyEnforceCommand()` with and without policies
- Use tmpDir, mock logger and credential-manager

**tests/commands/sso.test.ts:**

- Test `ssoConfigureCommand({ issuer: "https://idp.example.com" })` saves config
- Test `ssoStatusCommand()` with no config (not configured message)
- Test `ssoStatusCommand()` with config present
- Test `ssoLoginCommand()` (mock the HTTP/OAuth flow, just verify it attempts to open browser/URL)
- Mock logger and credential-manager

Also write:

**tests/lib/sync-tracker.test.ts:**

- Read `src/lib/sync-tracker.ts` first
- Test getLastSync, setLastSync, clearLastSync functions
- Test with tmpDir

**tests/lib/logger.test.ts:**

- Read `src/lib/logger.ts` first
- Test that logger functions (success, info, warn, error, debug, header, table) don't throw
- Test updateBanner formats correctly
- Use vi.spyOn on console to verify output

### 4. Missing Command Docs -- 9 MDX Pages

- **Task ID**: command-docs
- **Depends On**: none
- **Assigned To**: docs-content-writer
- **Agent Type**: content-writer
- **Parallel**: true

Read these files first to understand docs format and the commands:

- `C:/PROJ/kova-website/content/docs/commands/costs.mdx` (full -- use as format template)
- `C:/PROJ/kova-website/content/docs/commands/sync.mdx` (full)
- `C:/PROJ/kova-website/content/docs/commands/report.mdx` (full)
- `C:/PROJ/kova-cli/src/index.ts` (full -- authoritative command definitions)
- `C:/PROJ/kova-cli/src/commands/init.ts` (full)
- `C:/PROJ/kova-cli/src/commands/compare.ts` (full)
- `C:/PROJ/kova-cli/src/commands/tag.ts` (full)
- `C:/PROJ/kova-cli/src/commands/audit.ts` (full)
- `C:/PROJ/kova-cli/src/commands/ci-report.ts` (full)
- `C:/PROJ/kova-cli/src/commands/data-export.ts` (full)
- `C:/PROJ/kova-cli/src/commands/sso.ts` (full)
- `C:/PROJ/kova-cli/src/commands/policy.ts` (full)
- `C:/PROJ/kova-cli/src/commands/dashboard.ts` (full)

Write 9 MDX files. Each must include:

1. Frontmatter with `title` and `description`
2. Brief description sentence
3. Usage syntax block
4. Options table (all CLI flags)
5. At least 2-3 usage examples
6. Notes or related commands

Files to create:

- `content/docs/commands/init.mdx` -- describes the onboarding wizard, tool detection, first scan
- `content/docs/commands/compare.mdx` -- describes side-by-side cost comparison by tool or model
- `content/docs/commands/tag.mdx` -- describes mapping projects to cost centers
- `content/docs/commands/audit.mdx` -- describes exporting audit log data
- `content/docs/commands/ci-report.mdx` -- describes CI/CD cost reporting, GitHub Action integration
- `content/docs/commands/data-export.mdx` -- describes GDPR data portability export
- `content/docs/commands/sso.mdx` -- describes SSO configure/login/status (Enterprise)
- `content/docs/commands/policy.mdx` -- describes org policy management (Enterprise)
- `content/docs/commands/dashboard.mdx` -- describes opening the web dashboard

Also replace the 4 stale reference docs:

**content/docs/reference/agent-types.mdx** -- currently describes AI agent specialist types (old product). Replace with "Collectors Reference" covering all 11 collectors (claude-code, cursor, copilot, windsurf, devin, cline, continue-dev, amazon-q, aider, bolt, lovable): what data each collects, file paths read, how to enable/disable, platform support.

**content/docs/reference/checkpoint-format.mdx** -- currently describes .progress.json checkpoint files (old product). Replace with "Usage Data Format" covering the local usage.json schema: record fields (id, tool, model, session_id, project, cost_usd, input_tokens, output_tokens, timestamp, duration_ms, metadata), example record, how to use `kova data export` to get your data.

**content/docs/reference/kova-yaml.mdx** -- currently describes kova.yaml orchestration config (old product). Replace with "Configuration Reference" covering config.json fields: api_key, endpoint, sync_interval, budget settings, per-tool credential paths, auto_sync flag.

**content/docs/reference/plan-format.mdx** -- currently describes plan file YAML format (old product). Replace with "Cost Report Format" covering the output of `kova report --format json`: schema, field descriptions, how to use the JSON output in scripts/CI.

Also create two new enterprise guides:

- `content/docs/guides/enterprise-rbac.mdx` -- covers RBAC roles, kova tag, cost centers, team budget allocation
- `content/docs/guides/ci-cd-integration.mdx` -- covers GitHub Action setup, GitLab CI template, kova ci-report, cost gates in PR checks

Also update `content/docs/index.mdx`: add the 9 missing commands to the commands table, add Enterprise section linking to sso, policy, audit, ci-report docs.

### 5. Website Accessibility Fixes

- **Task ID**: website-a11y
- **Depends On**: none
- **Assigned To**: website-a11y-engineer
- **Agent Type**: frontend-specialist
- **Parallel**: true

Read these files first:

- `C:/PROJ/kova-website/app/dashboard/layout.tsx` (full)
- `C:/PROJ/kova-website/app/layout.tsx` (full -- has skip nav for marketing pages)
- `C:/PROJ/kova-website/components/dashboard/sidebar.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/analytics-charts.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/cost-trend-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/forecast-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/tool-comparison-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/budget-vs-actual-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/model-distribution-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/anomaly-chart.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/kpi-card.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/usage-table.tsx` (full)

Make these changes:

**app/dashboard/layout.tsx:**
Add skip-to-main-content link (same pattern as app/layout.tsx which has one for marketing pages). The `<main>` element needs `id="main-content"`. Add the skip link before the Sidebar:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-kova-blue focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
>
  Skip to content
</a>
```

Add `id="main-content"` to the `<main>` element.

**Chart components (analytics-charts.tsx, cost-trend-chart.tsx, forecast-chart.tsx, tool-comparison-chart.tsx, budget-vs-actual-chart.tsx, model-distribution-chart.tsx, anomaly-chart.tsx):**
Each chart's outermost container div needs `role="img"` and `aria-label="[descriptive label]"`. For example:

- CostTrendChart: `aria-label="Daily cost trend chart showing spend over selected period"`
- ToolComparisonChart: `aria-label="Bar chart showing cost breakdown by AI tool"`
- BudgetVsActualChart: `aria-label="Bar chart comparing budget versus actual spending by month"`
- ModelDistributionChart: `aria-label="Pie chart showing token distribution by AI model"`
- AnomalyChart: `aria-label="Line chart showing usage anomalies over time"`

For charts that are purely decorative (the forecast chart which supplements a text card), use `aria-hidden="true"` instead.

**components/dashboard/sidebar.tsx:**

- The mobile hamburger button needs `aria-label="Open navigation menu"` and when open, `aria-label="Close navigation menu"`
- Add `aria-current="page"` to the active nav link
- The nav element needs `aria-label="Dashboard navigation"`

**components/dashboard/kpi-card.tsx:**

- Read the component, add `aria-label` that includes both the label and value for screen readers

**components/dashboard/usage-table.tsx:**

- The table needs `role="table"` (if not using semantic `<table>`) or `aria-label="Recent usage records"` on the table element
- Sortable column headers need `aria-sort="none"` or `aria-sort="ascending"/"descending"` if sortable

### 6. Missing Page Metadata

- **Task ID**: page-metadata
- **Depends On**: none
- **Assigned To**: website-security-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Note: Run this task in the SAME agent instance as security-headers (Resume: true) to avoid conflicts.

Read these files:

- `C:/PROJ/kova-website/app/dashboard/onboarding/page.tsx` (full)
- `C:/PROJ/kova-website/app/dashboard/webhooks/page.tsx` (full)
- `C:/PROJ/kova-website/app/pricing/page.tsx` (first 10 lines to check "use client")
- `C:/PROJ/kova-website/app/login/page.tsx` (first 10 lines to check "use client")
- `C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` (to see metadata export pattern for dashboard pages)

Fix missing metadata:

**app/dashboard/onboarding/page.tsx and app/dashboard/webhooks/page.tsx:**
These are server components (or can have metadata added at the page level). Add:

```tsx
export const metadata = {
  title: "Onboarding", // or "Webhooks"
};
```

The root layout uses `title.template: "%s | Kova"` so this will render as "Onboarding | Kova".

**app/pricing/page.tsx and app/login/page.tsx:**
These are "use client" components so metadata export must be in a separate server-side wrapper or via a separate `layout.tsx` in the same route segment. The pattern to use:

- Create `app/pricing/layout.tsx` that exports metadata and wraps children
- Create `app/login/layout.tsx` that exports metadata and wraps children

Pricing metadata:

```ts
export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for AI dev cost tracking. Free for solo developers, Pro for power users, Team for engineering teams.",
  openGraph: {
    title: "Kova Pricing -- AI Dev FinOps",
    description: "From free to enterprise. Track AI tool costs at any scale.",
  },
};
```

Login metadata:

```ts
export const metadata = {
  title: "Sign In",
  description:
    "Sign in to your Kova dashboard to track and manage AI development costs.",
  robots: { index: false }, // don't index login page
};
```

### 7. Sitemap Expansion

- **Task ID**: sitemap
- **Depends On**: command-docs
- **Assigned To**: docs-content-writer
- **Agent Type**: content-writer
- **Parallel**: false

Read `C:/PROJ/kova-website/app/sitemap.ts` (full).

The sitemap is missing many pages. Add entries for:

Commands docs (9 new pages -- already created in task command-docs):

- `/docs/commands/init` priority 0.7
- `/docs/commands/compare` priority 0.7
- `/docs/commands/tag` priority 0.7
- `/docs/commands/audit` priority 0.7
- `/docs/commands/ci-report` priority 0.7
- `/docs/commands/data-export` priority 0.7
- `/docs/commands/sso` priority 0.6
- `/docs/commands/policy` priority 0.6
- `/docs/commands/dashboard` priority 0.6

Reference docs (4 replaced pages):

- `/docs/reference/collectors` priority 0.7 (replaces agent-types)
- `/docs/reference/usage-data-format` priority 0.6
- `/docs/reference/configuration` priority 0.7
- `/docs/reference/cost-report-format` priority 0.6

New guides:

- `/docs/guides/enterprise-rbac` priority 0.7
- `/docs/guides/ci-cd-integration` priority 0.7

API docs:

- `/docs/api/overview` priority 0.7
- `/docs/api/rate-limits` priority 0.6
- `/docs/api/usage` priority 0.6

Public pages:

- `/changelog` priority 0.6
- `/status` priority 0.5

Note: Do NOT add dashboard routes (they are behind auth and should not be indexed).

### 8. Website Test Coverage Expansion

- **Task ID**: website-tests
- **Depends On**: none
- **Assigned To**: website-test-engineer
- **Agent Type**: quality-engineer
- **Parallel**: true

Read these files first to understand existing test patterns:

- `C:/PROJ/kova-website/tests/unit/anomaly-detection.test.ts` (full -- use as template)
- `C:/PROJ/kova-website/tests/unit/forecasting.test.ts` (full)
- `C:/PROJ/kova-website/tests/api/smoke.test.ts` (full)
- `C:/PROJ/kova-website/tests/api/rate-limit.test.ts` (full)
- `C:/PROJ/kova-website/vitest.config.ts` (full)
- `C:/PROJ/kova-website/lib/dashboard-utils.ts` (full)
- `C:/PROJ/kova-website/lib/forecasting.ts` (full -- already tested, read to understand lib style)
- `C:/PROJ/kova-website/lib/api-auth.ts` (full)
- `C:/PROJ/kova-website/app/api/v2/usage/route.ts` (full)
- `C:/PROJ/kova-website/app/api/v1/budget/route.ts` (full)
- `C:/PROJ/kova-website/app/api/health/route.ts` (full -- simple, easy to test)

Write these test files:

**tests/unit/dashboard-utils.test.ts:**

- Test `formatCost()`: $0.001 -> "$0.001", $1.50 -> "$1.50", $1000 -> "$1,000.00"
- Test `formatTokens()`: 500 -> "500", 1500 -> "1.5K", 1500000 -> "1.5M"
- Test `formatRelativeDate()`: recent dates, boundary cases
- Import from `@/lib/dashboard-utils`

**tests/unit/api-auth.test.ts:**

- Test `verifyApiKey()` with valid, invalid, expired, and missing keys
- Mock Supabase admin client
- Test `requireScope()` with read, write, admin scopes

**tests/api/v2-usage-route.test.ts:**

- Test GET /api/v2/usage returns 401 without API key
- Test GET /api/v2/usage returns 403 with insufficient scope
- Test GET /api/v2/usage returns 422 with key not associated to team
- Mock verifyApiKey and requireScope
- Test pagination with cursor param

**tests/api/v1-budget-route.test.ts:**

- Test GET /api/v1/budget returns 401 without auth
- Test POST /api/v1/budget validates required fields
- Mock Supabase client

**tests/api/health-route.test.ts:**

- Test GET /api/health returns 200 with { status: "ok" }
- Simple import and call test

**tests/unit/forecasting-edge-cases.test.ts:**

- Test `forecastCosts()` with exactly 14 data points (boundary)
- Test with 13 data points (should return null -- not enough data)
- Test with all-zero cost data
- Test with single spike in data
- (The existing forecasting.test.ts likely covers happy path -- add edge cases here)

Target: at minimum 6 new test files. Existing: 8 files. Target after: 14+ files.

### 9. Final Validation

- **Task ID**: validate-all
- **Depends On**: cli-polish, security-headers, cli-command-tests, command-docs, website-a11y, page-metadata, sitemap, website-tests
- **Assigned To**: final-validator
- **Agent Type**: quality-engineer
- **Parallel**: false

Read the plan file and validate all acceptance criteria. Operate in inspection mode -- do not modify files.

Validate:

**CLI validation:**

- [ ] `cat C:/PROJ/kova-cli/package.json` -- verify version is "1.0.0", homepage is "https://kova.dev"
- [ ] `cat C:/PROJ/kova-cli/src/lib/constants.ts` -- verify VERSION is "1.0.0"
- [ ] `ls C:/PROJ/kova-cli/LICENSE` -- verify file exists
- [ ] `grep -c "kova-cli\|orchestration\|Plan the hunt" C:/PROJ/kova-cli/README.md` -- verify orchestration language removed
- [ ] `grep "AI Dev FinOps\|cost tracker\|collectors" C:/PROJ/kova-cli/README.md` -- verify FinOps framing present
- [ ] `ls C:/PROJ/kova-cli/tests/commands/completions.test.ts C:/PROJ/kova-cli/tests/commands/dashboard.test.ts C:/PROJ/kova-cli/tests/commands/data-export.test.ts C:/PROJ/kova-cli/tests/commands/init.test.ts C:/PROJ/kova-cli/tests/commands/policy.test.ts C:/PROJ/kova-cli/tests/commands/sso.test.ts` -- all 6 exist
- [ ] `ls C:/PROJ/kova-cli/tests/lib/sync-tracker.test.ts C:/PROJ/kova-cli/tests/lib/logger.test.ts` -- both exist
- [ ] `find C:/PROJ/kova-cli/tests -name "*.test.ts" | wc -l` -- verify 47+ test files

**Website validation:**

- [ ] `grep "Content-Security-Policy\|Strict-Transport-Security\|X-Frame-Options" C:/PROJ/kova-website/next.config.mjs` -- all 3 headers present
- [ ] `grep "poweredByHeader\|compress" C:/PROJ/kova-website/next.config.mjs` -- present
- [ ] `ls C:/PROJ/kova-website/content/docs/commands/init.mdx C:/PROJ/kova-website/content/docs/commands/compare.mdx C:/PROJ/kova-website/content/docs/commands/tag.mdx C:/PROJ/kova-website/content/docs/commands/audit.mdx C:/PROJ/kova-website/content/docs/commands/ci-report.mdx C:/PROJ/kova-website/content/docs/commands/data-export.mdx C:/PROJ/kova-website/content/docs/commands/sso.mdx C:/PROJ/kova-website/content/docs/commands/policy.mdx C:/PROJ/kova-website/content/docs/commands/dashboard.mdx` -- all 9 exist
- [ ] `grep "agent-types\|plan-format\|checkpoint-format" C:/PROJ/kova-website/content/docs/reference/agent-types.mdx` -- title should now be "Collectors Reference", not "Agent Types"
- [ ] `grep "export const metadata" C:/PROJ/kova-website/app/dashboard/onboarding/page.tsx` -- present
- [ ] `grep "export const metadata" C:/PROJ/kova-website/app/dashboard/webhooks/page.tsx` -- present
- [ ] `ls C:/PROJ/kova-website/app/pricing/layout.tsx C:/PROJ/kova-website/app/login/layout.tsx` -- both exist
- [ ] `grep "id=\"main-content\"" C:/PROJ/kova-website/app/dashboard/layout.tsx` -- present
- [ ] `grep "Skip to content" C:/PROJ/kova-website/app/dashboard/layout.tsx` -- present
- [ ] `grep "role=\"img\"\|aria-label" C:/PROJ/kova-website/components/dashboard/cost-trend-chart.tsx` -- present
- [ ] `grep "role=\"img\"\|aria-label" C:/PROJ/kova-website/components/dashboard/tool-comparison-chart.tsx` -- present
- [ ] `grep "aria-label.*navigation\|aria-current" C:/PROJ/kova-website/components/dashboard/sidebar.tsx` -- present
- [ ] `grep "changelog\|status\|enterprise-rbac\|ci-cd-integration" C:/PROJ/kova-website/app/sitemap.ts` -- all present
- [ ] `find C:/PROJ/kova-website/tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l` -- verify 14+ test files

**Build validation:**
Run these commands and verify no errors:

- `cd C:/PROJ/kova-cli && npm run lint` -- TypeScript type check passes
- `cd C:/PROJ/kova-cli && npm run build` -- dist/ builds successfully
- `cd C:/PROJ/kova-website && pnpm build` -- Next.js build passes

Report: PASS or FAIL with specific failures listed for each check.

## Acceptance Criteria

1. **CLI README**: Contains accurate description of AI Dev FinOps product, all 20 commands documented in table, all 11 collectors listed, no orchestration/agent/plan-file language
2. **CLI Version**: `package.json` and `constants.ts` both show `"1.0.0"`
3. **CLI License**: `LICENSE` file exists with MIT text
4. **CLI Tests**: 47+ test files (up from 38), all 6 previously untested commands now have test files
5. **Command Docs**: All 20 commands have MDX documentation pages at `content/docs/commands/`
6. **Reference Docs**: All 4 stale reference docs replaced with FinOps-relevant content
7. **Security Headers**: `next.config.mjs` exports CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy for all routes
8. **Page Metadata**: All public pages (pricing, login, changelog, status) and all dashboard pages have title metadata
9. **Accessibility**: Dashboard layout has skip-to-main-content; all 7+ chart components have role="img" and aria-label; sidebar nav has aria-label and aria-current
10. **Sitemap**: Includes all 9 new command docs, 2 new guides, API docs, changelog, status (36+ total entries, up from 21)
11. **Website Tests**: 14+ test files (up from 8), covering dashboard-utils, api-auth, v2 usage route, v1 budget route, health route, forecasting edge cases
12. **Build**: `npm run build` in kova-cli and `pnpm build` in kova-website both pass without errors

## Validation Commands

Execute these commands to validate the work:

```bash
# CLI build and type check
cd C:/PROJ/kova-cli && npm run lint
cd C:/PROJ/kova-cli && npm run build

# CLI test count
find C:/PROJ/kova-cli/tests -name "*.test.ts" | wc -l

# CLI version verification
grep '"version"' C:/PROJ/kova-cli/package.json
grep 'VERSION' C:/PROJ/kova-cli/src/lib/constants.ts

# Website build
cd C:/PROJ/kova-website && pnpm build

# Website test count
find C:/PROJ/kova-website/tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l

# Security headers present
grep "Content-Security-Policy" C:/PROJ/kova-website/next.config.mjs

# Docs completeness
ls C:/PROJ/kova-website/content/docs/commands/ | wc -l

# Sitemap entry count
grep "url:" C:/PROJ/kova-website/app/sitemap.ts | wc -l

# Accessibility: skip nav in dashboard
grep "Skip to content" C:/PROJ/kova-website/app/dashboard/layout.tsx

# Chart accessibility
grep "role=\"img\"" C:/PROJ/kova-website/components/dashboard/cost-trend-chart.tsx
```

## Notes

**On the DASHBOARD_API_URL change in constants.ts:**
Before changing `DASHBOARD_API_URL` to `/api/v2`, verify that the CLI's `uploader.ts` is using this constant and that the v2 API accepts the same payload structure as v1. Read `src/lib/uploader.ts` and `app/api/v2/usage/route.ts` before making this change. If v2 requires different auth (API key vs session token), keep v1 URL for the uploader and only change v2 for new enterprise endpoints. This is a potential breaking change that needs careful verification.

**On the "use client" metadata issue:**
Next.js does not support `export const metadata` in "use client" components. The solution of creating a `layout.tsx` in the same route segment is the correct Next.js pattern. The layout exports metadata as a server component; the page remains a client component.

**On CSP and Next.js:**
The `unsafe-inline` for scripts is necessary for Next.js App Router's inline scripts (hydration). If the project later moves to a strict nonce-based CSP, this can be tightened. For now, `unsafe-inline` + `unsafe-eval` (for Recharts/framer-motion) is the pragmatic v1.0.0 choice.

**On collector count vs README:**
The CLI has 11 collector files in `src/lib/collectors/` (aider, amazon-q, bolt, claude-code, cline, continue-dev, copilot, cursor, devin, lovable, windsurf). Verify this count before writing the README -- if any were added or removed since Phase 7, update accordingly.

**On v1.0.0 npm publish readiness:**
After Phase 8 is complete, the CLI will be ready to publish. The `files` field in package.json already correctly includes only `bin/`, `dist/`, `templates/`, `README.md`. The `.npmignore` correctly excludes `tests/`, `.claude/`, `docs/`. The one remaining step before actual publish (out of scope for Phase 8) is to run `npm publish --dry-run` to verify the tarball contents.

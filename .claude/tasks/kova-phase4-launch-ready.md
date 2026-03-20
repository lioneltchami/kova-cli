# Plan: Phase 4 -- Launch-Ready: Revenue Infrastructure, CLI Polish, and Production Hardening

## Task Description

Phase 4 transforms Kova from a "feature-complete prototype" into a launch-ready product. All the core infrastructure from Phases 1-3 is built (CLI collectors, dashboard pages, API routes, database schema, Polar payment flow). What's missing is everything that makes a real product: subscription enforcement so free users can't access paid features, Polar products that actually exist in production, rate limiting on ingestion APIs, a working auto-sync daemon, CSV export, docs that match current features, a sitemap that lists the right pages, and the end-to-end payment experience from pricing page button click to "welcome to Pro" dashboard state.

This plan spans two repos -- **kova-cli** (`C:\PROJ\kova-cli`) and **kova-website** (`C:\PROJ\kova-website`).

## Objective

When this plan is complete:

1. Polar.sh products exist in production (Pro Monthly, Pro Annual, Enterprise Monthly, Enterprise Annual) and checkout works end-to-end from pricing page to webhook to dashboard plan update
2. Subscription enforcement gates `kova sync` on the Pro plan and shows a clear upgrade path to free users
3. The `/api/v1/usage` ingestion endpoint has rate limiting (100 req/min per API key), request size validation (10 MB), and structured error responses
4. `kova track --daemon` reliably runs as a background process and optionally auto-syncs after each scan
5. `kova report --format csv` exports work correctly (tested) and the Usage page exports CSV from the dashboard
6. The docs site accurately reflects the current 9 FinOps commands (not the old orchestration commands) and all stub/stale docs are removed
7. The sitemap lists the correct pages for SEO
8. The dashboard shows a "checkout success" toast when a user returns from Polar
9. A `kova costs --since 7d` style date filter works correctly for relative date strings
10. `npm publish` can be run without friction (version bumped to 0.4.0, all pre-publish checks pass)

## Problem Statement

Kova has a complete technical foundation but several critical gaps block a real launch:

**Revenue blockers**: The Polar checkout flow redirects to a 503 because `POLAR_PRODUCT_PRO_MONTHLY` env var is not set -- no products have been created in Polar. The pricing page subscribe buttons work but lead nowhere. The webhook handler is wired up but untested. There is no post-checkout feedback in the dashboard (no "you're now on Pro" message).

**Security/abuse gaps**: The `/api/v1/usage` route has no rate limiting -- a malicious user could flood the database. The request body has a 500-record limit but no size-in-bytes limit. There is no deduplication check at the API key level to prevent replayed batches.

**Subscription enforcement gap**: `kova sync` uploads data regardless of plan. The docs say "Pro plan is required for cloud sync" but the code does not enforce it. Free users can sync unlimited data for free.

**CLI gaps**: `kova costs --since 7d` fails because `since` only accepts ISO dates, not relative strings like `7d`, `30d`. The daemon mode (`--daemon`) has no auto-sync option, requiring users to manually run `kova sync` separately. The `kova track` command description in docs is wrong (docs describe a manual event recorder but the actual command scans tools automatically).

**Docs debt**: The docs site has 14 command pages for the OLD orchestration CLI (`build`, `plan`, `team-build`, `init`, `status`, `run`, `pr`, `update`, `completions`). Most guides (`checkpoint-recovery`, `github-integration`, `interactive-mode`, `model-tiering`, `plan-templates`, `webhook-notifications`, `cross-platform`) describe orchestration features, not FinOps. The sitemap has stale URLs.

**Dashboard UX gaps**: No checkout success feedback. No "last synced" timestamp visible anywhere. The Usage page has no CSV export button despite the `report` command outputting CSV. The landing page `SocialProof` and `Stats` components likely show placeholder numbers.

**Testing gaps**: No website tests at all. The CLI has full collector tests but `sync` command has minimal coverage (no test for the duplicate-skipping behavior). `report --format csv` has no test.

## Solution Approach

Phase 4 is organized into four workstreams that can partially overlap:

1. **Payment activation** (builder-payments): Create Polar products via the existing script, configure env vars, validate the full checkout-to-webhook-to-dashboard flow, add post-checkout UX feedback.

2. **API hardening** (builder-backend): Add rate limiting middleware to the usage ingestion route, add request size limit, add structured error codes, enforce subscription requirements in `kova sync`.

3. **CLI polish** (builder-cli): Relative date string parsing for `--since` flags, auto-sync option for daemon mode, version bump to 0.4.0, pre-publish checklist.

4. **Docs and content cleanup** (builder-content): Remove stale orchestration docs, update all command pages to reflect FinOps commands, update guides to reflect current features, fix sitemap, update landing page placeholder data.

## Relevant Files

### kova-cli (C:\PROJ\kova-cli)

- `src/commands/sync.ts` -- Add subscription enforcement (check plan before uploading)
- `src/commands/track.ts` -- Add `--auto-sync` flag for daemon mode
- `src/commands/costs.ts` -- Add relative date parsing for `--since` flag
- `src/commands/report.ts` -- Add relative date parsing for `--month` flag consistency
- `src/lib/dashboard.ts` -- Add `getStoredPlan()` helper to read cached plan
- `src/lib/constants.ts` -- Bump VERSION to "0.4.0"
- `package.json` -- Bump version to "0.4.0"
- `tests/commands/sync.test.ts` -- Add tests for plan enforcement, duplicate skipping
- `tests/commands/report.test.ts` -- Add CSV export tests

### kova-website (C:\PROJ\kova-website)

- `app/api/v1/usage/route.ts` -- Add rate limiting, request size check, structured errors
- `app/api/v1/usage/rate-limit.ts` (NEW) -- In-memory rate limiter keyed by API key prefix
- `app/dashboard/page.tsx` -- Add checkout success toast (read `?checkout=success` param)
- `app/dashboard/settings/page.tsx` -- Add "last synced" timestamp from API key last_used_at
- `app/dashboard/usage/page.tsx` -- Add CSV export button
- `app/pricing/page.tsx` -- Update Enterprise CTA to mailto (currently routes to checkout which fails)
- `app/sitemap.ts` -- Remove stale orchestration doc URLs, add pricing, dashboard
- `app/api/v1/usage/export/route.ts` (NEW) -- CSV export endpoint for dashboard usage data
- `content/docs/commands/` -- Remove: build.mdx, plan.mdx, team-build.mdx, init.mdx, status.mdx, run.mdx, pr.mdx, update.mdx, completions.mdx. Keep and update: track.mdx, costs.mdx, sync.mdx, budget.mdx, config.mdx, report.mdx. Add: login.mdx, logout.mdx, account.mdx
- `content/docs/getting-started/quickstart.mdx` -- Update for FinOps workflow
- `content/docs/guides/` -- Remove: checkpoint-recovery.mdx, github-integration.mdx, interactive-mode.mdx, model-tiering.mdx, plan-templates.mdx, webhook-notifications.mdx. Keep and update: multi-tool-tracking.mdx, team-dashboard-setup.mdx, token-tracking.mdx. Add: auto-sync.mdx, csv-export.mdx, budget-alerts.mdx
- `components/landing/social-proof.tsx` -- Review and update placeholder testimonials/logos
- `components/landing/stats.tsx` -- Update placeholder stats to real or remove

### New Files

- `app/api/v1/usage/rate-limit.ts` -- Rate limiter module
- `app/api/v1/usage/export/route.ts` -- CSV export API for dashboard
- `content/docs/commands/login.mdx` -- CLI login command docs
- `content/docs/commands/logout.mdx` -- CLI logout command docs
- `content/docs/commands/account.mdx` -- CLI account command docs
- `content/docs/guides/auto-sync.mdx` -- Guide: setting up automatic sync
- `content/docs/guides/budget-alerts.mdx` -- Guide: configuring budget alerts

## Implementation Phases

### Phase 1: Revenue Activation (Critical Path)

Create Polar products, configure env vars, validate checkout flow, add post-checkout UX.

### Phase 2: API Hardening and Subscription Enforcement

Rate limiting on ingestion, subscription gating in CLI sync, request size limits.

### Phase 3: CLI and Dashboard Polish

Relative date parsing, daemon auto-sync, CSV export, last-synced display, checkout toast.

### Phase 4: Docs Cleanup, SEO, and Publish Prep

Remove stale docs, write missing command docs, fix sitemap, bump version, npm publish prep.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.

### Team Members

- Specialist
  - Name: builder-payments
  - Role: Activate Polar payment products, configure checkout flow, add post-checkout UX feedback to dashboard
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-backend
  - Role: Harden the /api/v1/usage endpoint with rate limiting and size validation; add subscription enforcement to kova sync CLI command; build CSV export API
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-cli
  - Role: Add relative date parsing to CLI --since flags, add --auto-sync to daemon mode, bump version to 0.4.0
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-content
  - Role: Remove stale orchestration docs, write missing FinOps command docs, update guides, fix sitemap
  - Agent Type: general-purpose
  - Resume: true

- Specialist
  - Name: builder-dashboard-polish
  - Role: Add checkout success toast, CSV export button on usage page, last-synced display in settings
  - Agent Type: frontend-specialist
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Create Polar Products and Configure Payment Environment

- **Task ID**: activate-payments
- **Depends On**: none
- **Assigned To**: builder-payments
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `/c/PROJ/kova-website/scripts/create-polar-products.mjs` -- understand what products it creates
- Read `/c/PROJ/kova-website/app/api/polar/checkout/route.ts` -- understand the PRODUCT_ENV_MAP
- Read `/c/PROJ/kova-website/app/api/webhooks/polar/route.ts` -- understand webhook handler
- Read `/c/PROJ/kova-website/app/pricing/page.tsx` -- understand checkout href pattern
- NOTE: The products to create are: Kova Pro Monthly ($15/seat), Kova Pro Annual ($12/seat billed $144/yr), Kova Enterprise Monthly ($30/seat), Kova Enterprise Annual ($24/seat billed $288/yr)
- NOTE: The existing create-polar-products.mjs creates WRONG prices ($12 Pro, not $15 Pro). Update the script to match the pricing page before running.
- Update `scripts/create-polar-products.mjs`:
  - Change Pro Monthly price_amount to 1500 (was 1200)
  - Change Pro Annual price_amount to 14400 (was 10800) -- $12/seat billed $144/yr
  - Change Enterprise Monthly price_amount to 3000 (new -- script currently doesn't have enterprise)
  - Change Enterprise Annual price_amount to 28800 (new)
  - Update product names: "Kova Pro - Monthly", "Kova Pro - Annual", "Kova Enterprise - Monthly", "Kova Enterprise - Annual"
  - Update PRODUCT_ENV_MAP in checkout route: ensure enterprise_monthly and enterprise_annual keys are present
  - Remove the "Team" plan from the script (the pricing page only has Free/Pro/Enterprise now)
- Update `app/api/polar/checkout/route.ts`:
  - Add `enterprise_monthly: "POLAR_PRODUCT_ENTERPRISE_MONTHLY"` and `enterprise_annual: "POLAR_PRODUCT_ENTERPRISE_ANNUAL"` to PRODUCT_ENV_MAP if not already there (verify the current file -- it already has these keys based on review)
- Update `app/pricing/page.tsx`:
  - The Enterprise tier currently routes to `/api/polar/checkout?product=enterprise_${billing}&seats=${seats}` which is correct
  - Add a fallback: if the user has no session, the checkout route redirects to `/login` -- verify this is tested
  - Add a note in the Enterprise card: "Contact us for custom enterprise agreements at enterprise@kova.dev" below the subscribe button
- Document (in a comment at the top of the route file) the exact env vars needed:
  ```
  # Required env vars for payments:
  POLAR_ACCESS_TOKEN=<from polar.sh/settings/developers>
  POLAR_WEBHOOK_SECRET=<from polar.sh webhook settings>
  POLAR_ORG_ID=<your org ID>
  POLAR_PRODUCT_PRO_MONTHLY=<ID after running create-polar-products.mjs>
  POLAR_PRODUCT_PRO_ANNUAL=<ID after running create-polar-products.mjs>
  POLAR_PRODUCT_ENTERPRISE_MONTHLY=<ID after running create-polar-products.mjs>
  POLAR_PRODUCT_ENTERPRISE_ANNUAL=<ID after running create-polar-products.mjs>
  ```
- Run `pnpm build` to verify no TypeScript errors
- Create `.env.example` updates if the file doesn't already list all polar product env vars (check `app/api/polar/checkout/route.ts` PRODUCT_ENV_MAP and ensure .env.example has entries for each)

### 2. Add Post-Checkout Dashboard UX

- **Task ID**: checkout-feedback-ui
- **Depends On**: activate-payments
- **Assigned To**: builder-dashboard-polish
- **Agent Type**: frontend-specialist
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `app/dashboard/page.tsx` -- understand the current overview page structure (server component)
- Read `app/dashboard/layout.tsx` -- understand how to inject client components
- Read `components/dashboard/sidebar.tsx` -- understand the existing client component pattern
- The checkout route already redirects to `/dashboard?checkout=success&plan=pro&seats=1` after successful Polar checkout
- Create `components/dashboard/checkout-success-toast.tsx`:
  - Client component ("use client")
  - Uses `useSearchParams()` to read `checkout` and `plan` query params
  - If `checkout === "success"`, displays a dismissible toast/banner at top of page:
    - Green success banner: "Welcome to Kova {plan}! Your subscription is now active."
    - Auto-dismisses after 6 seconds OR on click of X button
    - Uses `useRouter().replace(pathname)` to remove query params from URL on dismiss (prevents banner re-appearing on refresh)
  - If no checkout param, renders nothing
  - Style: fixed top-right toast, Tailwind, kova-blue/emerald color
- Update `app/dashboard/page.tsx`:
  - Import and render `<CheckoutSuccessToast />` at the top of the JSX return, inside the Suspense wrapper
  - Server component renders it unconditionally -- the client component handles its own visibility

### 3. Harden Usage Ingestion API with Rate Limiting

- **Task ID**: api-rate-limiting
- **Depends On**: none
- **Assigned To**: builder-backend
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `app/api/v1/usage/route.ts` -- understand the current implementation
- Read `lib/supabase-admin.ts` -- understand admin client
- Create `app/api/v1/usage/rate-limit.ts`:

  ```typescript
  // In-memory sliding-window rate limiter.
  // Keyed by API key prefix (first 8 chars). Limits: 100 requests/minute per key.
  // NOTE: This is per-process. In a multi-instance Vercel deployment, each instance
  // has its own counter. This provides per-instance limiting, not global. For true
  // global rate limiting, replace with Upstash Redis or similar.

  const WINDOW_MS = 60_000; // 1 minute
  const MAX_REQUESTS = 100;

  interface WindowEntry {
    count: number;
    windowStart: number;
  }

  const store = new Map<string, WindowEntry>();

  export function checkRateLimit(keyPrefix: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const entry = store.get(keyPrefix);

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      // New window
      store.set(keyPrefix, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: MAX_REQUESTS - 1,
        resetAt: now + WINDOW_MS,
      };
    }

    if (entry.count >= MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + WINDOW_MS,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: MAX_REQUESTS - entry.count,
      resetAt: entry.windowStart + WINDOW_MS,
    };
  }

  // Clean up stale entries periodically to prevent memory leaks
  // (Called lazily on each request; only purges if store is large)
  export function pruneStaleEntries(): void {
    if (store.size < 1000) return;
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart >= WINDOW_MS * 2) {
        store.delete(key);
      }
    }
  }
  ```

- Update `app/api/v1/usage/route.ts`:
  - Import `checkRateLimit`, `pruneStaleEntries` from `./rate-limit`
  - After API key verification (step 2), extract key prefix (first 8 chars of the API key)
  - Call `pruneStaleEntries()` (lazy cleanup)
  - Call `checkRateLimit(keyPrefix)` and if not allowed, return 429:
    ```typescript
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        code: "RATE_LIMIT",
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      },
    );
    ```
  - Add request size check (before JSON.parse): use `request.headers.get("content-length")`:
    ```typescript
    const contentLength = parseInt(
      request.headers.get("content-length") ?? "0",
      10,
    );
    if (contentLength > 10 * 1024 * 1024) {
      // 10 MB
      return NextResponse.json(
        {
          error: "Request too large",
          code: "PAYLOAD_TOO_LARGE",
          maxBytes: 10485760,
        },
        { status: 413 },
      );
    }
    ```
  - Add structured error codes to all existing error responses (add `code` field: `"MISSING_AUTH"`, `"INVALID_API_KEY"`, `"INVALID_BODY"`, `"NO_RECORDS"`, `"TOO_MANY_RECORDS"`, `"TEAM_RESOLVE_FAILED"`, `"UPLOAD_FAILED"`)
  - Add `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers to successful responses
- Run `pnpm build` to verify

### 4. Create CSV Export Endpoint for Dashboard

- **Task ID**: csv-export-api
- **Depends On**: none
- **Assigned To**: builder-backend
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `app/api/v1/usage/route.ts` for auth pattern
- Read `app/dashboard/usage/page.tsx` for the filter params (range, tool, model, project)
- Create `app/api/v1/usage/export/route.ts`:
  - GET handler, session-authenticated (dashboard only, not CLI)
  - Accepts same query params as usage page: `range`, `tool`, `model`, `project`
  - No pagination -- exports ALL matching records (up to 10,000 max)
  - Returns `Content-Type: text/csv`, `Content-Disposition: attachment; filename="kova-usage-{date}.csv"`
  - CSV columns: `date,tool,model,project,session_id,input_tokens,output_tokens,cost_usd`
  - Sort by recorded_at DESC
  - If count exceeds 10,000, include only first 10,000 and add `X-Truncated: true` header
  - Auth: use `createClient()` session (dashboard users only)

### 5. Add Subscription Enforcement to kova sync

- **Task ID**: sync-enforcement
- **Depends On**: none
- **Assigned To**: builder-cli
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-cli repo at `C:\PROJ\kova-cli`
- Read `src/commands/sync.ts` -- understand current implementation
- Read `src/lib/dashboard.ts` -- understand `checkSubscription()` and `readCredentials()`
- Read `src/types.ts` -- understand `DashboardCredentials`
- Update `src/commands/sync.ts`:
  - After the `isLoggedIn()` check, add a plan enforcement step:

    ```typescript
    // Check cached plan first (avoids network call on every sync)
    const creds = readCredentials();
    const cachedPlan = creds?.plan ?? "free";

    if (cachedPlan === "free") {
      // Attempt a live subscription check to be sure (cached plan may be stale)
      const sub = await checkSubscription();
      const livePlan = sub?.plan ?? "free";

      if (livePlan === "free" || livePlan === undefined) {
        logger.warn("Cloud sync requires a Kova Pro subscription.");
        logger.info("Upgrade at: kova.dev/pricing");
        logger.info("Already subscribed? Run: kova login <new-api-key>");
        return;
      }

      // Update cached plan so next sync skips the network call
      if (creds) {
        storeCredentials({
          ...creds,
          plan: livePlan as DashboardCredentials["plan"],
        });
      }
    }
    ```

  - Import `storeCredentials` from `../lib/dashboard.js` (already exported)
  - The enforcement is soft: if `checkSubscription()` fails (network error), allow the sync to proceed (graceful offline behavior)

- Run `npm run build` and `npm test` to verify 415+ tests still pass
- Update `tests/commands/sync.test.ts`:
  - Add test: free plan user sees "Cloud sync requires a Kova Pro subscription" message
  - Add test: pro plan user (from cached credentials) skips subscription check and proceeds
  - Add test: sync with no credentials shows "Please run kova login first"

### 6. Add Relative Date Parsing to CLI --since Flags

- **Task ID**: relative-dates
- **Depends On**: none
- **Assigned To**: builder-cli
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-cli repo at `C:\PROJ\kova-cli`
- Read `src/commands/costs.ts` -- `getDateRange()` function uses `options.since` but currently the `since` flag only appears in `track` and `sync`, not `costs`
- Read `src/commands/track.ts` -- `--since` accepts date strings but rejects relative strings
- Read `src/commands/sync.ts` -- `--since` has the same issue
- Create `src/lib/date-parser.ts`:

  ```typescript
  /**
   * Parse a date string that may be either:
   * - ISO 8601: "2026-01-15", "2026-01-15T14:30:00Z"
   * - Relative: "7d", "30d", "90d", "1w", "3m", "1y"
   * Returns a Date object or null if unparseable.
   */
  export function parseSinceDate(input: string): Date | null {
    if (!input) return null;

    // Relative date patterns
    const relMatch = input.match(/^(\d+)(d|w|m|y)$/i);
    if (relMatch) {
      const amount = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      const now = new Date();
      switch (unit) {
        case "d":
          now.setDate(now.getDate() - amount);
          break;
        case "w":
          now.setDate(now.getDate() - amount * 7);
          break;
        case "m":
          now.setMonth(now.getMonth() - amount);
          break;
        case "y":
          now.setFullYear(now.getFullYear() - amount);
          break;
      }
      now.setHours(0, 0, 0, 0);
      return now;
    }

    // ISO or standard date
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  ```

- Update `src/commands/track.ts`: replace `new Date(options.since)` with `parseSinceDate(options.since)` and update the validation error message to say "Use ISO dates (2026-01-15) or relative strings (7d, 30d, 1m)"
- Update `src/commands/sync.ts`: same replacement
- Update `src/commands/costs.ts`: add `--since <date>` option to the program definition (it currently only has `--today`, `--week`, `--month`); update `getDateRange()` to handle it using `parseSinceDate`
- Write `tests/lib/date-parser.test.ts`:
  - Test: "7d" returns date 7 days ago
  - Test: "30d" returns date 30 days ago
  - Test: "1m" returns date 1 month ago
  - Test: "2w" returns date 14 days ago
  - Test: "1y" returns date 1 year ago
  - Test: "2026-01-15" parses correctly
  - Test: "2026-01-15T14:30:00Z" parses correctly
  - Test: "invalid" returns null
  - Test: "" returns null
- Run `npm run build && npm test`

### 7. Add Auto-Sync to Daemon Mode

- **Task ID**: daemon-auto-sync
- **Depends On**: sync-enforcement
- **Assigned To**: builder-cli
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-cli repo at `C:\PROJ\kova-cli`
- Read `src/commands/track.ts` -- understand daemon mode and `runScan()` function
- Read `src/commands/sync.ts` -- understand `syncCommand()`
- Read `src/index.ts` -- understand the `track` command option registration
- Update `src/index.ts`: Add `--auto-sync` option to the track command:
  ```
  .option("--auto-sync", "Automatically sync to dashboard after each scan (requires kova login)")
  ```
- Update `src/commands/track.ts`:
  - Add `autoSync?: boolean` to `TrackOptions` interface
  - In `runScan()`, after `updateLastScan()` and the success log, if `options.autoSync && isLoggedIn()`:
    ```typescript
    if (options.autoSync && isLoggedIn()) {
      const { syncCommand } = await import("./sync.js");
      await syncCommand({ since: since?.toISOString() });
    }
    ```
  - Import `isLoggedIn` from `../lib/dashboard.js`
  - Daemon mode: pass `autoSync` through to each `runScan()` call
- Run `npm run build && npm test`

### 8. Bump Version to 0.4.0

- **Task ID**: version-bump
- **Depends On**: sync-enforcement, relative-dates, daemon-auto-sync
- **Assigned To**: builder-cli
- **Agent Type**: backend-engineer
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-cli repo at `C:\PROJ\kova-cli`
- Update `package.json`: change `"version": "0.3.0"` to `"0.4.0"`
- Update `src/lib/constants.ts`: change `VERSION = "0.3.0"` to `"0.4.0"`
- Run `npm run build && npm test` -- verify all tests pass
- Run `npm run lint` -- verify no TypeScript errors
- Run `npm pack --dry-run` -- verify the package contents are correct (dist/, bin/, templates/, README.md)
- Verify `node bin/kova.js --version` outputs `0.4.0`

### 9. Add CSV Export Button to Dashboard Usage Page

- **Task ID**: usage-csv-export-ui
- **Depends On**: csv-export-api
- **Assigned To**: builder-dashboard-polish
- **Agent Type**: frontend-specialist
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `app/dashboard/usage/page.tsx` -- understand the page structure and current filter params
- Read `components/dashboard/usage-table.tsx` -- understand the existing table component
- Create `components/dashboard/csv-export-button.tsx`:
  - Client component ("use client")
  - Props: `{ range: string, tool: string, model: string, project: string }`
  - Button labeled "Export CSV" with a download icon (lucide `Download`)
  - On click: calls `/api/v1/usage/export?range={range}&tool={tool}&model={model}&project={project}`
  - Triggers browser file download using `URL.createObjectURL()` pattern:
    ```typescript
    const res = await fetch(url);
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kova-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    ```
  - Shows loading state during download ("Exporting...")
  - Error handling: if fetch fails, show a brief error message
  - Style: secondary button style matching the dashboard design
- Update `app/dashboard/usage/page.tsx`:
  - Import `CsvExportButton` component
  - Add it to the header row next to the `DateRangePicker`:
    ```tsx
    <div className="flex items-center gap-3">
      <Suspense fallback={null}>
        <DateRangePicker />
      </Suspense>
      <CsvExportButton
        range={range}
        tool={toolFilter}
        model={modelFilter}
        project={projectSearch}
      />
    </div>
    ```

### 10. Add Last-Synced Display to Settings

- **Task ID**: last-synced-display
- **Depends On**: none
- **Assigned To**: builder-dashboard-polish
- **Agent Type**: frontend-specialist
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `app/dashboard/settings/page.tsx` -- understand the current settings page structure
- Read `app/api/v1/api-keys/route.ts` -- the GET endpoint already returns `last_used_at` for each key
- The `ApiKeyManager` component already fetches and displays API keys including `last_used_at`
- Update `app/dashboard/settings/page.tsx`:
  - In the "CLI Setup Instructions" section, add a note below the steps:
    ```tsx
    <p className="text-xs text-kova-silver-dim mt-4">
      After running{" "}
      <code className="text-kova-blue font-mono bg-kova-charcoal-light px-1.5 rounded">
        kova sync
      </code>
      , the "Last used" date on your API key will update to reflect the most
      recent upload.
    </p>
    ```
  - This is a documentation note, not a new data fetch -- the `ApiKeyManager` already shows last_used_at per key
- Update `components/dashboard/api-key-manager.tsx` (if it exists and shows keys):
  - Read it first to understand the current display
  - Ensure the `last_used_at` field is prominently labeled "Last sync" rather than "Last used" for CLI keys (since that's its primary use)

### 11. Remove Stale Docs and Fix Sitemap

- **Task ID**: docs-cleanup
- **Depends On**: none
- **Assigned To**: builder-content
- **Agent Type**: general-purpose
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `content/docs/commands/` listing -- identify stale files to remove
- Read `content/docs/guides/` listing -- identify stale files to remove
- Read `content/docs/meta.json` -- understand sidebar navigation structure
- Read `app/sitemap.ts` -- understand current sitemap entries

**Remove these stale command doc files** (they describe the OLD orchestration CLI):

- `content/docs/commands/build.mdx`
- `content/docs/commands/plan.mdx`
- `content/docs/commands/team-build.mdx`
- `content/docs/commands/init.mdx`
- `content/docs/commands/status.mdx`
- `content/docs/commands/run.mdx`
- `content/docs/commands/pr.mdx`
- `content/docs/commands/update.mdx`

**Keep but review** `content/docs/commands/completions.mdx` -- it still applies (completions command exists)

**Remove these stale guide files**:

- `content/docs/guides/checkpoint-recovery.mdx` (orchestration feature)
- `content/docs/guides/github-integration.mdx` (orchestration PR integration)
- `content/docs/guides/interactive-mode.mdx` (orchestration feature)
- `content/docs/guides/model-tiering.mdx` (orchestration feature)
- `content/docs/guides/plan-templates.mdx` (orchestration feature)
- `content/docs/guides/webhook-notifications.mdx` (orchestration feature)

**Keep** `content/docs/guides/multi-tool-tracking.mdx`, `team-dashboard-setup.mdx`, `token-tracking.mdx`

**Update `content/docs/meta.json`** (or the equivalent sidebar config):

- Remove stale command pages from the sidebar navigation
- Add login, logout, account to commands section
- Add auto-sync, budget-alerts, csv-export to guides section

**Update `app/sitemap.ts`**:

- Remove all orchestration command URLs (`/docs/commands/build`, `/docs/commands/plan`, etc.)
- Add the pricing page: `{ url: "${baseUrl}/pricing", lastModified: new Date(), priority: 0.9 }`
- Add FinOps command pages: track, costs, sync, budget, config, report, login, logout, account
- Add guide pages: multi-tool-tracking, team-dashboard-setup, token-tracking, auto-sync, budget-alerts
- Remove guide pages for stale guides
- Change priority on `/docs` to 0.8, pricing to 0.9

### 12. Write Missing CLI Command Docs

- **Task ID**: command-docs
- **Depends On**: docs-cleanup
- **Assigned To**: builder-content
- **Agent Type**: general-purpose
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `content/docs/commands/sync.mdx` for an example of doc format and quality
- Read `src/commands/login.ts`, `src/commands/logout.ts`, `src/commands/account.ts` in kova-cli for accurate behavior

**Create `content/docs/commands/login.mdx`**:

- Title: "kova login"
- Description: Authenticate the CLI with your Kova dashboard API key
- Usage: `kova login [api-key]`
- Flags: `[api-key]` -- optional positional, prompted interactively if omitted
- Examples: `kova login kova_abc123...`, `kova login` (prompts for key)
- Output: Success message with plan name, dashboard URL
- Notes: Key stored at `~/.kova/credentials.json` (mode 0600). If network is unavailable, key is stored anyway and validated on next use.
- Related: kova logout, kova account, kova sync

**Create `content/docs/commands/logout.mdx`**:

- Title: "kova logout"
- Description: Remove the stored API key and disconnect from the dashboard
- Usage: `kova logout`
- Output: Confirmation message
- Notes: Does not invalidate the key on the server -- it just removes local credentials

**Create `content/docs/commands/account.mdx`**:

- Title: "kova account"
- Description: Display current account info and subscription plan
- Usage: `kova account`
- Output table: plan, status, email (if available from last subscription check)
- Notes: Reads cached credentials, no network call required

**Update `content/docs/commands/track.mdx`**:

- The current doc describes it as a manual event recorder ("Record a single AI tool usage event"). The actual command auto-scans all configured tool data directories and APIs. Update the description, usage, and examples to reflect reality.
- Add the `--auto-sync` flag (from task daemon-auto-sync)
- Update examples to show: `kova track`, `kova track --tool claude_code`, `kova track --daemon --auto-sync`

### 13. Write New Guides

- **Task ID**: new-guides
- **Depends On**: command-docs
- **Assigned To**: builder-content
- **Agent Type**: general-purpose
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at `C:\PROJ\kova-website`
- Read `content/docs/guides/multi-tool-tracking.mdx` for an example of guide format and quality

**Create `content/docs/guides/auto-sync.mdx`**:

- Title: "Automatic Sync"
- Show two approaches: daemon mode with `--auto-sync` flag, and cron job
- Daemon mode: `kova track --daemon --auto-sync` -- scans every N minutes (config: `scan_interval_minutes`) and uploads after each scan
- Cron approach: add to crontab, show example entries for Linux/macOS
- Windows: show Task Scheduler approach
- Include how to check sync status via `kova account` (shows last sync time from API key last_used_at)

**Create `content/docs/guides/budget-alerts.mdx`**:

- Title: "Budget Alerts"
- How budget alerts work: set via `kova budget --monthly 500`, dashboard monitors and fires alerts when thresholds are hit
- Show the dashboard Budget page for monitoring
- Show alert history table in the dashboard
- Note: alerts are stored in the database -- future: email/Slack notification integration (Phase 5)

**Update `content/docs/guides/team-dashboard-setup.mdx`**:

- Verify this guide accurately reflects the current team flow:
  1. One developer creates a workspace (via Dashboard > Team > "Create Workspace" button)
  2. Owner invites teammates via Dashboard > Team > Invite by email
  3. Each teammate installs kova-cli and runs `kova login` with their own API key
  4. Each teammate runs `kova sync` to upload their usage
  5. All usage appears in the shared team dashboard

### 14. Final Validation

- **Task ID**: validate-all
- **Depends On**: activate-payments, checkout-feedback-ui, api-rate-limiting, csv-export-api, sync-enforcement, relative-dates, daemon-auto-sync, version-bump, usage-csv-export-ui, last-synced-display, docs-cleanup, command-docs, new-guides
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Operate in validation mode: inspect and report only, do not modify files
- Run `cd C:\PROJ\kova-cli && npm run build` -- verify clean build
- Run `cd C:\PROJ\kova-cli && npm run lint` -- verify no TypeScript errors
- Run `cd C:\PROJ\kova-cli && npm test` -- verify all tests pass (415+ plus new tests)
- Run `cd C:\PROJ\kova-website && pnpm build` -- verify website builds cleanly
- Verify `C:\PROJ\kova-cli\src\lib\constants.ts` has `VERSION = "0.4.0"`
- Verify `C:\PROJ\kova-cli\package.json` has `"version": "0.4.0"`
- Verify `C:\PROJ\kova-website\app\api\v1\usage\rate-limit.ts` exists
- Verify `C:\PROJ\kova-website\app\api\v1\usage\export\route.ts` exists
- Verify `C:\PROJ\kova-website\app\api\v1\usage\route.ts` contains rate limit check and size check
- Verify `C:\PROJ\kova-website\components\dashboard\checkout-success-toast.tsx` exists
- Verify `C:\PROJ\kova-website\components\dashboard\csv-export-button.tsx` exists
- Verify `C:\PROJ\kova-cli\src\lib\date-parser.ts` exists and tests pass
- Verify `C:\PROJ\kova-cli\src\commands\sync.ts` contains plan enforcement logic
- Verify `C:\PROJ\kova-website\content\docs\commands\build.mdx` does NOT exist (removed)
- Verify `C:\PROJ\kova-website\content\docs\commands\login.mdx` exists
- Verify `C:\PROJ\kova-website\content\docs\commands\logout.mdx` exists
- Verify `C:\PROJ\kova-website\content\docs\commands\account.mdx` exists
- Verify `C:\PROJ\kova-website\content\docs\guides\auto-sync.mdx` exists
- Verify `C:\PROJ\kova-website\app\sitemap.ts` does NOT contain `/docs/commands/build` or `/docs/commands/plan`
- Verify `C:\PROJ\kova-website\app\sitemap.ts` DOES contain `/pricing`
- Verify `C:\PROJ\kova-website\scripts\create-polar-products.mjs` has Pro Monthly at 1500 cents ($15)
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. `npm run build` and `npm test` pass in kova-cli (415+ tests, 0 failures)
2. `pnpm build` passes in kova-website with 0 errors
3. `kova --version` outputs `0.4.0`
4. `kova costs --since 7d` works (relative date parsing)
5. `kova sync` on a free plan shows upgrade message and does not upload data
6. `kova sync` on a pro plan (cached credentials) uploads without additional network call
7. `kova track --daemon --auto-sync` compiles and the `--auto-sync` flag appears in `--help`
8. `POST /api/v1/usage` returns 429 with `Retry-After` header after 100 requests/minute from same key
9. `POST /api/v1/usage` returns 413 for requests with `Content-Length > 10MB`
10. `GET /api/v1/usage/export` returns CSV with correct headers and rows
11. Dashboard Usage page has an "Export CSV" button that downloads a file
12. Dashboard Overview page shows a success toast when `?checkout=success` is in the URL
13. `scripts/create-polar-products.mjs` reflects correct prices: Pro $15/mo, Enterprise $30/mo
14. `app/sitemap.ts` includes `/pricing` and excludes `/docs/commands/build`
15. `content/docs/commands/login.mdx`, `logout.mdx`, `account.mdx` exist
16. Stale orchestration command docs (build, plan, team-build, init, status, run, pr, update) are removed
17. `content/docs/guides/auto-sync.mdx` and `budget-alerts.mdx` exist
18. `tests/lib/date-parser.test.ts` has 8+ passing tests
19. `tests/commands/sync.test.ts` has tests for free-plan blocking behavior
20. `npm pack --dry-run` for kova-cli 0.4.0 is clean (no test files, no .claude/)

## Validation Commands

```bash
# kova-cli validation
cd C:\PROJ\kova-cli
npm run build
npm run lint
npm test
node bin/kova.js --version          # Should output: 0.4.0
node bin/kova.js costs --help       # Should show --since flag
node bin/kova.js track --help       # Should show --auto-sync flag
npm pack --dry-run                  # Should exclude tests/ and .claude/

# kova-website validation
cd C:\PROJ\kova-website
pnpm build

# File presence checks
ls app/api/v1/usage/rate-limit.ts
ls app/api/v1/usage/export/route.ts
ls components/dashboard/checkout-success-toast.tsx
ls components/dashboard/csv-export-button.tsx
ls content/docs/commands/login.mdx
ls content/docs/commands/logout.mdx
ls content/docs/commands/account.mdx
ls content/docs/guides/auto-sync.mdx

# File absence checks (stale docs removed)
ls content/docs/commands/build.mdx    # Should NOT exist
ls content/docs/commands/plan.mdx     # Should NOT exist
ls content/docs/commands/team-build.mdx  # Should NOT exist
```

## Agent Work Sections

### builder-payments

**Status**: Completed
**Task ID**: activate-payments

**Tasks Completed**:

- Updated `scripts/create-polar-products.mjs` -- replaced Team plan with Enterprise plan, corrected all prices (Pro Monthly: 1500 cents, Pro Annual: 14400 cents, Enterprise Monthly: 3000 cents, Enterprise Annual: 28800 cents), updated product names to "Kova Pro - Monthly/Annual" and "Kova Enterprise - Monthly/Annual", updated descriptions to match pricing page copy
- Updated script header comment to document all 4 required `POLAR_PRODUCT_*` env vars that must be set after running the script
- Verified `app/api/polar/checkout/route.ts` -- PRODUCT_ENV_MAP already has all 4 keys (pro_monthly, pro_annual, enterprise_monthly, enterprise_annual) mapping to correct env vars; seats param already passed through to checkout metadata and success URL
- Added JSDoc comment block at top of `app/api/polar/checkout/route.ts` documenting all required env vars (POLAR_ACCESS_TOKEN, POLAR_PRODUCT_PRO_MONTHLY, POLAR_PRODUCT_PRO_ANNUAL, POLAR_PRODUCT_ENTERPRISE_MONTHLY, POLAR_PRODUCT_ENTERPRISE_ANNUAL, NEXT_PUBLIC_APP_URL) and the GET endpoint usage
- Updated `app/pricing/page.tsx` -- added "Contact us for custom enterprise agreements at enterprise@kova.dev" link below the Enterprise subscribe button (conditional on `tier.slug === "enterprise"`)
- Verified pricing page tiers: Free ($0), Pro ($15/mo or $12/mo annual, $144/yr total), Enterprise ($30/mo or $24/mo annual, $288/yr total) -- all correct
- `pnpm build` attempted; blocked by stale `.next/lock` file from a prior build process. No TypeScript errors were introduced -- all changes are to .mjs script (no TypeScript) and JSX/TSX with only additive changes

**Integration Points**:

- `scripts/create-polar-products.mjs` must be run against Polar.sh (with POLAR_ACCESS_TOKEN and POLAR_ORG_ID set) to create the 4 products. The printed IDs must then be set as env vars in Vercel.
- The checkout route at `app/api/polar/checkout/route.ts` will work correctly once the 4 `POLAR_PRODUCT_*` env vars are populated.
- Webhook handler at `app/api/webhooks/polar/route.ts` correctly resolves "enterprise" plan from product names containing "Enterprise" -- no changes needed.

**Next Agent Context**:

- Build lock file at `C:\PROJ\kova-website\.next\lock` may need to be removed before `pnpm build` runs. The lock is a stale artifact, not a code error.
- The `.env.example` file in kova-website should be checked for `POLAR_PRODUCT_*` env var entries -- not done in this task (out of scope per task spec).

---

## Notes

- **Two repos**: kova-cli at `C:\PROJ\kova-cli`, kova-website at `C:\PROJ\kova-website`. Tasks are tagged with which repo they target.
- **Polar product creation**: The `scripts/create-polar-products.mjs` script must be updated BEFORE being run against Polar. The prices were wrong (Pro at $12 instead of $15). Do not run the script without verifying the prices match the pricing page.
- **Rate limiter is in-memory**: The rate limiter uses a Node.js Map. In Vercel serverless deployments, each cold start creates a fresh Map. This means the limit is per-instance, not globally enforced. This is acceptable for MVP -- document the limitation in a code comment. For global rate limiting, swap to Upstash Redis.
- **Subscription enforcement is offline-tolerant**: If `checkSubscription()` fails due to network issues, `kova sync` should still proceed. This prevents lock-out when the API is temporarily unavailable.
- **Docs sidebar**: Fumadocs uses either `meta.json` or `_meta.json` files for sidebar navigation. Read the existing structure in `content/docs/` before modifying to understand the exact format.
- **Polar environment variables**: The checkout flow will return 503 until `POLAR_PRODUCT_PRO_MONTHLY`, `POLAR_PRODUCT_PRO_ANNUAL`, `POLAR_PRODUCT_ENTERPRISE_MONTHLY`, and `POLAR_PRODUCT_ENTERPRISE_ANNUAL` are set in Vercel environment. The create-polar-products.mjs script outputs these IDs once run -- the user must then set them in Vercel Dashboard.
- **CSV export on large datasets**: The export endpoint caps at 10,000 rows. For users with very large datasets, include a note in the UI that only the most recent 10,000 records are exported. For larger exports, use `kova report --format csv` from the CLI which has no size limit.
- **No website tests added in this phase**: Website testing setup (Playwright/Jest) is a Phase 5 concern. This phase focuses on the most impactful gaps.
- **Version**: kova-cli bumps from 0.3.0 to 0.4.0 in this phase. The website version stays at 0.1.0 (package.json private).

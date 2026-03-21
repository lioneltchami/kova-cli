# Plan: Kova Phase 9 -- Post-Launch Iteration

## Task Description

Phase 9 is the first iteration cycle after Kova v1.0.0 ships. Phases 1-8 delivered a complete, production-hardened product: 553+ CLI tests across 46 test files, 19 commands, 11 collectors, a full web dashboard with 98 pages, 149 tests, enterprise features (RBAC, audit logging, cost centers, GDPR, SSO stub, webhook delivery), growth features (anomaly detection, forecasting, badges, GitHub App, Slack), security headers, WCAG 2.1 AA accessibility, and comprehensive Fumadocs documentation (26+ MDX pages).

Phase 9 focuses exclusively on work that is only possible -- or only meaningful -- once real users are hitting the product. Pre-launch optimization is guesswork. Post-launch optimization is data-driven.

**Repo context**: All Phase 9 work targets the `kova-website` repository (Next.js 16 + Supabase). The `kova-cli` repo (this repo at `/Users/lionel/builders/kova-cli`) is stable at v1.0.0 and receives no changes in Phase 9. CLI tests must remain passing as a regression gate.

---

## Current State (Post-Phase 8)

### CLI (kova-cli) -- STABLE, NO CHANGES

| Dimension  | Value                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version    | 1.0.0                                                                                                                                                           |
| Commands   | 19 (track, compare, costs, budget, sync, report, login, logout, account, config, completions, init, dashboard, data export, tag, ci-report, audit, sso, policy) |
| Collectors | 11 (claude_code, cursor, copilot, windsurf, devin, aider, cline, continue_dev, amazon_q, bolt [stub], lovable [stub])                                           |
| Tests      | 46 files, ~757 test cases                                                                                                                                       |
| Stack      | ESM, TypeScript strict, Commander.js, tsup, vitest                                                                                                              |
| Storage    | ~/.kova/usage.json (atomic writes, 100k cap), synced-ids.json, credentials.json, config.json                                                                    |
| Sync       | POST /api/v1/usage, Bearer token, batch 500, exponential backoff, dedup via synced-ids                                                                          |

### Website (kova-website) -- TARGET FOR PHASE 9

| Dimension | Value                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Stack     | Next.js 16, React 19, App Router, Tailwind v4, Framer Motion, Recharts, Fumadocs |
| Auth      | Supabase Auth (GitHub OAuth)                                                     |
| Database  | Supabase PostgreSQL, 8 migrations (001 through 008_gdpr_retention)               |
| Payments  | Polar.sh ($15/seat Pro, $30/seat Enterprise)                                     |
| Email     | Resend (configured in lib/resend.ts)                                             |
| i18n      | next-intl v4 installed, 45 keys in en.json, hardcoded locale: "en"               |
| Tests     | 149 tests (Vitest + Playwright)                                                  |
| Pages     | 98 total (dashboard, admin, marketing, docs)                                     |
| CSP       | wss://\*.supabase.co already allowed (Realtime ready at infra level)             |

### Identified Gaps (Research-Validated)

| Gap                                 | Impact                                           | Complexity        |
| ----------------------------------- | ------------------------------------------------ | ----------------- |
| No Realtime subscriptions           | Users must reload after `kova sync`              | Low (infra ready) |
| Sequential dashboard queries        | Slow TTFB with data growth                       | Medium            |
| No DB indexes on hot paths          | Query degradation at scale                       | Low               |
| English-only marketing pages        | Blocks non-English community adoption            | Medium            |
| No PWA support                      | No "Add to Home Screen", zero offline capability | Medium            |
| No scheduled email reports          | No re-engagement loop for inactive users         | Medium            |
| Badge API exists but undiscoverable | Users cannot find/copy badge embed code          | Low               |

---

## Objective

Deliver seven high-impact post-launch improvements across three implementation phases:

### Phase 1: Foundation (Parallel -- 3 independent tracks)

1. **Real-time Usage Dashboard** (Track A) -- Supabase Realtime on usage page
2. **Badge Discovery UI** (Track E) -- Copy-to-clipboard badge embed in settings
3. **DB Migrations + Performance** (Tracks F+G) -- Indexes + Promise.all + unstable_cache

### Phase 2: Core Features (After Phase 1 -- 2 tracks)

4. **i18n String Extraction + French** (Track B) -- Locale detection + translations
5. **Weekly Email Reports** (Track D) -- Edge Function + Resend + settings toggle

### Phase 3: Polish + Validation (After Phase 2 -- 2 tracks)

6. **PWA + Offline** (Track C) -- Manifest + service worker + icons
7. **Final Validation** (Track V) -- Quality gate across all deliverables

---

## Problem Statement

Phase 8 shipped a complete, tested product. The three biggest friction points users will hit immediately are:

1. **Stale data experience**: After running `kova sync`, users must manually reload the dashboard to see their latest usage. This breaks the mental model of sync-and-see.
2. **English-only content**: Developer tools with strong non-English communities (France, Germany, Brazil) see 2-3x better conversion when landing pages are localized.
3. **No repeat-engagement hook**: Users who don't check the dashboard daily have no pull mechanism. Email reports are the standard SaaS re-engagement loop.

---

## Solution Approach

**Track A (Real-time):** Add a `RealtimeUsageProvider` client component that subscribes to the `usage_records` Supabase channel filtered by `user_id`. The usage page becomes a hybrid: initial server render + live updates via Realtime. No new infrastructure required -- CSP already permits `wss://*.supabase.co`.

**Track B (i18n):** Add locale detection to `lib/i18n.ts` using `Accept-Language` header parsing. Extract strings from the homepage and pricing page into `messages/en.json` `"landing"` namespace. Provide `messages/fr.json` with French translations. No URL path prefixing (no `/en/`, `/fr/` routes) -- that is a Phase 10 concern.

**Track C (PWA):** Add `public/manifest.json` with Kova branding, create PWA icons from `wolf-logo.svg`, implement a minimal `public/sw.js` (network-first for API, cache-first for static). Register via a `PwaRegistrar` client component. Do NOT add `next-pwa` as a dependency.

**Track D (Email Reports):** Add `weekly_reports_enabled` boolean to `notification_preferences` table (migration 009). Update `NotificationSettings` component with toggle. Create Edge Function `weekly-report-sender` that runs weekly via cron, queries rollups, and sends via Resend.

**Track E (Badge Discovery):** Add a `BadgeEmbedCard` component to settings page with badge preview and copy-to-clipboard for Markdown, HTML, and URL formats.

**Track F (Performance):** Refactor `analytics/page.tsx` to use `Promise.all()` for independent Supabase queries. Wrap rollup queries in `unstable_cache()` with 5-minute TTL. Add `revalidateTag()` in the sync API route for instant cache invalidation.

**Track G (DB Indexes):** Create migration `010_performance_indexes.sql` with composite indexes on the four highest-frequency query patterns.

---

## Relevant Files

### Track A: Real-time Usage

**Existing files to modify:**

- `app/dashboard/usage/page.tsx` -- Server component, needs hybrid approach with RealtimeUsageProvider wrapper
- `components/dashboard/usage-table.tsx` -- Client component, receives live records

**Existing files to read (context only):**

- `utils/supabase/client.ts` -- Browser Supabase client for Realtime subscriptions
- `next.config.mjs` -- Verify CSP allows wss://\*.supabase.co

**New files:**

- `components/dashboard/realtime-usage-provider.tsx` -- Client component with Supabase channel subscription

### Track B: i18n

**Existing files to modify:**

- `lib/i18n.ts` -- Change from hardcoded "en" to Accept-Language detection
- `messages/en.json` -- Add "landing" namespace with extracted homepage/pricing strings
- `app/layout.tsx` -- Dynamic `<html lang>` attribute via `getLocale()`
- `app/page.tsx` -- Replace hardcoded strings with `getTranslations('landing')`
- `app/pricing/page.tsx` -- Replace hardcoded strings with `getTranslations('pricing')`

**Existing files to read (context only):**

- `middleware.ts` -- Understand current route matching
- `next.config.mjs` -- i18n configuration

**New files:**

- `messages/fr.json` -- French translations matching en.json structure

### Track C: PWA

**Existing files to modify:**

- `app/layout.tsx` -- Add manifest link, apple-mobile-web-app metadata, PwaRegistrar component

**Existing files to read (context only):**

- `public/wolf-logo.svg` -- Source logo for icon generation
- `next.config.mjs` -- Verify no conflicting PWA config
- `package.json` -- Confirm next-pwa is NOT installed (do not add it)

**New files:**

- `public/manifest.json` -- PWA manifest with Kova branding
- `public/icons/icon-192.png` (or .svg if sharp unavailable) -- 192x192 PWA icon
- `public/icons/icon-512.png` (or .svg) -- 512x512 PWA icon
- `public/sw.js` -- Minimal service worker (cache static, network-first for API)
- `components/pwa-registrar.tsx` -- Client component to register SW in useEffect

### Track D: Weekly Email Reports

**Existing files to modify:**

- `components/dashboard/notification-settings.tsx` -- Add "Weekly cost summary email" toggle
- `app/api/v1/notifications/route.ts` -- Extend schema to handle `weekly_reports_enabled`

**Existing files to read (context only):**

- `lib/resend.ts` -- Resend client pattern
- `supabase/functions/health-checker/index.ts` -- Edge Function pattern reference
- `components/dashboard/notification-settings.tsx` -- Current toggle patterns

**New files:**

- `supabase/migrations/009_weekly_reports.sql` -- ALTER TABLE ADD COLUMN
- `supabase/functions/weekly-report-sender/index.ts` -- Deno Edge Function

### Track E: Badge Discovery

**Existing files to modify:**

- `app/dashboard/settings/page.tsx` -- Add BadgeEmbedCard section below API Keys

**Existing files to read (context only):**

- `app/api/badges/[userId]/route.ts` -- Badge API (already implemented, no changes needed)
- `components/dashboard/api-key-manager.tsx` -- Component style reference

**New files:**

- `components/dashboard/badge-embed-card.tsx` -- Badge preview + copy-to-clipboard

### Track F: Dashboard Performance

**Existing files to modify:**

- `app/dashboard/analytics/page.tsx` -- Promise.all() for independent queries + unstable_cache
- `app/dashboard/page.tsx` -- Same parallel query treatment for overview
- `app/api/v1/usage/route.ts` -- Add revalidateTag() on successful upload

### Track G: DB Indexes

**New files:**

- `supabase/migrations/010_performance_indexes.sql` -- 4 composite indexes

### Summary: New Files (9 total)

| File                                               | Track | Type             |
| -------------------------------------------------- | ----- | ---------------- |
| `components/dashboard/realtime-usage-provider.tsx` | A     | Client component |
| `messages/fr.json`                                 | B     | Translation file |
| `public/manifest.json`                             | C     | PWA manifest     |
| `public/icons/icon-192.png` (or .svg)              | C     | PWA icon         |
| `public/icons/icon-512.png` (or .svg)              | C     | PWA icon         |
| `public/sw.js`                                     | C     | Service worker   |
| `components/pwa-registrar.tsx`                     | C     | Client component |
| `supabase/migrations/009_weekly_reports.sql`       | D     | DB migration     |
| `supabase/migrations/010_performance_indexes.sql`  | G     | DB migration     |
| `supabase/functions/weekly-report-sender/index.ts` | D     | Edge Function    |
| `components/dashboard/badge-embed-card.tsx`        | E     | Client component |

---

## Team Orchestration

You are the team lead. Deploy specialists in parallel tracks as documented below. Never write code directly.

### Team Members

- Specialist
  - Name: realtime-engineer
  - Role: Implement Supabase Realtime subscription for the usage page live updates
  - Agent Type: frontend-specialist
  - Tracks: A
  - Resume: true

- Specialist
  - Name: performance-engineer
  - Role: Write DB index migrations, parallelize dashboard queries with Promise.all, add unstable_cache
  - Agent Type: performance-optimizer
  - Tracks: F, G
  - Resume: true

- Specialist
  - Name: i18n-engineer
  - Role: Update i18n locale detection, extract marketing strings, write French translations
  - Agent Type: frontend-specialist
  - Tracks: B
  - Resume: true

- Specialist
  - Name: email-reports-engineer
  - Role: Write weekly report Edge Function, DB migration, and notification settings UI update
  - Agent Type: backend-engineer
  - Tracks: D
  - Resume: true

- Specialist
  - Name: pwa-engineer
  - Role: Add PWA manifest, icons, service worker, and PwaRegistrar to the website
  - Agent Type: frontend-specialist
  - Tracks: C
  - Resume: true

- Specialist
  - Name: growth-features-engineer
  - Role: Implement badge embed discovery UI on the settings page
  - Agent Type: frontend-specialist
  - Tracks: E
  - Resume: true

- Quality Engineer (Validator)
  - Name: phase9-validator
  - Role: Validate all Phase 9 deliverables against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

---

## Step by Step Tasks

### Task 1: DB Migration -- Weekly Reports Column

- **Task ID**: db-migration-weekly-reports
- **Depends On**: none
- **Assigned To**: performance-engineer
- **Agent Type**: performance-optimizer
- **Track**: D (prep)
- **Parallel**: true
- **Complexity**: Low
- **Files Changed**: 1 new

**Context files to read first:**

- `supabase/migrations/008_gdpr_retention.sql` -- understand migration numbering convention, table names, SQL style
- `components/dashboard/notification-settings.tsx` -- understand current notification_preferences columns

**Implementation:**

Create `supabase/migrations/009_weekly_reports.sql`:

```sql
-- Migration 009: Add weekly email report opt-in
-- Phase 9: Post-Launch Iteration

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS weekly_reports_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN notification_preferences.weekly_reports_enabled
  IS 'When true, user receives a weekly AI cost summary email every Monday at 8am UTC.';
```

**Verification:**

- File exists at `supabase/migrations/009_weekly_reports.sql`
- Contains `ALTER TABLE notification_preferences`
- Contains `weekly_reports_enabled boolean`
- Column defaults to `false` (opt-in, not opt-out)

---

### Task 2: DB Migration -- Performance Indexes

- **Task ID**: db-migration-indexes
- **Depends On**: none
- **Assigned To**: performance-engineer
- **Agent Type**: performance-optimizer
- **Track**: G
- **Parallel**: true
- **Complexity**: Low
- **Files Changed**: 1 new

**Context files to read first:**

- `supabase/migrations/008_gdpr_retention.sql` -- migration style reference
- `app/dashboard/page.tsx` -- identify most common query patterns (user_id + date range on usage_daily_rollups)
- `app/dashboard/analytics/page.tsx` -- identify secondary patterns (user_id + tool + date on usage_records)
- `app/dashboard/usage/page.tsx` -- identify tertiary patterns

**Implementation:**

Create `supabase/migrations/010_performance_indexes.sql`:

```sql
-- Migration 010: Performance indexes for dashboard query patterns
-- Phase 9: Post-Launch Iteration
--
-- These indexes target the four highest-frequency query patterns
-- identified from dashboard page analysis:
--   1. User's records in date order (usage page, overview page)
--   2. Tool breakdown per user per date range (analytics page)
--   3. Daily rollups by user and date (overview, analytics)
--   4. Daily rollups by user, tool, and date (cost center reports)
--
-- Using IF NOT EXISTS for idempotency.
-- NOT using CONCURRENTLY because Supabase CLI migrations run in
-- transactions by default and CONCURRENTLY cannot run inside a
-- transaction block.

-- Primary dashboard pattern: user's records in date order
CREATE INDEX IF NOT EXISTS idx_usage_records_user_date
  ON usage_records(user_id, recorded_at DESC);

-- Analytics page: tool breakdown per user per date range
CREATE INDEX IF NOT EXISTS idx_usage_records_user_tool_date
  ON usage_records(user_id, tool, recorded_at DESC);

-- Daily rollups: the most-queried table after Phase 6 optimization
CREATE INDEX IF NOT EXISTS idx_usage_daily_rollups_user_date
  ON usage_daily_rollups(user_id, date DESC);

-- Cost centers rollup queries (enterprise teams)
CREATE INDEX IF NOT EXISTS idx_usage_daily_rollups_user_tool_date
  ON usage_daily_rollups(user_id, tool, date DESC);
```

**Verification:**

- File exists at `supabase/migrations/010_performance_indexes.sql`
- Contains 4 `CREATE INDEX IF NOT EXISTS` statements
- Indexes cover: `usage_records(user_id, recorded_at)`, `usage_records(user_id, tool, recorded_at)`, `usage_daily_rollups(user_id, date)`, `usage_daily_rollups(user_id, tool, date)`
- Does NOT use `CONCURRENTLY` (migration safety)
- All indexes use `DESC` ordering for recency-first queries

---

### Task 3: Dashboard Query Performance -- Promise.all + unstable_cache

- **Task ID**: dashboard-performance
- **Depends On**: db-migration-indexes
- **Assigned To**: performance-engineer
- **Agent Type**: performance-optimizer
- **Track**: F
- **Parallel**: false (depends on Task 2)
- **Complexity**: Medium
- **Files Changed**: 3 modified

**Context files to read first:**

- `app/dashboard/analytics/page.tsx` (full) -- identify all sequential queries and their dependencies
- `app/dashboard/page.tsx` (full) -- identify sequential queries on overview page
- `app/api/v1/usage/route.ts` (full) -- understand upload handler for adding revalidateTag

**Implementation -- analytics/page.tsx:**

The current page runs its Supabase queries sequentially (each `await supabase.from(...)` blocks the next). All queries take `user.id` as input and none depend on each other's output -- they are fully independent.

1. Identify all independent queries (they share only `user.id` as input)
2. Wrap them in `Promise.all()`:

```ts
const [
  { data: rangeRollup },
  { data: budget },
  { data: teamMembers },
  // ... all other independent queries
] = await Promise.all([
  supabase.from('usage_daily_rollups').select(...).eq('user_id', userId)...,
  supabase.from('budgets').select(...).eq('user_id', userId)...,
  admin.from('team_members').select(...).eq('team_id', teamId)...,
  // ...
]);
```

3. Wrap the two most expensive rollup query fetch functions in `unstable_cache()`:

```ts
import { unstable_cache } from "next/cache";

const getUserRollup = (userId: string, since: string, until: string) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("usage_daily_rollups")
        .select(
          "date, tool, total_cost_usd, total_sessions, total_input_tokens, total_output_tokens",
        )
        .eq("user_id", userId)
        .gte("date", since)
        .lte("date", until);
      return data ?? [];
    },
    [`rollup-${userId}-${since}-${until}`],
    { revalidate: 300, tags: [`user-rollup-${userId}`] },
  )();
```

**Implementation -- dashboard/page.tsx:**

Same parallel query optimization for the main overview page. Identify sequential rollup queries and wrap in `Promise.all()`. Add `unstable_cache` to the primary rollup query.

**Implementation -- api/v1/usage/route.ts:**

After successful record insertion, invalidate the cache:

```ts
import { revalidateTag } from "next/cache";

// After successful insert:
revalidateTag(`user-rollup-${userId}`);
```

This ensures the dashboard shows fresh data immediately after a sync, even within the 5-minute cache window.

**Verification:**

- `grep "Promise.all" app/dashboard/analytics/page.tsx` -- parallel queries present
- `grep "unstable_cache" app/dashboard/analytics/page.tsx` -- cache wrapping present
- `grep "Promise.all" app/dashboard/page.tsx` -- overview also parallelized
- `grep "revalidateTag" app/api/v1/usage/route.ts` -- cache invalidation on sync
- No sequential `await supabase.from(...)` calls remain between independent queries
- `import { unstable_cache } from "next/cache"` present in modified files
- `import { revalidateTag } from "next/cache"` present in usage route

---

### Task 4: Real-time Usage Updates

- **Task ID**: realtime-usage
- **Depends On**: none
- **Assigned To**: realtime-engineer
- **Agent Type**: frontend-specialist
- **Track**: A
- **Parallel**: true
- **Complexity**: Medium
- **Files Changed**: 1 new, 1 modified

**Context files to read first:**

- `app/dashboard/usage/page.tsx` (full) -- understand server component structure, data fetching, props
- `components/dashboard/usage-table.tsx` (full) -- understand client component interface and expected data shape
- `utils/supabase/client.ts` (full) -- browser Supabase client for Realtime subscriptions
- `next.config.mjs` (full) -- verify CSP allows wss://\*.supabase.co

**Implementation -- Create realtime-usage-provider.tsx:**

Create `components/dashboard/realtime-usage-provider.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

// Match the UsageRecord shape from the usage page server query
interface UsageRecord {
  id: string;
  recorded_at: string;
  tool: string;
  cost_usd: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  project: string | null;
  session_id: string;
}

interface RealtimeUsageProviderProps {
  userId: string;
  initialRecords: UsageRecord[];
  children: (props: {
    records: UsageRecord[];
    isLive: boolean;
  }) => React.ReactNode;
}

// Prerequisites: Enable Realtime on usage_records table in
// Supabase Dashboard > Database > Replication

export function RealtimeUsageProvider({
  userId,
  initialRecords,
  children,
}: RealtimeUsageProviderProps) {
  const [records, setRecords] = useState<UsageRecord[]>(initialRecords);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`usage-records:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "usage_records",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRecord = payload.new as UsageRecord;
          setRecords((prev) => [newRecord, ...prev].slice(0, 50));
        },
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return <>{children({ records, isLive })}</>;
}
```

**Implementation -- Update usage/page.tsx:**

1. The usage page remains a server component for initial data fetching
2. Pass `user.id` and the initial records array to `RealtimeUsageProvider`
3. Wrap `UsageTable` inside `RealtimeUsageProvider`
4. Add a subtle pulsing green dot indicator next to the page title when `isLive` is true

```tsx
// In the server component, pass data down:
<RealtimeUsageProvider userId={user.id} initialRecords={records}>
  {({ records: liveRecords, isLive }) => (
    <>
      <div className="flex items-center gap-2">
        <h1>Usage</h1>
        {isLive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>
      <UsageTable records={liveRecords} />
    </>
  )}
</RealtimeUsageProvider>
```

**Important notes:**

- Supabase Realtime respects RLS policies. The `usage_records` table already has RLS enabled (migration 003). The client-side subscription uses the anon key and will only receive events for the authenticated user's rows -- secure by default.
- The Realtime subscription must be enabled on the `usage_records` table in the Supabase Dashboard under Database > Replication. Document this as a required manual configuration step.

**Verification:**

- `realtime-usage-provider.tsx` exists with `postgres_changes` subscription
- `grep "RealtimeUsageProvider" app/dashboard/usage/page.tsx` -- provider integrated
- `grep "isLive\|animate-ping" app/dashboard/usage/page.tsx` -- live indicator present
- Component passes `userId` and `initialRecords` props
- Cleanup via `supabase.removeChannel(channel)` in useEffect return

---

### Task 5: Badge Embed Discovery UI

- **Task ID**: badge-embed-ui
- **Depends On**: none
- **Assigned To**: growth-features-engineer
- **Agent Type**: frontend-specialist
- **Track**: E
- **Parallel**: true
- **Complexity**: Low
- **Files Changed**: 1 new, 1 modified

**Context files to read first:**

- `app/dashboard/settings/page.tsx` (full) -- understand page layout, sections, styling
- `app/api/badges/[userId]/route.ts` (full) -- badge API is already implemented, understand URL format
- `components/dashboard/api-key-manager.tsx` (full) -- use as component style reference for card layout

**Implementation -- Create badge-embed-card.tsx:**

Create `components/dashboard/badge-embed-card.tsx`:

```tsx
"use client";

import { useState } from "react";

interface BadgeEmbedCardProps {
  userId: string;
}

type EmbedFormat = "markdown" | "html" | "url";

export function BadgeEmbedCard({ userId }: BadgeEmbedCardProps) {
  const [copied, setCopied] = useState<EmbedFormat | null>(null);

  const badgeUrl = `https://kova.dev/api/badges/${userId}`;

  const embedCodes: Record<EmbedFormat, { label: string; code: string }> = {
    markdown: {
      label: "Markdown",
      code: `[![Kova AI Cost](${badgeUrl})](https://kova.dev)`,
    },
    html: {
      label: "HTML",
      code: `<a href="https://kova.dev"><img src="${badgeUrl}" alt="Kova AI Cost"></a>`,
    },
    url: {
      label: "URL",
      code: badgeUrl,
    },
  };

  const handleCopy = async (format: EmbedFormat) => {
    await navigator.clipboard.writeText(embedCodes[format].code);
    setCopied(format);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <h3 className="text-lg font-semibold text-white mb-2">Cost Badge</h3>
      <p className="text-sm text-neutral-400 mb-4">
        Share your AI development cost badge in your project README.
      </p>

      {/* Badge preview */}
      <div className="mb-6 flex items-center justify-center rounded-md bg-neutral-950 p-4">
        <img src={badgeUrl} alt="Kova AI Cost Badge Preview" className="h-5" />
      </div>

      {/* Copy buttons */}
      <div className="space-y-2">
        {(Object.keys(embedCodes) as EmbedFormat[]).map((format) => (
          <div key={format} className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-neutral-950 px-3 py-2 text-xs text-neutral-300 font-mono">
              {embedCodes[format].code}
            </code>
            <button
              onClick={() => handleCopy(format)}
              className="shrink-0 rounded bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              {copied === format
                ? "Copied!"
                : `Copy ${embedCodes[format].label}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Implementation -- Update settings/page.tsx:**

- Import `BadgeEmbedCard` from `@/components/dashboard/badge-embed-card`
- Add a new section below the API Keys section:

```tsx
<BadgeEmbedCard userId={user.id} />
```

- The user.id is already available in the settings page from the Supabase auth session

**Verification:**

- `badge-embed-card.tsx` exists with `navigator.clipboard.writeText`
- `grep "BadgeEmbedCard" app/dashboard/settings/page.tsx` -- imported and rendered
- `grep "kova.dev/api/badges" components/dashboard/badge-embed-card.tsx` -- correct badge URL
- Three embed formats: Markdown, HTML, URL
- Dark card styling matches dashboard theme (bg-neutral-900, border-neutral-800)

---

### Task 6: i18n -- Locale Detection + String Extraction + French Translation

- **Task ID**: i18n-extraction
- **Depends On**: none
- **Assigned To**: i18n-engineer
- **Agent Type**: frontend-specialist
- **Track**: B
- **Parallel**: true
- **Complexity**: Medium
- **Files Changed**: 5 modified, 1 new

**Context files to read first:**

- `lib/i18n.ts` (full) -- current hardcoded locale setup
- `messages/en.json` (full) -- current 45 keys, 6 namespaces
- `app/layout.tsx` (full) -- where html lang attribute is set
- `app/page.tsx` (full) -- homepage, extract all visible text strings
- `app/pricing/page.tsx` (full) -- pricing page, extract strings
- `middleware.ts` (full) -- current route matching
- `next.config.mjs` (full) -- i18n configuration
- `app/changelog/page.tsx` (full) -- another marketing page

**Step 1: Update lib/i18n.ts for locale detection**

Change from hardcoded `locale: "en"` to Accept-Language header detection. Support `en` (default) and `fr`:

```ts
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

const SUPPORTED_LOCALES = ["en", "fr"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en";
  // Parse Accept-Language: fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
  return SUPPORTED_LOCALES.includes(preferred as Locale)
    ? (preferred as Locale)
    : "en";
}

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = detectLocale(headersList.get("accept-language"));
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Design decision**: This is Accept-Language detection only -- no URL path prefixing (`/en/`, `/fr/`). URL-based locale switching is a Phase 10 item requiring significant routing restructuring. Accept-Language provides 80% of the value at 10% of the cost.

**Step 2: Extract homepage strings into en.json**

Add a `"landing"` namespace to `messages/en.json` with strings extracted from `app/page.tsx`:

- Hero headline, subheadline, CTA button text
- Feature section titles and descriptions (3-4 features)
- Social proof / stats section text
- Footer links and copyright text
- "How it works" section steps

Also add a `"pricing"` namespace with strings from `app/pricing/page.tsx`:

- Plan names, descriptions, prices
- Feature lists for each tier
- CTA button text
- FAQ items

Do NOT extract:

- Dynamic content or code samples
- Brand names ("Kova", "Claude Code", "Cursor", etc.) -- keep as-is in JSX
- Component prop values

**Step 3: Update app/page.tsx and app/pricing/page.tsx**

Replace hardcoded JSX text with `getTranslations()` calls. Use server-side approach (no "use client" needed):

```tsx
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("landing");

  return (
    // ...
    <h1>{t("heroHeadline")}</h1>
    <p>{t("heroSubheadline")}</p>
    <button>{t("heroCta")}</button>
    // ...
  );
}
```

**Step 4: Create messages/fr.json**

Create `messages/fr.json` with the same key structure as `en.json`. Focus on natural developer-friendly French -- not overly formal. Key translations:

- "AI Dev FinOps" stays in English (product category term)
- "Track" -> "Suivre"
- "Dashboard" -> "Tableau de bord"
- "Budget" -> "Budget" (same in French)
- "Get Started Free" -> "Commencer gratuitement"
- "Settings" -> "Parametres"
- "Usage" -> "Utilisation"
- "Analytics" -> "Analytiques"
- "Cost" -> "Cout"
- "Monthly" -> "Mensuel"
- "Weekly" -> "Hebdomadaire"
- "Compare" -> "Comparer"

**Step 5: Update app/layout.tsx**

Add dynamic `lang` attribute:

```tsx
import { getLocale } from "next-intl/server";

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="dark">
      {/* ... */}
    </html>
  );
}
```

**Verification:**

- `grep "detectLocale\|accept-language" lib/i18n.ts` -- locale detection present
- `ls messages/fr.json` -- French translations file exists
- `grep "landing" messages/en.json` -- landing namespace added
- `grep "pricing" messages/en.json` -- pricing namespace added
- `grep "getTranslations\|useTranslations" app/page.tsx` -- translations used
- `grep "getTranslations\|useTranslations" app/pricing/page.tsx` -- translations used
- `grep "getLocale" app/layout.tsx` -- dynamic locale in layout
- `messages/fr.json` has same top-level keys as `messages/en.json`

---

### Task 7: Weekly Email Reports

- **Task ID**: weekly-reports
- **Depends On**: db-migration-weekly-reports (Task 1)
- **Assigned To**: email-reports-engineer
- **Agent Type**: backend-engineer
- **Track**: D
- **Parallel**: false (depends on Task 1)
- **Complexity**: Medium
- **Files Changed**: 2 modified, 1 new

**Context files to read first:**

- `components/dashboard/notification-settings.tsx` (full) -- understand current toggles, API calls, UI patterns
- `lib/resend.ts` (full) -- Resend client, email template patterns
- `supabase/functions/health-checker/index.ts` (full) -- Edge Function pattern (Deno imports, env vars, structure)
- `app/api/v1/notifications/route.ts` (full) -- current notification preferences API schema
- `supabase/migrations/009_weekly_reports.sql` -- confirm column exists

**Step 1: Update notification-settings.tsx**

Add a new toggle row for "Weekly cost summary email" below existing notification toggles. When toggled, PATCH `/api/v1/notifications` with `{ weekly_reports_enabled: boolean }`.

Match the existing toggle pattern in the component:

- Same UI: label, description text, switch component
- Label: "Weekly cost summary"
- Description: "Receive a summary of your AI development costs every Monday at 8am UTC"

**Step 2: Extend API route**

Read `app/api/v1/notifications/route.ts`. Extend the request body schema to accept `weekly_reports_enabled` boolean. Add it to the UPDATE query.

**Step 3: Create Edge Function**

Create `supabase/functions/weekly-report-sender/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Get all users with weekly reports enabled
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq("weekly_reports_enabled", true);

  let sent = 0;
  let errors = 0;

  for (const pref of prefs ?? []) {
    try {
      // 2. Query weekly rollup data (last 7 days)
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data: rollups } = await supabase
        .from("usage_daily_rollups")
        .select(
          "date, tool, total_cost_usd, total_sessions, total_input_tokens, total_output_tokens",
        )
        .eq("user_id", pref.user_id)
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });

      // 3. Query previous week for comparison
      const prevSince = new Date();
      prevSince.setDate(prevSince.getDate() - 14);
      const { data: prevRollups } = await supabase
        .from("usage_daily_rollups")
        .select("total_cost_usd")
        .eq("user_id", pref.user_id)
        .gte("date", prevSince.toISOString().slice(0, 10))
        .lt("date", since.toISOString().slice(0, 10));

      // 4. Get user email from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", pref.user_id)
        .single();

      if (!profile?.email || !rollups?.length) continue;

      // 5. Compute stats
      const totalCost = rollups.reduce(
        (s, r) => s + Number(r.total_cost_usd),
        0,
      );
      const prevTotalCost = (prevRollups ?? []).reduce(
        (s, r) => s + Number(r.total_cost_usd),
        0,
      );
      const percentChange =
        prevTotalCost > 0
          ? (((totalCost - prevTotalCost) / prevTotalCost) * 100).toFixed(1)
          : null;

      // Find top tool by cost
      const toolCosts = new Map<string, number>();
      for (const r of rollups) {
        toolCosts.set(
          r.tool,
          (toolCosts.get(r.tool) ?? 0) + Number(r.total_cost_usd),
        );
      }
      const topTool =
        [...toolCosts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

      // 6. Send via Resend
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Kova <reports@kova.dev>",
          to: profile.email,
          subject: `Your AI dev costs this week -- $${totalCost.toFixed(2)}`,
          html: buildWeeklyReportHtml({
            rollups,
            totalCost,
            prevTotalCost,
            percentChange,
            topTool,
            userId: pref.user_id,
          }),
        }),
      });

      if (res.ok) sent++;
      else errors++;
    } catch {
      errors++;
    }
  }

  return new Response(
    JSON.stringify({ sent, errors, total: prefs?.length ?? 0 }),
    { headers: { "Content-Type": "application/json" } },
  );
});

interface ReportData {
  rollups: Array<{
    date: string;
    tool: string;
    total_cost_usd: string;
    total_sessions: number;
    total_input_tokens: number;
    total_output_tokens: number;
  }>;
  totalCost: number;
  prevTotalCost: number;
  percentChange: string | null;
  topTool: string;
  userId: string;
}

function buildWeeklyReportHtml(data: ReportData): string {
  const { rollups, totalCost, percentChange, topTool, userId } = data;

  // Aggregate daily totals
  const dailyTotals = new Map<string, number>();
  for (const r of rollups) {
    dailyTotals.set(
      r.date,
      (dailyTotals.get(r.date) ?? 0) + Number(r.total_cost_usd),
    );
  }

  const dailyRows = [...dailyTotals.entries()]
    .map(
      ([date, cost]) =>
        `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #333; color: #ccc;">${date}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #333; color: #fff; text-align: right;">$${cost.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const changeText = percentChange
    ? `<p style="color: ${Number(percentChange) > 0 ? "#ef4444" : "#22c55e"}; font-size: 14px; margin: 8px 0;">
        ${Number(percentChange) > 0 ? "+" : ""}${percentChange}% vs previous week
      </p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background: #0a0a0a; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
    <h1 style="color: #fff; font-size: 20px; margin-bottom: 4px;">Your Weekly AI Cost Summary</h1>
    <p style="color: #888; font-size: 13px; margin-top: 0;">Kova FinOps Report</p>

    <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="color: #888; font-size: 12px; margin: 0 0 4px;">Total Spend</p>
      <p style="color: #fff; font-size: 28px; font-weight: 700; margin: 0;">$${totalCost.toFixed(2)}</p>
      ${changeText}
      <p style="color: #888; font-size: 12px; margin: 12px 0 0;">Top tool: <span style="color: #4361EE;">${topTool}</span></p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr>
          <th style="padding: 8px 12px; text-align: left; color: #888; font-size: 12px; border-bottom: 1px solid #333;">Date</th>
          <th style="padding: 8px 12px; text-align: right; color: #888; font-size: 12px; border-bottom: 1px solid #333;">Cost</th>
        </tr>
      </thead>
      <tbody>${dailyRows}</tbody>
    </table>

    <a href="https://kova.dev/dashboard" style="display: inline-block; background: #4361EE; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; margin-top: 16px;">
      View Full Dashboard
    </a>

    <p style="color: #555; font-size: 11px; margin-top: 32px;">
      <a href="https://kova.dev/dashboard/settings" style="color: #555;">Unsubscribe</a> from weekly reports in your notification settings.
    </p>
  </div>
</body>
</html>`;
}
```

**Cron configuration**: The Edge Function must be scheduled in the Supabase Dashboard:

- Schedule: `0 8 * * 1` (every Monday at 8am UTC)
- Function name: `weekly-report-sender`
- Document this as a required manual configuration step

**Verification:**

- `ls supabase/functions/weekly-report-sender/index.ts` -- Edge Function exists
- `grep "weekly_reports_enabled" components/dashboard/notification-settings.tsx` -- toggle in UI
- `grep "buildWeeklyReportHtml" supabase/functions/weekly-report-sender/index.ts` -- email template present
- `grep "Resend\|resend.com" supabase/functions/weekly-report-sender/index.ts` -- Resend API call
- `grep "usage_daily_rollups" supabase/functions/weekly-report-sender/index.ts` -- queries rollup table
- Edge Function computes: total spend, top tool, % change vs previous week
- Email includes: daily cost table, week-over-week comparison, CTA to dashboard, unsubscribe link

---

### Task 8: PWA -- Manifest + Icons + Service Worker

- **Task ID**: pwa-setup
- **Depends On**: i18n-extraction (Task 6) -- layout changes from i18n should land first
- **Assigned To**: pwa-engineer
- **Agent Type**: frontend-specialist
- **Track**: C
- **Parallel**: false (depends on Task 6)
- **Complexity**: Medium
- **Files Changed**: 1 modified, 4-5 new

**Context files to read first:**

- `app/layout.tsx` (full) -- where manifest link and PwaRegistrar go
- `public/wolf-logo.svg` (read to understand logo vector)
- `next.config.mjs` (full) -- verify no conflicting config
- `package.json` -- check if `sharp` exists for PNG icon generation

**Step 1: Create public/manifest.json**

```json
{
  "name": "Kova - AI Dev FinOps",
  "short_name": "Kova",
  "description": "Track AI development costs across Claude Code, Cursor, Copilot, and more.",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#1A1A2E",
  "theme_color": "#4361EE",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "maskable any"
    }
  ],
  "categories": ["productivity", "finance", "developer"],
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/dashboard",
      "description": "View AI cost overview"
    },
    {
      "name": "Usage",
      "url": "/dashboard/usage",
      "description": "Detailed usage records"
    }
  ]
}
```

**Note on icons**: Check if `sharp` is in package.json. If yes, generate PNG icons from wolf-logo.svg. If not, use SVG icons with `"type": "image/svg+xml"`. Browsers accept SVG icons in manifest.json. Do NOT add sharp as a new dependency just for icon generation.

**Step 2: Create PWA icons**

Create `public/icons/icon-192.svg` and `public/icons/icon-512.svg` based on the wolf-logo.svg source. If sharp is available, generate PNGs instead. The icon should work on both light and dark backgrounds (use the Kova dark background color #1A1A2E as padding/background).

**Step 3: Create public/sw.js**

```js
const CACHE_NAME = "kova-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for API routes and dashboard (dynamic data)
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("/dashboard")
  ) {
    return; // Let network handle dynamic routes
  }
  // Cache-first for static assets
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached ?? fetch(event.request)),
  );
});
```

**Step 4: Create components/pwa-registrar.tsx**

```tsx
"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed -- non-critical
      });
    }
  }, []);

  return null;
}
```

**Step 5: Update app/layout.tsx**

Add to the `metadata` export:

```ts
export const metadata: Metadata = {
  // ... existing metadata ...
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kova",
  },
  themeColor: "#4361EE",
};
```

Add `<PwaRegistrar />` inside the body (after other components, before closing body tag). Import from `@/components/pwa-registrar`.

**Verification:**

- `ls public/manifest.json` -- manifest exists
- `grep "manifest\|appleWebApp\|themeColor" app/layout.tsx` -- PWA metadata in layout
- `ls public/sw.js` -- service worker exists
- `grep "PwaRegistrar\|serviceWorker" app/layout.tsx` -- SW registration wired
- `ls public/icons/` -- icon files exist (SVG or PNG)
- Manifest has correct `start_url: "/dashboard"`, `theme_color: "#4361EE"`, `background_color: "#1A1A2E"`
- Service worker has install, activate, and fetch handlers
- Network-first for `/api/` routes, cache-first for static assets

---

### Task 9: Final Validation

- **Task ID**: validate-phase9
- **Depends On**: ALL previous tasks (1-8)
- **Assigned To**: phase9-validator
- **Agent Type**: quality-engineer
- **Track**: V
- **Parallel**: false
- **Complexity**: Low
- **Files Changed**: 0 (read-only inspection)

Operate in read-only inspection mode. Do not modify any files.

**Checklist -- Database migrations:**

- [ ] `ls supabase/migrations/009_weekly_reports.sql` -- file exists
- [ ] `ls supabase/migrations/010_performance_indexes.sql` -- file exists
- [ ] `grep "weekly_reports_enabled" supabase/migrations/009_weekly_reports.sql` -- column in migration
- [ ] `grep "idx_usage_records_user_date" supabase/migrations/010_performance_indexes.sql` -- index exists
- [ ] `grep "idx_usage_daily_rollups_user_date" supabase/migrations/010_performance_indexes.sql` -- index exists
- [ ] All indexes use `IF NOT EXISTS` for idempotency
- [ ] No `CONCURRENTLY` keyword (migration safety)

**Checklist -- Performance refactor:**

- [ ] `grep "Promise.all" app/dashboard/analytics/page.tsx` -- parallel queries present
- [ ] `grep "unstable_cache" app/dashboard/analytics/page.tsx` -- cache wrapping present
- [ ] `grep "Promise.all" app/dashboard/page.tsx` -- overview also parallelized
- [ ] `grep "revalidateTag" app/api/v1/usage/route.ts` -- cache invalidation on sync
- [ ] Import `unstable_cache` from `"next/cache"` is present
- [ ] Import `revalidateTag` from `"next/cache"` is present
- [ ] No remaining sequential `await supabase.from(...)` calls between independent queries

**Checklist -- Realtime:**

- [ ] `ls components/dashboard/realtime-usage-provider.tsx` -- file exists
- [ ] `grep "postgres_changes" components/dashboard/realtime-usage-provider.tsx` -- subscription present
- [ ] `grep "channel\|subscribe" components/dashboard/realtime-usage-provider.tsx` -- channel setup
- [ ] `grep "removeChannel" components/dashboard/realtime-usage-provider.tsx` -- cleanup present
- [ ] `grep "RealtimeUsageProvider" app/dashboard/usage/page.tsx` -- provider integrated
- [ ] `grep "isLive\|animate-ping" app/dashboard/usage/page.tsx` -- live indicator present
- [ ] Component passes both `userId` and `initialRecords` props

**Checklist -- Badge embed:**

- [ ] `ls components/dashboard/badge-embed-card.tsx` -- file exists
- [ ] `grep "BadgeEmbedCard" app/dashboard/settings/page.tsx` -- integrated
- [ ] `grep "kova.dev/api/badges" components/dashboard/badge-embed-card.tsx` -- correct URL
- [ ] `grep "clipboard" components/dashboard/badge-embed-card.tsx` -- copy functionality
- [ ] Three format options present: Markdown, HTML, URL

**Checklist -- i18n:**

- [ ] `ls messages/fr.json` -- French translations exist
- [ ] `grep "detectLocale\|accept-language\|Accept-Language" lib/i18n.ts` -- locale detection
- [ ] `grep "landing" messages/en.json` -- landing namespace added
- [ ] `grep "getTranslations\|useTranslations" app/page.tsx` -- translations in homepage
- [ ] `grep "getTranslations\|useTranslations" app/pricing/page.tsx` -- translations in pricing
- [ ] `grep "getLocale" app/layout.tsx` -- dynamic locale in layout
- [ ] fr.json has same top-level namespace keys as en.json:
  ```bash
  node -e "
  const en = Object.keys(require('./messages/en.json')).sort();
  const fr = Object.keys(require('./messages/fr.json')).sort();
  console.log('Match:', JSON.stringify(en) === JSON.stringify(fr));
  console.log('EN:', en.join(', '));
  console.log('FR:', fr.join(', '));
  "
  ```

**Checklist -- Weekly reports:**

- [ ] `ls supabase/functions/weekly-report-sender/index.ts` -- Edge Function exists
- [ ] `grep "weekly_reports_enabled" components/dashboard/notification-settings.tsx` -- toggle in UI
- [ ] `grep "buildWeeklyReportHtml" supabase/functions/weekly-report-sender/index.ts` -- email template
- [ ] `grep "resend.com\|RESEND_API_KEY" supabase/functions/weekly-report-sender/index.ts` -- Resend integration
- [ ] `grep "usage_daily_rollups" supabase/functions/weekly-report-sender/index.ts` -- queries rollups
- [ ] Edge Function handles: total spend, top tool, week-over-week comparison
- [ ] Email includes: daily cost table, dashboard CTA, unsubscribe link

**Checklist -- PWA:**

- [ ] `ls public/manifest.json` -- manifest exists
- [ ] `grep "manifest\|appleWebApp" app/layout.tsx` -- PWA metadata in layout
- [ ] `ls public/sw.js` -- service worker exists
- [ ] `grep "PwaRegistrar\|serviceWorker.register" app/layout.tsx` -- SW registration wired
- [ ] `ls public/icons/` -- icon files exist
- [ ] Manifest has `start_url: "/dashboard"`, `theme_color: "#4361EE"`

**Checklist -- Build health:**

- [ ] `pnpm build` passes (kova-website) -- Next.js builds without errors
- [ ] `pnpm test` passes (kova-website) -- all 149+ tests pass
- [ ] `cd /Users/lionel/builders/kova-cli && npm test` -- all 553+ CLI tests pass (regression gate)
- [ ] No TypeScript errors: `pnpm tsc --noEmit`

**Report format:**
For each checklist item, report PASS or FAIL with specific failure details. Summarize total: X/Y checks passed.

---

## Acceptance Criteria

1. **Realtime**: After `kova sync` uploads a record, the `/dashboard/usage` page updates within 2 seconds without a page reload. The live status indicator (pulsing green dot) is visible when the Realtime channel is SUBSCRIBED.

2. **i18n**: `messages/fr.json` exists with all namespaces matching `en.json`. The `lib/i18n.ts` detects `Accept-Language: fr` header and returns French strings. `app/page.tsx` and `app/pricing/page.tsx` use `getTranslations()` instead of hardcoded English strings. The `<html lang>` attribute reflects the detected locale.

3. **PWA**: `public/manifest.json` exists with correct Kova branding (name, short_name, theme_color #4361EE, start_url /dashboard). The manifest is linked in `app/layout.tsx` metadata. `public/sw.js` exists with install/activate/fetch handlers. Chrome DevTools Lighthouse PWA audit scores installable.

4. **Weekly Reports**: `supabase/migrations/009_weekly_reports.sql` adds `weekly_reports_enabled boolean DEFAULT false` column. The notification settings page has a "Weekly cost summary" toggle. The Edge Function `weekly-report-sender/index.ts` exists with email send logic including daily cost table, week-over-week comparison, top tool, dashboard CTA, and unsubscribe link.

5. **Badge Embed**: `components/dashboard/badge-embed-card.tsx` exists with copy-to-clipboard functionality for Markdown, HTML, and URL formats. The component is rendered in `app/dashboard/settings/page.tsx` with badge preview image.

6. **Performance**: `app/dashboard/analytics/page.tsx` uses `Promise.all()` for independent Supabase queries. At least one rollup query is wrapped in `unstable_cache` with 5-minute TTL. The v1 usage upload API route calls `revalidateTag` to invalidate cache on sync. `app/dashboard/page.tsx` overview queries are also parallelized.

7. **DB Indexes**: Migration `010_performance_indexes.sql` contains 4 `CREATE INDEX IF NOT EXISTS` statements for: `usage_records(user_id, recorded_at DESC)`, `usage_records(user_id, tool, recorded_at DESC)`, `usage_daily_rollups(user_id, date DESC)`, `usage_daily_rollups(user_id, tool, date DESC)`.

8. **Build health**: `pnpm build` in kova-website passes. All 149+ existing website tests pass. All 553+ CLI tests pass.

---

## Dependency Graph

```
                 +-----------------------+
                 |   Task 1: Migration   |
                 |   009 (weekly_reports) |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |   Task 7: Weekly      |
                 |   Email Reports       |
                 +-----------+-----------+
                             |
                             |
+-----------+  +-----------+ | +-----------+
| Task 4:   |  | Task 2:   | | | Task 5:   |
| Realtime  |  | Migration | | | Badge     |
| Usage     |  | 010       | | | Embed UI  |
| (indep.)  |  | (indexes) | | | (indep.)  |
+-----+-----+  +-----+-----+ | +-----+-----+
      |               |       |       |
      |               v       |       |
      |         +-----+-----+ |       |
      |         | Task 3:   | |       |
      |         | Dashboard | |       |
      |         | Perf      | |       |
      |         +-----+-----+ |       |
      |               |       |       |
      |               |       |       |
      |   +-----------+-------+       |
      |   |   Task 6: i18n           |
      |   |   (indep. but            |
      |   |    layout changes)       |
      |   +----------+--+            |
      |              |               |
      |              v               |
      |   +----------+--+            |
      |   | Task 8: PWA |            |
      |   | (after i18n |            |
      |   |  layout)    |            |
      |   +----------+--+            |
      |              |               |
      +--------------+-------+-------+
                     |
                     v
          +----------+----------+
          |   Task 9: Final     |
          |   Validation        |
          +---------------------+
```

### Parallel Execution Windows

**Window 1** (fully parallel):

- Task 1: Migration 009 (weekly reports column)
- Task 2: Migration 010 (performance indexes)
- Task 4: Realtime usage (Track A)
- Task 5: Badge embed UI (Track E)
- Task 6: i18n extraction (Track B)

**Window 2** (after Window 1 completes):

- Task 3: Dashboard performance (depends on Task 2)
- Task 7: Weekly email reports (depends on Task 1)
- Task 8: PWA setup (depends on Task 6 for layout changes)

**Window 3** (after all):

- Task 9: Final validation

---

## Validation Commands

```bash
# Website build
cd <kova-website-path> && pnpm build

# Website tests
cd <kova-website-path> && pnpm test

# CLI tests (must remain unaffected -- regression gate)
cd /Users/lionel/builders/kova-cli && npm test

# Verify realtime provider exists
ls components/dashboard/realtime-usage-provider.tsx

# Verify FR translations exist and match EN keys at top level
node -e "
const en = Object.keys(require('./messages/en.json')).sort();
const fr = Object.keys(require('./messages/fr.json')).sort();
console.log('Match:', JSON.stringify(en) === JSON.stringify(fr));
console.log('EN:', en.join(', '));
console.log('FR:', fr.join(', '));
"

# Verify PWA manifest
cat public/manifest.json | python3 -m json.tool

# Verify DB migrations
ls supabase/migrations/ | sort

# Verify badge embed component
grep "clipboard\|copy\|Copy" components/dashboard/badge-embed-card.tsx

# Verify parallel queries
grep "Promise.all" app/dashboard/analytics/page.tsx

# Verify cache invalidation on sync
grep "revalidateTag" app/api/v1/usage/route.ts

# Verify Edge Function
ls supabase/functions/weekly-report-sender/index.ts
```

---

## Risk Mitigation

| Risk                                                         | Mitigation                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Realtime requires table-level Supabase config                | Document as manual step; add prerequisite comment in provider component                       |
| `unstable_cache` API may change in Next.js 17                | The API is production-safe in Next.js 14-16; prefix indicates future API surface changes only |
| Edge Function cron requires Supabase Dashboard config        | Document cron expression `0 8 * * 1` as required manual setup step                            |
| i18n Accept-Language detection may conflict with CDN caching | Add `Vary: Accept-Language` header in next.config.mjs security headers                        |
| Service worker may cache stale dashboard data                | Network-first strategy for /api/ and /dashboard routes prevents stale data                    |
| French translations may have inaccuracies                    | Use natural developer-friendly French; mark as "community-editable" for future PRs            |
| layout.tsx has changes from both i18n and PWA tracks         | PWA track depends on i18n to avoid merge conflicts; sequential execution enforced             |

---

## Notes

**On Realtime and RLS:**
Supabase Realtime respects Row Level Security policies. The `usage_records` table already has RLS enabled (from migration 003_security_hardening.sql). The client-side Realtime subscription uses the anon key and will only receive events for the authenticated user's rows -- this is secure by default. No additional RLS policy changes are needed.

**On `CREATE INDEX CONCURRENTLY` in migrations:**
Supabase CLI migrations run inside transactions by default, and `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. We use regular `CREATE INDEX IF NOT EXISTS` (without CONCURRENTLY) for migration simplicity. The indexes are on tables small enough that non-concurrent creation is fast. The `IF NOT EXISTS` guard ensures idempotency.

**On i18n scope:**
This plan intentionally scopes i18n to Accept-Language detection without URL path prefixing (no `/en/`, `/fr/` routes). URL-based locale switching is a Phase 10 item that requires significant routing restructuring. Accept-Language detection provides 80% of the value at 10% of the cost.

**On PWA and Next.js App Router:**
Next.js 16 has native `manifest` support in the Metadata API. Do not use the `next-pwa` package -- it adds build complexity and is not well-maintained for Next.js 15+. The manual `sw.js` approach is simpler and more maintainable.

**On `unstable_cache` stability:**
Despite the `unstable_` prefix, `unstable_cache` is the official Next.js App Router caching API as of Next.js 14+ and is production-safe. The prefix indicates the API may change in future major versions, not that it is buggy.

**On the CLI (kova-cli):**
Phase 9 introduces zero CLI changes. The CLI is stable at v1.0.0 with 553 tests. CLI tests serve as a regression gate only. The next CLI work should be triggered by user feedback, not pre-planned.

**Priority if time-constrained:**
Execute in this priority order: (1) Realtime usage, (2) Badge embed UI, (3) Dashboard performance + DB indexes, (4) Weekly reports, (5) i18n extraction, (6) PWA setup. The first two have the highest user delight per engineering hour.

**Manual configuration steps required after deployment:**

1. Enable Realtime on `usage_records` table: Supabase Dashboard > Database > Replication
2. Schedule weekly-report-sender Edge Function: Supabase Dashboard > Edge Functions > Cron > `0 8 * * 1`
3. Add `Vary: Accept-Language` to CDN/reverse proxy configuration if caching is enabled

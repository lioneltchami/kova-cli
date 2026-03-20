# Plan: Kova Phase 9 -- Post-Launch Iteration

## Task Description

Phase 9 is the first iteration cycle after Kova v1.0.0 ships. Phases 1-8 delivered a complete, production-hardened product: 553 CLI tests, 20 commands, 11 collectors, a full web dashboard with 98 pages, 149 tests, enterprise features (RBAC, audit logging, cost centers, GDPR, SSO stub, webhook delivery), growth features (anomaly detection, forecasting, badges, GitHub App, Slack), security headers, WCAG 2.1 AA accessibility, and comprehensive documentation.

Phase 9 focuses exclusively on work that is only possible -- or only meaningful -- once real users are hitting the product. Pre-launch optimization is guesswork. Post-launch optimization is data-driven.

Research across both repos identified the following concrete gaps and opportunities:

**Dashboard Performance (real bottleneck once users have data):**

- `app/dashboard/analytics/page.tsx` is 361 lines of server-side query logic -- all queries run sequentially before rendering
- No React `cache()` deduplification across dashboard page navigations
- `usage_daily_rollups` is already used for the overview page (Phase 6 optimization), but analytics and usage pages still read raw `usage_records` for some queries
- No database indexes are documented on `usage_records(user_id, recorded_at)` -- the most common query pattern
- The OG image at `/api/og` is static for all pages -- no per-page dynamic metadata to drive click-through from social shares

**Real-time Features (Supabase Realtime already configured in CSP):**

- The CSP in `next.config.mjs` already allows `wss://*.supabase.co` for WebSocket connections -- Supabase Realtime is wired and ready at the infrastructure level
- Zero Realtime subscriptions exist in the dashboard today
- The usage page is the highest-value real-time target: users run `kova sync` from CLI and want to see records appear without reload
- The anomaly chart is the second target: alert-like behavior when cost spikes appear

**i18n Foundation (scaffolded, not populated):**

- `next-intl` v4 is installed and wired through `next.config.mjs` + `lib/i18n.ts` + `messages/en.json`
- `en.json` has only 45 keys covering 6 namespaces (common, dashboard, kpi, onboarding, settings)
- The marketing pages (homepage, pricing, changelog) use zero `useTranslations()` calls -- all hardcoded English strings
- No locale routing exists: `lib/i18n.ts` is hardcoded to `locale: "en"` with no path detection
- A French or Spanish translation could be completed in under a day once strings are extracted
- This is a significant word-of-mouth driver for non-English-speaking developer communities

**Mobile / Responsive Polish:**

- The dashboard sidebar is desktop-first with a hamburger menu on mobile -- the sidebar already has mobile toggle logic
- Charts (Recharts) use `ResponsiveContainer` but chart tooltips overflow viewport on small screens
- The usage table on mobile has no horizontal scroll wrapper on the `overflow-x-auto` container in the main dashboard page (inline table in `dashboard/page.tsx`, not the `UsageTable` component)
- No PWA manifest (`/public/manifest.json`) -- browsers cannot prompt "Add to Home Screen"
- No service worker -- offline capability is zero

**Scheduled Reports / PDF Export:**

- No scheduled email reports exist (Resend is installed and configured in `lib/resend.ts`)
- The `report` CLI command generates text/CSV/JSON locally but no PDF
- CSV export button (`csv-export-button.tsx`) exists in the usage page but only exports the current page view, not full date-range data
- No "email me a weekly summary" UI in notification settings

**Public Benchmarks / Social Proof:**

- The badge system (`/api/badges/[userId]`) generates shields.io-style cost badges but users have no in-dashboard flow to discover or copy their badge embed code
- No anonymized benchmark data exists ("average Claude Code user spends $X/month")
- The admin panel exists (`/app/admin/`) but no data aggregation pipeline for benchmarks

**VS Code Extension:**

- The CLI has no IDE plugin surface -- all interaction is terminal-based
- A VS Code status bar item showing today's cost and a command palette entry for `kova costs --today` would dramatically increase daily active usage (DAU)
- This is a separate npm package (`kova-vscode`) but shares the same `~/.kova/usage.json` data path as the CLI

**White-label / Self-hosted:**

- No Docker Compose setup for self-hosted deployment
- No environment variable documentation for a self-hosted Supabase instance
- This is a blocker for enterprise deals where data cannot leave the company network

## Objective

Deliver four high-impact post-launch improvements in priority order:

1. **Real-time Usage Dashboard** -- Supabase Realtime subscriptions on the usage page so records appear live after `kova sync` without reload. Highest user delight, lowest complexity (infrastructure already wired).

2. **i18n String Extraction + French Translation** -- Extract all hardcoded English strings from the 5 most-trafficked marketing pages into `messages/en.json` + add `messages/fr.json`. Enables locale routing and drives word-of-mouth in French-speaking developer communities.

3. **PWA + Offline Capability** -- Add a `manifest.json`, service worker, and installable PWA so the dashboard can be added to home screen. Increases re-engagement and daily check-in behavior.

4. **Scheduled Weekly Email Reports** -- Add a "weekly summary" opt-in to notification settings, backed by a Supabase Edge Function that queries rollup data and sends via Resend. Closes the loop for users who don't check the dashboard daily.

5. **Badge Discovery UI** -- Add a "Copy Badge" component to the settings page so users can share their AI spend badge in README files. Direct word-of-mouth driver.

6. **Performance: Parallel Queries + `unstable_cache`** -- Parallelize the sequential Supabase queries in `analytics/page.tsx` using `Promise.all()` and wrap rollup queries in `unstable_cache()` with 5-minute TTL. Measurable TTFB improvement once users have substantial data.

7. **Database Performance Indexes** -- Add a migration with composite indexes on `usage_records(user_id, recorded_at DESC)` and `usage_daily_rollups(user_id, date DESC)` to support the dashboard's most common query patterns.

## Problem Statement

Phase 8 shipped a complete, tested product. The three biggest friction points users will hit immediately are:

1. **Stale data experience**: After running `kova sync`, users must manually reload the dashboard to see their latest usage. This breaks the mental model of sync-and-see.
2. **English-only content**: Developer tools with strong non-English communities (France, Germany, Brazil) see 2-3x better conversion when landing pages are localized.
3. **No repeat-engagement hook**: Users who don't check the dashboard daily have no pull mechanism. Email reports are the standard SaaS re-engagement loop.

## Solution Approach

**Track A (Real-time):** Add a `RealtimeUsageProvider` client component that subscribes to the `usage_records` Supabase channel filtered by `user_id`. The usage page becomes a hybrid: initial server render + live updates via Realtime. No new infrastructure required -- CSP already permits `wss://*.supabase.co`.

**Track B (i18n):** Add locale detection to `lib/i18n.ts` using `next-intl`'s `getLocale()`. Add `[locale]` route segment to the marketing pages. Extract strings from the 5 most-trafficked marketing pages. Provide `messages/fr.json` with French translations. Dashboard stays English-only for now (too many strings -- do in a follow-up).

**Track C (PWA):** Add `public/manifest.json` with Kova branding, add the `<link rel="manifest">` tag to the root layout, implement a minimal Next.js service worker via `next-pwa` or a custom `sw.js`. Cache static assets and the dashboard shell for offline resilience.

**Track D (Email Reports):** Add a `weekly_reports_enabled` boolean to the `notification_preferences` table (migration 009). Update the `NotificationSettings` component to expose the toggle. Create a new Edge Function `weekly-report-sender` that runs on a cron schedule, queries `usage_daily_rollups` for the past 7 days, and sends a formatted email via Resend.

**Track E (Badge Discovery):** Add a `BadgeEmbedCard` component to the settings page that shows the user's badge preview and a copy-to-clipboard button for the Markdown embed code.

**Track F (Performance):** Refactor `analytics/page.tsx` to use `Promise.all()` for its Supabase queries. Wrap the two most expensive rollup queries in `unstable_cache()` with `{ revalidate: 300, tags: ['analytics'] }`. Add `revalidateTag('analytics')` call in the v1 sync API route so data freshens on upload.

**Track G (DB Indexes):** Create migration `009_performance_indexes.sql` with `CREATE INDEX CONCURRENTLY` for the four highest-frequency query patterns identified in the dashboard page analysis.

## Relevant Files

**kova-website -- real-time:**

- `C:/PROJ/kova-website/app/dashboard/usage/page.tsx` -- server component, needs hybrid approach
- `C:/PROJ/kova-website/components/dashboard/usage-table.tsx` -- client component target for realtime updates
- `C:/PROJ/kova-website/utils/supabase/client.ts` -- browser Supabase client for Realtime subscriptions
- New: `C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx`

**kova-website -- i18n:**

- `C:/PROJ/kova-website/lib/i18n.ts` -- currently hardcoded to `locale: "en"`, needs locale detection
- `C:/PROJ/kova-website/messages/en.json` -- 45 keys today, needs marketing string extraction
- `C:/PROJ/kova-website/app/page.tsx` -- homepage (most trafficked)
- `C:/PROJ/kova-website/app/pricing/page.tsx` -- second most trafficked
- `C:/PROJ/kova-website/app/layout.tsx` -- `<html lang="en">` needs dynamic locale
- New: `C:/PROJ/kova-website/messages/fr.json`

**kova-website -- PWA:**

- `C:/PROJ/kova-website/app/layout.tsx` -- add manifest link
- `C:/PROJ/kova-website/next.config.mjs` -- configure PWA plugin
- New: `C:/PROJ/kova-website/public/manifest.json`
- New: `C:/PROJ/kova-website/public/icons/` (PWA icon set)

**kova-website -- email reports:**

- `C:/PROJ/kova-website/supabase/migrations/` -- new migration 009 for `weekly_reports_enabled`
- `C:/PROJ/kova-website/components/dashboard/notification-settings.tsx` -- add weekly report toggle
- `C:/PROJ/kova-website/lib/resend.ts` -- existing Resend client
- New: `C:/PROJ/kova-website/supabase/functions/weekly-report-sender/index.ts`
- New: `C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql`

**kova-website -- badge discovery:**

- `C:/PROJ/kova-website/app/dashboard/settings/page.tsx` -- add badge embed card section
- `C:/PROJ/kova-website/app/api/badges/[userId]/route.ts` -- already exists, no changes needed
- New: `C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx`

**kova-website -- performance:**

- `C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` -- parallelize queries + `unstable_cache`
- `C:/PROJ/kova-website/app/dashboard/page.tsx` -- add `unstable_cache` to rollup queries
- `C:/PROJ/kova-website/app/api/v1/usage/route.ts` -- add `revalidateTag` on successful upload
- New: `C:/PROJ/kova-website/supabase/migrations/009_performance_indexes.sql` (or 010 if weekly_reports uses 009)

### New Files

- `C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx` -- Realtime subscription client component
- `C:/PROJ/kova-website/messages/fr.json` -- French translations (45+ keys matching en.json structure)
- `C:/PROJ/kova-website/public/manifest.json` -- PWA manifest
- `C:/PROJ/kova-website/public/icons/icon-192.png` -- PWA icon (192x192, can be generated from wolf-logo.svg)
- `C:/PROJ/kova-website/public/icons/icon-512.png` -- PWA icon (512x512)
- `C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx` -- Badge discovery UI
- `C:/PROJ/kova-website/supabase/functions/weekly-report-sender/index.ts` -- Edge function for weekly emails
- `C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql` -- `weekly_reports_enabled` column
- `C:/PROJ/kova-website/supabase/migrations/010_performance_indexes.sql` -- DB performance indexes

## Implementation Phases

### Phase 1: Foundation

Run three independent tracks in parallel:

- **Realtime Infrastructure** (Track A): Create `RealtimeUsageProvider` client component with Supabase channel subscription. Keep usage page as server component for initial render; provider handles live updates.
- **DB Migration + Performance** (Track G + F): Write migrations 009 and 010, then parallelize `analytics/page.tsx` queries and add `unstable_cache` wrapping.
- **Badge Embed Card** (Track E): Simplest high-value track -- a single client component and settings page integration.

### Phase 2: Core Implementation

After Phase 1 foundation is validated:

- **i18n String Extraction** (Track B): Update `lib/i18n.ts` to read locale from request headers, extract strings from homepage and pricing page into `en.json`, create `fr.json` with French translations.
- **Email Reports** (Track D): DB migration for `weekly_reports_enabled`, `NotificationSettings` UI update, Edge Function.

### Phase 3: Integration and Polish

- **PWA** (Track C): `manifest.json`, layout link tag, icon generation, service worker configuration. Depends on layout changes from i18n track completing first to avoid conflicts.
- **Validation**: Full build verification, test suite, acceptance criteria audit.

## Team Orchestration

You are the team lead. Deploy specialists in parallel tracks as documented below. Never write code directly.

### Team Members

- Specialist
  - Name: realtime-engineer
  - Role: Implement Supabase Realtime subscription for the usage page live updates
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: performance-engineer
  - Role: Parallelize dashboard queries with Promise.all, add unstable_cache, write DB index migrations
  - Agent Type: performance-optimizer
  - Resume: true

- Specialist
  - Name: i18n-engineer
  - Role: Update i18n locale detection, extract marketing strings, write French translations
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: email-reports-engineer
  - Role: Write weekly report Edge Function, DB migration, and notification settings UI update
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: pwa-engineer
  - Role: Add PWA manifest, icons, and service worker configuration to the website
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: growth-features-engineer
  - Role: Implement badge embed discovery UI on the settings page
  - Agent Type: growth-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: phase9-validator
  - Role: Validate all Phase 9 deliverables against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. DB Migrations: Performance Indexes + Weekly Reports Column

- **Task ID**: db-migrations
- **Depends On**: none
- **Assigned To**: performance-engineer
- **Agent Type**: performance-optimizer
- **Parallel**: true

Read these files before starting:

- `C:/PROJ/kova-website/supabase/migrations/008_gdpr_retention.sql` (full -- to understand migration numbering convention and table names)
- `C:/PROJ/kova-website/app/dashboard/page.tsx` (full -- identifies most common query patterns)
- `C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` (full -- more query patterns)
- `C:/PROJ/kova-website/app/dashboard/usage/page.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/notification-settings.tsx` (full -- to understand current notification_preferences columns)

Create `C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql`:

```sql
-- Add weekly email report opt-in to notification_preferences
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS weekly_reports_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN notification_preferences.weekly_reports_enabled
  IS 'When true, user receives a weekly AI cost summary email every Monday at 8am UTC.';
```

Create `C:/PROJ/kova-website/supabase/migrations/010_performance_indexes.sql`:

```sql
-- Composite indexes for dashboard query patterns
-- All use CONCURRENTLY to avoid locking in production

-- Primary dashboard pattern: user's records in date order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_records_user_date
  ON usage_records(user_id, recorded_at DESC);

-- Analytics page: tool breakdown per user per date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_records_user_tool_date
  ON usage_records(user_id, tool, recorded_at DESC);

-- Daily rollups: the most-queried table after Phase 6 optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_daily_rollups_user_date
  ON usage_daily_rollups(user_id, date DESC);

-- Cost centers rollup queries (enterprise teams)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_daily_rollups_user_tool_date
  ON usage_daily_rollups(user_id, tool, date DESC);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Supabase CLI migrations run in a transaction by default. Add `-- supabase-cli: disable-transaction` at the top of the migration file OR use a non-concurrent index creation if the Supabase migration runner does not support the disable-transaction pragma. Verify the Supabase CLI version in use before deciding -- if unsure, use `CREATE INDEX IF NOT EXISTS` (without CONCURRENTLY) to stay safe.

### 2. Dashboard Query Performance: Promise.all + unstable_cache

- **Task ID**: dashboard-performance
- **Depends On**: db-migrations
- **Assigned To**: performance-engineer
- **Agent Type**: performance-optimizer
- **Parallel**: false

Read these files:

- `C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` (full)
- `C:/PROJ/kova-website/app/dashboard/page.tsx` (full)
- `C:/PROJ/kova-website/app/api/v1/usage/route.ts` (full -- to add revalidateTag on upload)

**analytics/page.tsx refactor:**

The current page runs its Supabase queries sequentially (each `await supabase.from(...)` blocks the next). Refactor to use `Promise.all()` for all queries that don't depend on each other. Identify which queries are independent (they all take `user.id` as input -- none depend on each other's output).

Pattern:

```ts
const [
  { data: rangeRollup },
  { data: budget },
  { data: teamMembers },
  // ... other independent queries
] = await Promise.all([
  supabase.from('usage_daily_rollups').select(...),
  supabase.from('budgets').select(...),
  admin.from('team_members').select(...),
  // ...
]);
```

**Wrap rollup queries in `unstable_cache`:**

Import `unstable_cache` from `next/cache`. Wrap the rollup query fetch functions (not the whole page component -- create thin wrapper functions). Use a 5-minute TTL (`revalidate: 300`) and cache tags `['usage-rollup', userId]`.

Example pattern:

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

**Add `revalidateTag` in the sync/upload API route:**

When the CLI calls `POST /api/v1/usage` (the sync endpoint), after a successful insert, call:

```ts
import { revalidateTag } from "next/cache";
revalidateTag(`user-rollup-${userId}`);
```

This ensures the dashboard shows fresh data immediately after a sync, even within the 5-minute cache window.

Do the same parallel query optimization for `app/dashboard/page.tsx` -- the main overview page also has multiple sequential rollup queries.

### 3. Realtime Usage Updates

- **Task ID**: realtime-usage
- **Depends On**: none
- **Assigned To**: realtime-engineer
- **Agent Type**: frontend-specialist
- **Parallel**: true

Read these files:

- `C:/PROJ/kova-website/app/dashboard/usage/page.tsx` (full)
- `C:/PROJ/kova-website/components/dashboard/usage-table.tsx` (full)
- `C:/PROJ/kova-website/utils/supabase/client.ts` (full -- browser Supabase client)
- `C:/PROJ/kova-website/next.config.mjs` (full -- verify CSP allows wss://\*.supabase.co)

Create `C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface UsageRecord {
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
  children: (records: UsageRecord[]) => React.ReactNode;
}

export function RealtimeUsageProvider({
  userId,
  initialRecords,
  children,
}: RealtimeUsageProviderProps) {
  const [records, setRecords] = useState<UsageRecord[]>(initialRecords);

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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return <>{children(records)}</>;
}
```

Update `app/dashboard/usage/page.tsx`:

- Pass `user.id` as a prop down to `RealtimeUsageProvider`
- Wrap the `UsageTable` with `RealtimeUsageProvider`
- Initial records from the server query flow through as `initialRecords`
- The table renders from live state rather than static server data

Add a subtle "live" indicator (a pulsing dot) to the usage page header to signal real-time status. Only show it when the Realtime channel is `SUBSCRIBED`.

Note: Realtime requires the `usage_records` table to have Realtime enabled in Supabase (Publications). Document this as a Supabase dashboard configuration step in a comment at the top of the file: `// Prerequisites: Enable Realtime on usage_records table in Supabase Dashboard > Database > Replication`.

### 4. Badge Embed Discovery UI

- **Task ID**: badge-embed-ui
- **Depends On**: none
- **Assigned To**: growth-features-engineer
- **Agent Type**: growth-engineer
- **Parallel**: true

Read these files:

- `C:/PROJ/kova-website/app/dashboard/settings/page.tsx` (full)
- `C:/PROJ/kova-website/app/api/badges/[userId]/route.ts` (full -- badge API is already implemented)
- `C:/PROJ/kova-website/components/dashboard/api-key-manager.tsx` (full -- use as component style reference)

Create `C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx`:

This is a "use client" component with:

1. A shield.io-style badge preview (rendered as an `<img>` tag pointing to `/api/badges/[userId]`)
2. Three copy-to-clipboard buttons:
   - Markdown: `[![Kova AI Cost](https://kova.dev/api/badges/[userId])](https://kova.dev)`
   - HTML: `<a href="https://kova.dev"><img src="https://kova.dev/api/badges/[userId]" alt="Kova AI Cost"></a>`
   - URL only: `https://kova.dev/api/badges/[userId]`
3. A brief description: "Share your AI development cost badge in your project README."
4. Style: match the dark card style used throughout the dashboard settings page

Update `app/dashboard/settings/page.tsx`:

- Import `BadgeEmbedCard`
- Add it as a new section below the API Keys section with heading "Cost Badge"
- Pass `userId` (from `user.id`) as a prop

### 5. i18n: Locale Detection + String Extraction + French Translation

- **Task ID**: i18n-extraction
- **Depends On**: none
- **Assigned To**: i18n-engineer
- **Agent Type**: frontend-specialist
- **Parallel**: true

Read these files:

- `C:/PROJ/kova-website/lib/i18n.ts` (full)
- `C:/PROJ/kova-website/messages/en.json` (full)
- `C:/PROJ/kova-website/app/layout.tsx` (full)
- `C:/PROJ/kova-website/app/page.tsx` (full -- homepage, extract all visible text strings)
- `C:/PROJ/kova-website/app/pricing/page.tsx` (full -- extract pricing page strings)
- `C:/PROJ/kova-website/app/changelog/page.tsx` (full)
- `C:/PROJ/kova-website/middleware.ts` (full -- understand current route matching)
- `C:/PROJ/kova-website/next.config.mjs` (full)

**Step 1: Update `lib/i18n.ts` for locale detection**

Change from hardcoded `locale: "en"` to locale detection from the `Accept-Language` header. Support `en` (default) and `fr`. Use `next-intl`'s server-side `getLocale()` pattern:

```ts
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

const SUPPORTED_LOCALES = ["en", "fr"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en";
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

Note: This is a soft locale detection approach (Accept-Language header, no URL path prefixing). It does NOT require adding `[locale]` route segments -- that is a Phase 10 concern if there is demand for URL-based locale switching. Accept-Language detection is sufficient for initial i18n value with zero routing changes.

**Step 2: Extract homepage strings into en.json**

Add a `"landing"` namespace to `messages/en.json` with the following extracted from `app/page.tsx`:

- Hero headline, subheadline, and CTA button text
- Feature section titles and descriptions (3-4 features)
- Social proof / stats section
- Footer links and copyright text

Do not extract dynamic content, code samples, or brand names (keep "Kova", "Claude Code", "Cursor" etc. as-is in JSX).

**Step 3: Update app/page.tsx and app/pricing/page.tsx to use useTranslations()**

For the extracted strings: replace hardcoded JSX text with `t('landing.heroHeadline')` etc. The components must use `"use client"` with `useTranslations` OR remain server components and use `getTranslations()` from `next-intl/server`. Prefer server component approach (no "use client" needed) -- use `getTranslations('landing')`.

**Step 4: Create messages/fr.json**

Create `C:/PROJ/kova-website/messages/fr.json` with the same key structure as `en.json`, with accurate French translations. Focus on natural developer-friendly French -- not overly formal. Key translations to get right:

- "AI Dev FinOps" stays in English (it's a product category term)
- "Track" -> "Suivre", "Dashboard" -> "Tableau de bord", "Budget" -> "Budget" (same)
- CTA: "Get Started Free" -> "Commencer gratuitement"
- Nav items: Settings -> "Paramètres", Usage -> "Utilisation", Analytics -> "Analytiques"

Update `app/layout.tsx` to use dynamic `lang` attribute:

```tsx
// In RootLayout, get locale from next-intl
import { getLocale } from 'next-intl/server';
const locale = await getLocale();
// ...
<html lang={locale} className="dark">
```

### 6. Weekly Email Reports

- **Task ID**: weekly-reports
- **Depends On**: db-migrations
- **Assigned To**: email-reports-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Read these files:

- `C:/PROJ/kova-website/components/dashboard/notification-settings.tsx` (full)
- `C:/PROJ/kova-website/lib/resend.ts` (full -- Resend client and email patterns)
- `C:/PROJ/kova-website/supabase/functions/health-checker/index.ts` (full -- Edge Function pattern reference)
- `C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql` (the migration from Task 1)

**Update `notification-settings.tsx`:**

Add a new toggle row for "Weekly cost summary email" below the existing notification toggles. When toggled, call `PATCH /api/v1/notifications` with `{ weekly_reports_enabled: boolean }`. The API route already handles notification preference updates -- verify it exists and extend the body schema to include `weekly_reports_enabled`.

Read `C:/PROJ/kova-website/app/api/v1/notifications/route.ts` to understand current schema, then extend it.

**Create Edge Function `weekly-report-sender`:**

Create `C:/PROJ/kova-website/supabase/functions/weekly-report-sender/index.ts`.

This function:

1. Runs on a cron schedule (configured in Supabase Dashboard as `0 8 * * 1` -- 8am UTC every Monday)
2. Queries `notification_preferences` where `weekly_reports_enabled = true`
3. For each opted-in user, queries `usage_daily_rollups` for the last 7 days
4. Computes: total spend, top tool, top model, % change vs previous week
5. Sends an HTML email via Resend with:
   - Subject: "Your AI dev costs this week -- [total]"
   - Body: clean table showing daily spend, tool breakdown, week-over-week comparison
   - CTA button linking to the user's dashboard
   - Unsubscribe link (sets `weekly_reports_enabled = false` via a signed URL or settings link)

Edge Function structure (Deno):

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
  for (const pref of prefs ?? []) {
    // 2. Query weekly rollup data
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: rollups } = await supabase
      .from("usage_daily_rollups")
      .select("date, tool, total_cost_usd")
      .eq("user_id", pref.user_id)
      .gte("date", since.toISOString().slice(0, 10));

    // 3. Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", pref.user_id)
      .single();

    if (!profile?.email || !rollups?.length) continue;

    // 4. Send via Resend
    const totalCost = rollups.reduce((s, r) => s + Number(r.total_cost_usd), 0);
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Kova <reports@kova.dev>",
        to: profile.email,
        subject: `Your AI dev costs this week — $${totalCost.toFixed(2)}`,
        html: buildWeeklyReportHtml(rollups, totalCost, pref.user_id),
      }),
    });
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Implement `buildWeeklyReportHtml()` as a pure function that returns a clean dark-branded HTML email string with an inline style table (no Tailwind -- email clients need inline styles).

### 7. PWA: Manifest + Icons + Service Worker

- **Task ID**: pwa-setup
- **Depends On**: i18n-extraction
- **Assigned To**: pwa-engineer
- **Agent Type**: frontend-specialist
- **Parallel**: false

Read these files:

- `C:/PROJ/kova-website/app/layout.tsx` (full -- this is where manifest link goes)
- `C:/PROJ/kova-website/public/wolf-logo.svg` (read to understand the logo vector for icon generation)
- `C:/PROJ/kova-website/next.config.mjs` (full)
- `C:/PROJ/kova-website/package.json` (to check if `next-pwa` is already installed)

**Create `public/manifest.json`:**

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
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
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

**Create PWA icons:**

The source logo is `public/wolf-logo.svg`. Create `public/icons/icon-192.png` and `public/icons/icon-512.png` as follows:

Since this is a Node.js environment, use the `sharp` package (already commonly available in Next.js projects) OR provide SVG-based icons and document that PNG conversion is a manual step. If `sharp` is not in package.json, create SVG icon files at `public/icons/icon-192.svg` and `public/icons/icon-512.svg` instead, and add a note in the manifest. Browsers accept SVG icons in manifest.json -- use `"type": "image/svg+xml"` if going the SVG route.

Check if `sharp` exists in package.json devDependencies. If not, use SVG icons.

**Update `app/layout.tsx` to link manifest:**

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

Also add to the `<head>` (via metadata API):

- `<meta name="mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`

**Service Worker:**

Do NOT add `next-pwa` as a new dependency unless it is already in `package.json`. Adding a new build dependency for a Phase 9 iteration is higher risk than benefit.

Instead, create a minimal `public/sw.js`:

```js
const CACHE_NAME = "kova-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icons/icon-192.svg"];

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
  // Network-first for API routes, cache-first for static assets
  if (event.request.url.includes("/api/")) {
    return; // Let network handle API calls
  }
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached ?? fetch(event.request)),
  );
});
```

Register the service worker in a new client component `components/PwaRegistrar.tsx` that calls `navigator.serviceWorker.register('/sw.js')` in a `useEffect`. Add `<PwaRegistrar />` to `app/layout.tsx` inside the body.

### 8. Final Validation

- **Task ID**: validate-phase9
- **Depends On**: db-migrations, dashboard-performance, realtime-usage, badge-embed-ui, i18n-extraction, weekly-reports, pwa-setup
- **Assigned To**: phase9-validator
- **Agent Type**: quality-engineer
- **Parallel**: false

Operate in read-only inspection mode. Do not modify any files.

**Validate database migrations:**

- [ ] `ls C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql` -- file exists
- [ ] `ls C:/PROJ/kova-website/supabase/migrations/010_performance_indexes.sql` -- file exists
- [ ] `grep "weekly_reports_enabled" C:/PROJ/kova-website/supabase/migrations/009_weekly_reports.sql` -- column exists in migration
- [ ] `grep "idx_usage_records_user_date\|idx_usage_daily_rollups_user_date" C:/PROJ/kova-website/supabase/migrations/010_performance_indexes.sql` -- both indexes present

**Validate performance refactor:**

- [ ] `grep "Promise.all" C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` -- parallel queries present
- [ ] `grep "unstable_cache" C:/PROJ/kova-website/app/dashboard/analytics/page.tsx` -- cache wrapping present
- [ ] `grep "revalidateTag" C:/PROJ/kova-website/app/api/v1/usage/route.ts` -- cache invalidation on sync

**Validate Realtime:**

- [ ] `ls C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx` -- file exists
- [ ] `grep "postgres_changes\|channel\|subscribe" C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx` -- Realtime subscription present
- [ ] `grep "RealtimeUsageProvider" C:/PROJ/kova-website/app/dashboard/usage/page.tsx` -- provider integrated in usage page

**Validate badge embed:**

- [ ] `ls C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx` -- file exists
- [ ] `grep "BadgeEmbedCard" C:/PROJ/kova-website/app/dashboard/settings/page.tsx` -- integrated in settings page
- [ ] `grep "kova.dev/api/badges" C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx` -- correct badge URL

**Validate i18n:**

- [ ] `ls C:/PROJ/kova-website/messages/fr.json` -- French translations file exists
- [ ] `grep "detect\|accept-language\|Accept-Language" C:/PROJ/kova-website/lib/i18n.ts` -- locale detection present (case insensitive)
- [ ] `grep "landing" C:/PROJ/kova-website/messages/en.json` -- landing namespace added
- [ ] `grep "getTranslations\|useTranslations" C:/PROJ/kova-website/app/page.tsx` -- translations used in homepage
- [ ] Check `messages/fr.json` has same top-level keys as `messages/en.json` -- run: `node -e "const en = require('./messages/en.json'); const fr = require('./messages/fr.json'); const enKeys = Object.keys(en).sort(); const frKeys = Object.keys(fr).sort(); console.log('EN namespaces:', enKeys.join(', ')); console.log('FR namespaces:', frKeys.join(', '));"` from `C:/PROJ/kova-website`

**Validate weekly reports:**

- [ ] `ls C:/PROJ/kova-website/supabase/functions/weekly-report-sender/index.ts` -- edge function exists
- [ ] `grep "weekly_reports_enabled" C:/PROJ/kova-website/components/dashboard/notification-settings.tsx` -- toggle in UI
- [ ] `grep "buildWeeklyReportHtml\|Resend\|resend" C:/PROJ/kova-website/supabase/functions/weekly-report-sender/index.ts` -- email sending logic present

**Validate PWA:**

- [ ] `ls C:/PROJ/kova-website/public/manifest.json` -- manifest exists
- [ ] `grep "manifest\|theme_color\|appleWebApp" C:/PROJ/kova-website/app/layout.tsx` -- PWA metadata in layout
- [ ] `ls C:/PROJ/kova-website/public/sw.js` -- service worker exists
- [ ] `grep "PwaRegistrar\|serviceWorker.register" C:/PROJ/kova-website/app/layout.tsx` -- SW registration wired

**Build validation:**

Run:

- `cd C:/PROJ/kova-website && pnpm build` -- Next.js builds without errors
- `cd C:/PROJ/kova-website && pnpm test` -- all existing tests still pass
- `cd C:/PROJ/kova-cli && npm run test` -- CLI tests unaffected (553 passing)

Report: PASS or FAIL with specific failures listed for each check.

## Acceptance Criteria

1. **Realtime**: After `kova sync` uploads a record, the `/dashboard/usage` page updates within 2 seconds without a page reload. The live status indicator (pulsing dot) is visible when the Realtime channel is SUBSCRIBED.

2. **i18n**: `messages/fr.json` exists with all namespaces matching `en.json`. The `lib/i18n.ts` detects `Accept-Language: fr` header and returns French strings. `app/page.tsx` uses `getTranslations()` instead of hardcoded English strings. The `<html lang>` attribute reflects the detected locale.

3. **PWA**: `public/manifest.json` exists with correct Kova branding (name, short_name, theme_color, start_url). The manifest is linked in `app/layout.tsx` metadata. `public/sw.js` exists with install/activate/fetch handlers. Chrome DevTools Lighthouse PWA audit scores installable.

4. **Weekly Reports**: `supabase/migrations/009_weekly_reports.sql` adds `weekly_reports_enabled boolean` column. The notification settings page has a "Weekly cost summary email" toggle. The Edge Function `weekly-report-sender/index.ts` exists with email send logic.

5. **Badge Embed**: `components/dashboard/badge-embed-card.tsx` exists with copy-to-clipboard functionality for Markdown, HTML, and URL formats. The component is rendered in `app/dashboard/settings/page.tsx`.

6. **Performance**: `app/dashboard/analytics/page.tsx` uses `Promise.all()` for independent Supabase queries. At least one rollup query is wrapped in `unstable_cache`. The v1 usage upload API route calls `revalidateTag`.

7. **DB Indexes**: Migration `010_performance_indexes.sql` contains `CREATE INDEX ... IF NOT EXISTS` for at minimum `usage_records(user_id, recorded_at)` and `usage_daily_rollups(user_id, date)`.

8. **Build health**: `pnpm build` in kova-website passes. All 149 existing website tests pass. All 553 CLI tests pass.

## Validation Commands

```bash
# Website build
cd C:/PROJ/kova-website && pnpm build

# Website tests
cd C:/PROJ/kova-website && pnpm test

# CLI tests (must remain unaffected)
cd C:/PROJ/kova-cli && npm test

# Verify realtime provider exists
ls C:/PROJ/kova-website/components/dashboard/realtime-usage-provider.tsx

# Verify FR translations exist and match EN keys at top level
node -e "
const en = Object.keys(require('./messages/en.json')).sort();
const fr = Object.keys(require('./messages/fr.json')).sort();
console.log('Match:', JSON.stringify(en) === JSON.stringify(fr));
console.log('EN:', en.join(', '));
console.log('FR:', fr.join(', '));
" 2>/dev/null || echo "Run from C:/PROJ/kova-website"

# Verify PWA manifest
cat C:/PROJ/kova-website/public/manifest.json | grep -E "name|start_url|theme_color"

# Verify DB migrations
ls C:/PROJ/kova-website/supabase/migrations/ | sort

# Verify badge embed component
grep "clipboard\|copy\|Copy" C:/PROJ/kova-website/components/dashboard/badge-embed-card.tsx

# Verify parallel queries
grep "Promise.all" C:/PROJ/kova-website/app/dashboard/analytics/page.tsx

# Verify cache invalidation on sync
grep "revalidateTag" C:/PROJ/kova-website/app/api/v1/usage/route.ts
```

## Notes

**On Realtime and RLS:**
Supabase Realtime respects Row Level Security policies. The `usage_records` table already has RLS enabled (from migration 003_security_hardening.sql). The client-side Realtime subscription uses the anon key and will only receive events for the authenticated user's rows -- this is secure by default. No additional RLS policy changes are needed.

**On `CREATE INDEX CONCURRENTLY` in migrations:**
Supabase CLI migrations run inside transactions by default, and `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Options: (1) Use `-- supabase-cli: no-transaction` pragma at top of migration file (supported in Supabase CLI v1.x+), or (2) Remove `CONCURRENTLY` keyword for migration safety. The `IF NOT EXISTS` guard ensures idempotency either way. Prefer option 2 (remove CONCURRENTLY) for migration simplicity -- the indexes are on tables likely to be small enough that non-concurrent creation is fast.

**On i18n scope:**
This plan intentionally scopes i18n to Accept-Language detection without URL path prefixing (no `/en/`, `/fr/` routes). URL-based locale switching is a Phase 10 item that requires significant routing restructuring. Accept-Language detection provides 80% of the value (search engines crawl in the request's locale, users see their language) at 10% of the cost.

**On PWA and Next.js App Router:**
Next.js 16 (used here) has native `manifest` support in the Metadata API, which is the correct approach. Do not use the `next-pwa` package for this -- it adds build complexity and is not maintained for Next.js 15+. The manual `sw.js` approach is simpler and more maintainable.

**On `unstable_cache` stability:**
Despite the `unstable_` prefix, `unstable_cache` is the official Next.js App Router caching API as of Next.js 14+ and is production-safe. The prefix indicates the API may change in future major versions, not that it is buggy.

**On the CLI (kova-cli):**
Phase 9 introduces no CLI changes. The post-launch iterations identified are all website/dashboard features. The CLI is stable at v1.0.0 and has 553 tests. The next CLI work should be triggered by user feedback (feature requests from npm download data and GitHub issues), not pre-planned.

**Priority if time-constrained:**
If build capacity is limited, execute in this priority order: (1) realtime-usage, (2) badge-embed-ui, (3) dashboard-performance + db-migrations, (4) weekly-reports, (5) i18n-extraction, (6) pwa-setup. The first two have the highest user delight per engineering hour.

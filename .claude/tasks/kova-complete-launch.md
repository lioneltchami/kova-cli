# Plan: Kova Complete Launch -- Dashboard, Payments, and CLI Integration

## Task Description

Build the complete Kova paid product: a Supabase-backed dashboard in the existing kova-website project with build analytics, token usage charts, and API key management; Polar.sh payment integration with webhook handlers; CLI commands (login, logout, account) that authenticate and upload build data; a pricing page; and npm publish preparation. This transforms Kova from a free CLI tool into a monetizable product with a cloud dashboard.

This is a complex, multi-project plan spanning C:/PROJ/kova-cli/ (CLI) and C:/PROJ/kova-website/ (website + dashboard). It is split into 9 phases executed sequentially with strict dependencies.

## Objective

Deliver: (1) a Supabase database schema with 5 tables + RLS policies + API key verification, (2) Supabase Auth with GitHub OAuth in the website, (3) a 5-page dashboard (overview, builds, build detail, analytics, settings) with shadcn charts, (4) API endpoints for CLI build upload and API key management, (5) Polar.sh webhook handler for subscriptions, (6) CLI login/logout/account commands with API key storage, (7) CLI build data upload after each build, (8) a pricing page with 4 tiers, (9) npm publish preparation. All 415 existing CLI tests must pass with 25+ new tests.

## Problem Statement

Kova CLI has 415 tests, 11 commands, a full website with documentation, but no way to generate revenue. The free CLI needs a cloud dashboard (the paid value) where developers can see build history, token analytics, and cost optimization. The CLI needs to authenticate and upload build data. Payments need to flow through Polar.sh to a subscriptions table. Without this, Kova remains a free tool with no business model.

## Solution Approach

**Database**: Supabase PostgreSQL on user's existing VPS. 5 tables: profiles, builds, build_tasks, subscriptions, api_keys (private schema). RLS policies for multi-tenant isolation. API key verification via bcrypt-hashed RPC function.

**Auth**: Supabase Auth with @supabase/ssr for Next.js 15 App Router. GitHub OAuth for developer login. Middleware protects /dashboard/\* routes. Server components use getUser() for validation.

**Dashboard**: 5 pages in app/dashboard/ using shadcn/ui charts (area, bar, donut) and shadcn table with server-side pagination. Reuse existing Kova dark theme tokens.

**API**: 4 endpoint groups at app/api/v1/: builds (POST/GET), subscription (GET), api-keys (POST/GET/DELETE), webhooks/polar (POST).

**CLI Integration**: New dashboard.ts module uploads CheckpointFile data after builds. API key stored in ~/.kova/credentials.json. Login opens browser for GitHub OAuth, receives API key from dashboard settings page.

**Payments**: Polar.sh with @polar-sh/nextjs. Webhook handler upserts to subscriptions table. Checkout creates session via API route.

## Relevant Files

### CLI: Existing Files to Modify (C:/PROJ/kova-cli/)

- `package.json` -- Add author, repository, homepage, bugs
- `src/index.ts` -- Register login, logout, account commands
- `src/types.ts` -- Add dashboard and license types
- `src/lib/completions.ts` -- Add login, logout, account to registry
- `src/commands/build.ts` -- Add dashboard upload after build completion
- `src/commands/team-build.ts` -- Same upload integration
- `src/lib/constants.ts` -- Add DASHBOARD_API_URL constant

### CLI: New Files to Create

- `.npmignore` -- Exclude tests/, .claude/, docs/
- `src/lib/dashboard.ts` -- Dashboard API client (upload builds, manage API key, check subscription)
- `src/commands/login.ts` -- kova login command
- `src/commands/logout.ts` -- kova logout command
- `src/commands/account.ts` -- kova account command
- `tests/dashboard.test.ts` -- Unit tests for dashboard module
- `tests/auth-commands.test.ts` -- Tests for login/logout/account

### Website: Existing Files to Modify (C:/PROJ/kova-website/)

- `package.json` -- Add @supabase/supabase-js, @supabase/ssr, @polar-sh/nextjs, recharts
- `components/landing/navbar.tsx` -- Add Pricing and Dashboard links
- `components/landing/footer.tsx` -- Add Pricing link
- `app/globals.css` -- Add chart color tokens

### Website: New Files to Create

- `utils/supabase/client.ts` -- Browser Supabase client
- `utils/supabase/server.ts` -- Server Supabase client
- `utils/supabase/middleware.ts` -- Auth token refresh
- `middleware.ts` -- Route protection for /dashboard/\*
- `app/login/page.tsx` -- Login page with GitHub OAuth
- `app/auth/callback/route.ts` -- OAuth callback handler
- `app/dashboard/layout.tsx` -- Dashboard layout with sidebar
- `app/dashboard/page.tsx` -- Overview with KPI cards + charts
- `app/dashboard/builds/page.tsx` -- Build history table
- `app/dashboard/builds/[id]/page.tsx` -- Build detail view
- `app/dashboard/analytics/page.tsx` -- Token usage charts
- `app/dashboard/settings/page.tsx` -- API key management + account
- `app/pricing/page.tsx` -- Pricing page (4 tiers)
- `app/api/v1/builds/route.ts` -- Build data ingestion + listing
- `app/api/v1/api-keys/route.ts` -- API key CRUD
- `app/api/v1/subscription/route.ts` -- Subscription status check
- `app/api/webhooks/polar/route.ts` -- Polar webhook handler
- `app/api/polar/checkout/route.ts` -- Create checkout session
- `supabase/migrations/001_kova_schema.sql` -- Full database schema
- `lib/dashboard-utils.ts` -- Shared dashboard helpers (format dates, numbers)
- `components/dashboard/sidebar.tsx` -- Dashboard sidebar nav
- `components/dashboard/kpi-card.tsx` -- KPI metric card
- `components/dashboard/build-row.tsx` -- Build table row
- `.env.example` -- Environment variable template

## Implementation Phases

### Phase 1: Foundation (Tasks 1-3)

CLI publish prep (package.json, .npmignore, types). Database schema SQL. Website dependency installation.

### Phase 2: Auth (Tasks 4-5)

Supabase Auth utilities, middleware, login page, OAuth callback.

### Phase 3: API Endpoints (Tasks 6-7)

Build ingestion, API key management, subscription check, Polar webhook handler.

### Phase 4: Dashboard Pages (Tasks 8-10)

Dashboard layout + sidebar, overview page, builds table, build detail, analytics, settings.

### Phase 5: Pricing (Task 11)

Pricing page with 4 tiers, checkout integration, navbar/footer links.

### Phase 6: CLI Integration (Tasks 12-13)

Dashboard module, login/logout/account commands, build upload integration.

### Phase 7: Testing (Task 14)

CLI tests for dashboard module and auth commands.

### Phase 8: Validation (Task 15)

Full validation of both projects.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-cli-prep
  - Role: CLI publish prep (package.json, .npmignore, types) and later CLI dashboard integration (login/logout/account, build upload)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-database
  - Role: Write the complete SQL migration file with all tables, RLS policies, indexes, and RPC functions
  - Agent Type: supabase-specialist
  - Resume: false

- Specialist
  - Name: builder-auth
  - Role: Set up Supabase Auth in the website: install deps, create utility files, middleware, login page, OAuth callback
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-api
  - Role: Build all API endpoints: builds, api-keys, subscription, Polar webhook, checkout
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-dashboard
  - Role: Build dashboard layout, sidebar, and all 5 dashboard pages with charts and tables
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: builder-pricing
  - Role: Build the pricing page and update navbar/footer links
  - Agent Type: frontend-specialist
  - Resume: false

- Specialist
  - Name: builder-tests
  - Role: Write CLI tests for dashboard module and auth commands
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. CLI Publish Preparation

- **Task ID**: cli-prep
- **Depends On**: none
- **Assigned To**: builder-cli-prep
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/package.json, C:/PROJ/kova-cli/src/types.ts
- Update package.json: add `"author": "Lionel Tchami"`, `"repository": { "type": "git", "url": "https://github.com/lioneltchami/kova-cli.git" }`, `"homepage": "https://github.com/lioneltchami/kova-cli#readme"`, `"bugs": { "url": "https://github.com/lioneltchami/kova-cli/issues" }`
- Create C:/PROJ/kova-cli/.npmignore:
  ```
  tests/
  .claude/
  docs/
  *.test.ts
  vitest.config.ts
  tsup.config.ts
  tsconfig.json
  .gitignore
  build.log
  ```
- Add types to src/types.ts (append at end):

  ```typescript
  // Dashboard and authentication types
  export interface DashboardCredentials {
    apiKey: string;
    dashboardUrl: string;
    userId: string;
    email: string;
    plan: "free" | "pro" | "team" | "enterprise";
    cachedAt: string;
  }

  export interface BuildUploadPayload {
    project_name: string;
    cli_version: string;
    plan_name: string;
    started_at: string;
    finished_at: string;
    duration_ms: number;
    status: "success" | "failed";
    exit_code: number;
    os: string;
    node_version: string;
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
    model_used: string;
    tasks: Array<{
      task_name: string;
      status: string;
      agent_type: string | null;
      model: string | null;
      duration_ms: number | null;
      tokens_input: number;
      tokens_output: number;
      cost_usd: number;
    }>;
  }
  ```

- Add DASHBOARD_API_URL to src/lib/constants.ts: `export const DASHBOARD_API_URL = "https://kova.dev/api/v1";`
- Run `cd C:/PROJ/kova-cli && npm run build && npm pack --dry-run` to verify .npmignore works
- Run `npm test` to verify 415 tests pass

### 2. Database Schema Migration

- **Task ID**: database-schema
- **Depends On**: none
- **Assigned To**: builder-database
- **Agent Type**: supabase-specialist
- **Model**: sonnet
- **Parallel**: true (can run alongside task 1)
- Create directory: `C:/PROJ/kova-website/supabase/migrations/`
- Create `C:/PROJ/kova-website/supabase/migrations/001_kova_schema.sql` with the COMPLETE schema:

```sql
-- Kova Dashboard Schema
-- Run this against your Supabase PostgreSQL instance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Builds (core fact table)
CREATE TABLE IF NOT EXISTS public.builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  cli_version TEXT NOT NULL DEFAULT '0.1.0',
  plan_name TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  exit_code INTEGER,
  error_message TEXT,
  os TEXT,
  node_version TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_builds" ON public.builds FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_builds_user_created ON public.builds(user_id, created_at DESC);
CREATE INDEX idx_builds_user_status ON public.builds(user_id, status);

-- 3. Build Tasks (per-task breakdown)
CREATE TABLE IF NOT EXISTS public.build_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  agent_type TEXT,
  model TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.build_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_build_tasks" ON public.build_tasks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_build_tasks_build ON public.build_tasks(build_id);

-- 4. Subscriptions (synced from Polar.sh webhooks)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'revoked')),
  product_name TEXT NOT NULL DEFAULT 'Pro',
  billing_interval TEXT NOT NULL DEFAULT 'month',
  price_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  polar_customer_id TEXT,
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (user_id, subscription_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_subs" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 5. API Keys (private schema for CLI authentication)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'CLI Key',
  key_prefix VARCHAR(8) NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON private.api_keys(key_prefix) WHERE is_active = TRUE;

-- API Key verification function (called by service_role from API routes)
CREATE OR REPLACE FUNCTION private.verify_api_key(p_key TEXT)
RETURNS TABLE(valid BOOLEAN, account_id UUID, account_email TEXT, account_plan TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_record private.api_keys%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  v_prefix := LEFT(p_key, 8);

  SELECT * INTO v_record FROM private.api_keys
  WHERE key_prefix = v_prefix AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF crypt(p_key, v_record.key_hash) = v_record.key_hash THEN
    UPDATE private.api_keys SET last_used_at = NOW() WHERE id = v_record.id;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_record.user_id;
    RETURN QUERY SELECT TRUE, v_record.user_id, v_profile.email, v_profile.plan;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;

-- Helper: create API key (returns the plaintext key only once)
CREATE OR REPLACE FUNCTION private.create_api_key(p_user_id UUID, p_name TEXT DEFAULT 'CLI Key')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_hash TEXT;
BEGIN
  v_key := 'kova_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := LEFT(v_key, 8);
  v_hash := crypt(v_key, gen_salt('bf', 12));

  INSERT INTO private.api_keys (user_id, name, key_prefix, key_hash)
  VALUES (p_user_id, p_name, v_prefix, v_hash);

  RETURN v_key;
END;
$$;

-- Helper: get user_id by email (for Polar webhook matching)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(input_email TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE email = input_email LIMIT 1;
$$;

-- Daily stats materialized view (for analytics performance)
CREATE TABLE IF NOT EXISTS public.build_daily_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  total_builds INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost_usd NUMERIC(12, 6) DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.build_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_stats" ON public.build_daily_stats FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_daily_stats_user ON public.build_daily_stats(user_id, date DESC);
```

- Also create C:/PROJ/kova-website/.env.example:

  ```
  # Supabase (your self-hosted instance)
  NEXT_PUBLIC_SUPABASE_URL=https://your-supabase.example.com
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

  # Polar.sh (payments)
  POLAR_ACCESS_TOKEN=your-polar-access-token
  POLAR_WEBHOOK_SECRET=your-polar-webhook-secret
  POLAR_ORG_ID=your-polar-org-id

  # App
  NEXT_PUBLIC_APP_URL=https://kova.dev

  # GitHub OAuth (configured in Supabase dashboard)
  # No env vars needed -- configured in Supabase Auth settings
  ```

### 3. Install Website Dependencies

- **Task ID**: install-website-deps
- **Depends On**: none
- **Assigned To**: builder-auth
- **Agent Type**: backend-engineer
- **Model**: haiku
- **Parallel**: true (can run alongside tasks 1-2)
- Run:
  ```bash
  cd C:/PROJ/kova-website
  pnpm add @supabase/supabase-js @supabase/ssr
  pnpm add @polar-sh/nextjs
  pnpm add recharts
  pnpm add date-fns
  ```
- Run `pnpm build` to verify no conflicts

### 4. Set Up Supabase Auth Utilities

- **Task ID**: setup-auth
- **Depends On**: install-website-deps
- **Assigned To**: builder-auth
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-website/app/layout.tsx, C:/PROJ/kova-website/app/globals.css
- Create `C:/PROJ/kova-website/utils/supabase/client.ts` -- browser client using createBrowserClient
- Create `C:/PROJ/kova-website/utils/supabase/server.ts` -- server client using createServerClient with cookies (async cookies() in Next.js 15)
- Create `C:/PROJ/kova-website/utils/supabase/middleware.ts` -- updateSession helper that refreshes tokens and validates with getUser()
- Create `C:/PROJ/kova-website/middleware.ts` -- protect /dashboard/\* routes, redirect unauthenticated to /login, redirect authenticated on /login to /dashboard
- Create `C:/PROJ/kova-website/app/auth/callback/route.ts` -- OAuth callback that exchanges code for session
- Create `C:/PROJ/kova-website/app/login/page.tsx` -- dark-themed login page with "Continue with GitHub" button, Kova branding, redirect to dashboard on success
- Run `pnpm build` to verify

### 5. Build API Endpoints

- **Task ID**: build-api-endpoints
- **Depends On**: setup-auth
- **Assigned To**: builder-api
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-website/utils/supabase/server.ts for server client pattern
- Read C:/PROJ/kova-cli/src/types.ts for BuildUploadPayload, CheckpointFile types

**Create app/api/v1/builds/route.ts**:

- POST: Authenticate via Bearer API key header (call verify_api_key RPC with service role client), insert into builds table + build_tasks table, return { build_id }
- GET: Authenticate via session (server client with cookies), query builds for current user with pagination (page, limit query params), return builds array + total count

**Create app/api/v1/api-keys/route.ts**:

- POST: Authenticate via session, call create_api_key RPC, return { key } (plaintext, shown only once)
- GET: Authenticate via session, query private.api_keys for current user (only return id, name, key_prefix, is_active, last_used_at, created_at -- never return hash)
- DELETE: Authenticate via session, set is_active=false on the key (soft delete)

**Create app/api/v1/subscription/route.ts**:

- GET: Authenticate via Bearer API key OR session. Query subscriptions table for active subscription. Return { plan, active, ends_at }

**Create app/api/webhooks/polar/route.ts**:

- Use @polar-sh/nextjs Webhooks handler
- Handle onSubscriptionCreated, onSubscriptionUpdated, onSubscriptionCanceled, onSubscriptionRevoked
- Resolve user by email via get_user_id_by_email RPC
- Upsert to subscriptions table
- Update profiles.plan field to match subscription product

**Create app/api/polar/checkout/route.ts**:

- GET: Authenticate via session, get user email, create Polar checkout session with customer_email and metadata[supabase_user_id], redirect to Polar hosted checkout

- Run `pnpm build` to verify all API routes compile

### 6. Build Dashboard Layout and Sidebar

- **Task ID**: build-dashboard-layout
- **Depends On**: setup-auth
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: true (can run alongside task 5)
- Read C:/PROJ/kova-website/app/layout.tsx for root layout pattern
- Read C:/PROJ/kova-website/app/docs/layout.tsx for how Fumadocs uses a separate layout
- Read C:/PROJ/kova-website/components/landing/wolf-logo.tsx for the wolf component

**Create components/dashboard/sidebar.tsx**:

- Dark sidebar (bg-kova-surface, border-r border-kova-border)
- Wolf logo + "KOVA" at top
- Nav links: Overview (/dashboard), Builds (/dashboard/builds), Analytics (/dashboard/analytics), Settings (/dashboard/settings)
- Active link highlight with kova-blue
- User email + plan badge at bottom
- Collapse to icons on mobile

**Create components/dashboard/kpi-card.tsx**:

- Card with: label (dim text), value (large bold), delta (green/red change indicator)
- Dark card style (bg-kova-surface, border-kova-border, rounded)
- Uses animated-number for value display

**Create lib/dashboard-utils.ts**:

- `formatDuration(ms: number): string` -- "2m 18s", "47s"
- `formatTokens(n: number): string` -- "12.4K", "1.2M"
- `formatCost(usd: number): string` -- "$0.42", "$12.80"
- `formatRelativeDate(date: string): string` -- "2 hours ago", "3 days ago"
- `getStatusColor(status: string): string` -- green for success, red for failed, blue for running

**Create app/dashboard/layout.tsx**:

- Server component that checks auth (getUser), redirects to /login if not authenticated
- Wraps children in sidebar layout
- Fetches user profile and subscription for sidebar display
- Does NOT use Fumadocs -- entirely custom layout

- Run `pnpm build`

### 7. Build Dashboard Overview Page

- **Task ID**: build-dashboard-overview
- **Depends On**: build-dashboard-layout
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-website/utils/supabase/server.ts for data fetching pattern

**Create app/dashboard/page.tsx**:
Server component that fetches:

- Total builds this month (count)
- Success rate (completed / total \* 100)
- Total tokens this month (sum)
- Total cost this month (sum cost_usd)
- Last 10 builds for recent activity table
- Builds per day for last 30 days (for area chart)

Layout:

- Row 1: 4 KPI cards (builds, success rate, tokens, cost)
- Row 2: Area chart showing builds per day (success vs failed stacked)
- Row 3: Recent builds table (last 10, with status, plan name, duration, cost, timestamp)

Use shadcn chart for the area chart. If shadcn charts are not installed, install them first:

```bash
pnpm dlx shadcn@latest add chart
```

Note: shadcn charts may not be available via the standard registry for this Next.js version. If install fails, use recharts directly with Kova theme colors.

Use Kova dark theme throughout (bg-kova-charcoal page bg, bg-kova-surface cards).

### 8. Build Builds History and Detail Pages

- **Task ID**: build-builds-pages
- **Depends On**: build-dashboard-overview
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false

**Create app/dashboard/builds/page.tsx**:

- Server component with URL-based pagination (searchParams: page, status, sort)
- Query builds for current user with pagination (25 per page)
- Table columns: Status (icon), Plan Name, Duration, Tokens, Cost, Date
- Status filter dropdown (all, success, failed)
- Sort by date (default), duration, cost
- Pagination controls at bottom
- Each row links to /dashboard/builds/[id]

**Create app/dashboard/builds/[id]/page.tsx**:

- Server component that fetches single build + its build_tasks
- Header: build status, plan name, started/finished timestamps, total duration
- Task breakdown table: task name, agent type, model, status, duration, tokens, cost
- Token usage summary card: total input, output, combined, cost
- Model distribution (if multiple models used)

### 9. Build Analytics Page

- **Task ID**: build-analytics-page
- **Depends On**: build-builds-pages
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false

**Create app/dashboard/analytics/page.tsx**:

- Server component fetching aggregated data for last 30 days
- Row 1: Token usage over time (line chart, input vs output)
- Row 2: Cost per day (bar chart)
- Row 3: Model distribution (donut chart -- haiku vs sonnet vs opus)
- Row 4: Success rate trend (line chart)
- All charts use Kova palette: blue (#4361EE) for primary, silver (#C0C0C8) for secondary

### 10. Build Settings Page

- **Task ID**: build-settings-page
- **Depends On**: build-dashboard-layout
- **Assigned To**: builder-dashboard
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 7-9)

**Create app/dashboard/settings/page.tsx**:

- Server component that fetches user profile + API keys + subscription

**Account section**:

- Display email, username, avatar (from GitHub)
- Current plan badge (Free/Pro/Team)
- If free: "Upgrade to Pro" CTA linking to /pricing
- If paid: subscription status, renewal date, Polar customer portal link

**API Keys section**:

- List existing keys (name, prefix "kova_xxx...", last used, created)
- "Create New Key" button -> calls POST /api/v1/api-keys -> shows key ONCE in a modal with copy button
- "Revoke" button on each key -> calls DELETE /api/v1/api-keys

**CLI Setup Instructions**:

```
1. Copy your API key above
2. Run: kova login
3. Paste your API key when prompted
4. Done! Builds will now sync to your dashboard.
```

### 11. Build Pricing Page

- **Task ID**: build-pricing-page
- **Depends On**: install-website-deps
- **Assigned To**: builder-pricing
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 4-10)

**Create app/pricing/page.tsx**:

- 4 tier cards in a row (responsive: 1 col mobile, 2 col tablet, 4 col desktop)
- Monthly/annual toggle (annual = 20% discount)

Tiers:

- **Free** ($0): All 11 CLI commands, 6 templates, GitHub integration, shell completions, interactive mode, local build history. CTA: "Get Started" -> /docs/getting-started/installation
- **Pro** ($29/mo, $23/mo annual -- "Most Popular" badge): Everything in Free + cloud build history, token analytics dashboard, cost optimization suggestions, unlimited webhooks, email support. CTA: "Subscribe" -> /api/polar/checkout?product=pro_monthly (or pro_annual)
- **Team** ($99/mo, $79/mo annual): Everything in Pro + shared team plans, approval workflows, centralized config, 5 seats. CTA: "Subscribe" -> /api/polar/checkout?product=team_monthly
- **Enterprise** ($299/mo): Everything in Team + SSO/SAML, audit logs, custom agents, unlimited seats, dedicated support. CTA: "Contact Us" -> mailto:hello@kova.dev

Style: Dark cards (bg-kova-surface), blue glowing border on Pro card, check marks for features, gradient heading "Simple, Transparent Pricing".

**Update navbar.tsx**: Add "Pricing" link between Docs and GitHub (both desktop and mobile menu)
**Update footer.tsx**: Add { label: "Pricing", href: "/pricing" } to Product links

- Run `pnpm build`

### 12. CLI Dashboard Module

- **Task ID**: cli-dashboard-module
- **Depends On**: cli-prep, build-api-endpoints
- **Assigned To**: builder-cli-prep
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false

**Create src/lib/dashboard.ts**:

```typescript
import fs from "fs";
import os from "os";
import path from "path";
import * as logger from "./logger.js";
import { DASHBOARD_API_URL, VERSION } from "./constants.js";
import type {
  BuildUploadPayload,
  DashboardCredentials,
  CheckpointFile,
} from "../types.js";

export function getCredentialsPath(): string {
  return path.join(os.homedir(), ".kova", "credentials.json");
}

export function storeCredentials(creds: DashboardCredentials): void {
  const dir = path.dirname(getCredentialsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getCredentialsPath(),
    JSON.stringify(creds, null, 2),
    "utf-8",
  );
}

export function readCredentials(): DashboardCredentials | null {
  try {
    return JSON.parse(
      fs.readFileSync(getCredentialsPath(), "utf-8"),
    ) as DashboardCredentials;
  } catch {
    return null;
  }
}

export function removeCredentials(): void {
  try {
    fs.unlinkSync(getCredentialsPath());
  } catch {
    /* ok */
  }
}

export function isLoggedIn(): boolean {
  return readCredentials() !== null;
}

export async function uploadBuild(
  checkpoint: CheckpointFile,
  projectName: string,
): Promise<boolean> {
  const creds = readCredentials();
  if (!creds?.apiKey) return false;

  const taskEntries = Object.entries(checkpoint.tasks);
  const completed = taskEntries.filter(
    ([, t]) => t.status === "completed",
  ).length;
  const failed = taskEntries.filter(([, t]) => t.status === "failed").length;
  const startMs = new Date(checkpoint.started_at).getTime();
  const durationMs = Date.now() - startMs;

  const payload: BuildUploadPayload = {
    project_name: projectName,
    cli_version: VERSION,
    plan_name: path.basename(checkpoint.plan, ".md"),
    started_at: checkpoint.started_at,
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    status: checkpoint.status === "completed" ? "success" : "failed",
    exit_code: checkpoint.status === "completed" ? 0 : 1,
    os: process.platform,
    node_version: process.version,
    tokens_input: checkpoint.token_usage?.total_input ?? 0,
    tokens_output: checkpoint.token_usage?.total_output ?? 0,
    cost_usd: checkpoint.token_usage?.cost_estimate_usd ?? 0,
    model_used:
      Object.keys(checkpoint.token_usage?.per_task ?? {}).length > 0
        ? "mixed"
        : "unknown",
    tasks: taskEntries.map(([name, task]) => ({
      task_name: name,
      status:
        task.status === "completed"
          ? "success"
          : task.status === "failed"
            ? "failed"
            : "skipped",
      agent_type: task.agent_type,
      model: task.model,
      duration_ms: task.duration_s ? task.duration_s * 1000 : null,
      tokens_input: task.tokens?.input ?? 0,
      tokens_output: task.tokens?.output ?? 0,
      cost_usd: 0, // calculated server-side
    })),
  };

  try {
    const response = await fetch(`${creds.dashboardUrl}/api/v1/builds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    logger.debug("Dashboard upload failed (non-blocking).");
    return false;
  }
}

export async function checkSubscription(): Promise<{
  plan: string;
  active: boolean;
} | null> {
  const creds = readCredentials();
  if (!creds?.apiKey) return null;

  try {
    const response = await fetch(`${creds.dashboardUrl}/api/v1/subscription`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as { plan: string; active: boolean };
  } catch {
    return null;
  }
}
```

### 13. CLI Login, Logout, Account Commands

- **Task ID**: cli-auth-commands
- **Depends On**: cli-dashboard-module
- **Assigned To**: builder-cli-prep
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false

**Create src/commands/login.ts**:

- Prompt user for API key (or accept as argument)
- Validate by calling GET /api/v1/subscription with the key
- If valid, store credentials (key, url, plan info)
- Print success with plan info

**Create src/commands/logout.ts**:

- Remove credentials file
- Print confirmation

**Create src/commands/account.ts**:

- Read credentials, display plan/email/API key prefix
- If not logged in, show "Free" plan and upgrade link

**Update src/index.ts**: Register login, logout, account commands (same pattern as existing commands)

**Update src/lib/completions.ts**: Add login, logout, account to command registry

**Update src/commands/build.ts**: After build completes, call `uploadBuild(checkpoint, projectName)` non-blockingly (fire-and-forget, never delays the user):

```typescript
import { uploadBuild, isLoggedIn } from "../lib/dashboard.js";
// After displayBuildSummary and notifications:
if (isLoggedIn()) {
  void uploadBuild(checkpoint, path.basename(process.cwd()));
}
```

Do the same in team-build.ts.

- Run `npm run build && npm test` to verify 415 tests pass
- Verify: `node bin/kova.js login --help`, `logout --help`, `account --help`

### 14. Write CLI Tests

- **Task ID**: write-cli-tests
- **Depends On**: cli-auth-commands
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false

**Write tests/dashboard.test.ts** (15+ tests):

- getCredentialsPath() returns path with ".kova" and "credentials.json"
- storeCredentials() + readCredentials() roundtrip
- removeCredentials() deletes file
- removeCredentials() does not throw if missing
- isLoggedIn() returns false when no credentials
- isLoggedIn() returns true when credentials stored
- uploadBuild() returns false when no credentials
- uploadBuild() with mocked fetch returns true on 200
- uploadBuild() returns false on network error (mock fetch to throw)
- uploadBuild() sends correct payload shape (verify fetch was called with right body)
- checkSubscription() returns null when no credentials
- checkSubscription() with mocked fetch returns plan data

**Write tests/auth-commands.test.ts** (10+ tests):

- Completions registry includes login, logout, account
- storeCredentials + readCredentials + removeCredentials full cycle with temp dirs
- BuildUploadPayload type matches expected shape (construct one, verify fields)

- Run `npm test` -- ALL tests must pass (415 + new)
- Run `npm test` again for flaky check

### 15. Final Validation

- **Task ID**: validate-all
- **Depends On**: cli-prep, database-schema, setup-auth, build-api-endpoints, build-dashboard-layout, build-dashboard-overview, build-builds-pages, build-analytics-page, build-settings-page, build-pricing-page, cli-dashboard-module, cli-auth-commands, write-cli-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files

## Acceptance Criteria

1. All 415 existing CLI tests continue to pass
2. 25+ new CLI tests added and passing
3. `npm run build` compiles cleanly (CLI)
4. `pnpm build` compiles cleanly (website)
5. CLI package.json has repository, homepage, bugs, author
6. .npmignore excludes tests/ and .claude/
7. `npm pack --dry-run` is clean
8. SQL migration file exists with 5 tables + RLS + indexes + functions
9. Supabase Auth utilities exist (client.ts, server.ts, middleware.ts)
10. Middleware protects /dashboard/\* routes
11. Login page exists with GitHub OAuth
12. OAuth callback route exists
13. POST /api/v1/builds endpoint exists and accepts BuildUploadPayload
14. GET /api/v1/builds endpoint exists with pagination
15. API key CRUD endpoints exist (create, list, revoke)
16. Polar webhook handler exists
17. Dashboard layout with sidebar exists
18. Dashboard overview page with KPI cards exists
19. Builds history page with table exists
20. Build detail page with task breakdown exists
21. Analytics page with charts exists
22. Settings page with API key management exists
23. Pricing page with 4 tiers exists
24. `kova login --help` works
25. `kova logout --help` works
26. `kova account --help` works
27. Build upload is non-blocking (fire-and-forget in build.ts)
28. No TypeScript `any` types in new CLI code
29. Navbar has Pricing and Dashboard links
30. .env.example exists with all required env vars

## Validation Commands

- `cd C:/PROJ/kova-cli && npm run build`
- `npm run lint`
- `npm test`
- `npm test` (second run)
- `node bin/kova.js --help` (lists login, logout, account)
- `node bin/kova.js login --help`
- `npm pack --dry-run` (no tests/)
- `cd C:/PROJ/kova-website && pnpm build`
- `ls app/dashboard/` (should list page.tsx, builds/, analytics/, settings/, layout.tsx)
- `ls app/api/v1/` (should list builds/, api-keys/, subscription/)
- `ls app/pricing/` (should list page.tsx)
- `cat supabase/migrations/001_kova_schema.sql | head -5` (should exist)

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- CLI project: C:/PROJ/kova-cli/
- Website project: C:/PROJ/kova-website/
- The user has a self-hosted Supabase on a VPS. The SQL migration is saved as a file for the user to run manually against their instance. We do NOT run it automatically.
- All Polar product IDs and webhook secrets are PLACEHOLDERS. The user will configure these after creating products on Polar.sh.
- The DASHBOARD_API_URL defaults to "https://kova.dev/api/v1" but can be overridden. In development, the CLI would point to localhost.
- Dashboard upload from the CLI is ALWAYS non-blocking. Use `void uploadBuild(...)` with fire-and-forget. Never slow down the user's terminal.
- The pricing page checkout buttons use placeholder Polar URLs. Once Polar products are created, the checkout route will create real sessions.
- API keys use bcrypt (pgcrypto extension) for hashing. The plaintext key is shown ONCE at creation and never stored.
- Charts: Try shadcn charts first. If install fails (version compatibility), fall back to recharts directly with Kova theme colors.
- The dashboard does NOT need Fumadocs. It has its own layout.tsx independent from docs.
- Tasks 1, 2, 3 are parallel (no dependencies between them). Tasks 6 and 11 can also run in parallel since they touch different files.

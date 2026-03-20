-- =============================================================================
-- Kova FinOps Dashboard -- Supabase PostgreSQL Schema
-- Migration: 001_kova_finops_schema.sql
--
-- Architecture decisions documented inline.
-- Run against your Supabase instance via the SQL editor or psql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- bcrypt for API keys, gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- query performance monitoring


-- ---------------------------------------------------------------------------
-- SCHEMA: private
-- Holds security-sensitive tables that should NEVER be exposed via the
-- Supabase auto-generated REST API or client libraries.
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;


-- =============================================================================
-- SECTION 1: TEAMS AND MEMBERSHIP
-- =============================================================================

-- ---------------------------------------------------------------------------
-- teams
-- One row per customer organization. The "unit of billing" for Pro/Enterprise.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,        -- URL-safe identifier, e.g. "acme-corp"
  plan          TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'enterprise')),
  seat_count    INTEGER     NOT NULL DEFAULT 1,     -- purchased seats (from Polar.sh)
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up teams by owner (dashboard home page query)
CREATE INDEX idx_teams_owner ON public.teams(owner_id);

-- Enforce lowercase alphanumeric slugs with hyphens only
ALTER TABLE public.teams ADD CONSTRAINT teams_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$');

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- team_members
-- Many-to-many between auth.users and teams.
-- A user can belong to multiple teams (personal + work org, etc.).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id       UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('owner', 'admin', 'member')),
  invited_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,                        -- NULL until invitation accepted
  PRIMARY KEY (team_id, user_id)
);

-- Primary access pattern: "what teams does this user belong to?" (RLS hot path)
CREATE INDEX idx_team_members_user ON public.team_members(user_id) WHERE accepted_at IS NOT NULL;
-- Secondary: "who are the members of this team?" (team admin page)
CREATE INDEX idx_team_members_team ON public.team_members(team_id) WHERE accepted_at IS NOT NULL;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- profiles
-- Public user metadata, extends auth.users.
-- Auto-created via trigger on auth.users INSERT.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Auto-create profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'user_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SECTION 2: USAGE RECORDS (core fact table)
--
-- This is the highest-volume table. Design decisions:
--
-- PARTITIONING STRATEGY: Monthly range partitioning by recorded_at.
--   Rationale:
--   - A 50-dev team generates ~10,000+ records/month. Over 2 years that is
--     240,000+ rows. Without partitioning, single-table scans grow linearly.
--   - Monthly partitions enable: (a) instant DROP TABLE for data retention
--     (b) partition pruning eliminates irrelevant months from aggregation
--     queries -- the most common dashboard access pattern is "this month"
--   - PostgreSQL 14+ partition pruning fires at both plan-time and run-time,
--     so queries with recorded_at >= '2026-01-01' scan only Jan 2026 partition.
--   - RLS policies apply to the parent table and are inherited by all partitions.
--
-- WHY NOT PARTITION BY TEAM_ID (list/hash)?
--   - Teams grow dynamically; adding a new team would require DDL.
--   - The time dimension is more universally useful for query pruning.
--   - Cross-team aggregation (admin analytics) would require scanning all
--     hash partitions anyway.
--
-- INDEXES:
--   - Primary: (team_id, recorded_at DESC) -- the dashboard "what did my team
--     spend this month?" query runs this composite index exclusively.
--   - Secondary: (team_id, tool, recorded_at DESC) -- tool comparison page.
--   - Tertiary: (team_id, developer_id, recorded_at DESC) -- per-dev breakdown.
--   - Project: (team_id, project) -- project attribution view.
--   - Note: Indexes created on the PARENT table propagate to all partitions
--     automatically in PostgreSQL 11+.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usage_records (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  team_id         UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  developer_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- AI tool and model identifiers (matches CLI TypeScript types exactly)
  tool            TEXT        NOT NULL
                              CHECK (tool IN ('claude_code', 'cursor', 'copilot', 'devin', 'windsurf')),
  model           TEXT        NOT NULL DEFAULT 'unknown',
                              -- Values: haiku, sonnet, opus, gpt-4o, gpt-4o-mini, gpt-4.1,
                              --         gpt-5, gpt-5-mini, o1, o3, gemini-pro, gemini-flash,
                              --         swe-1.5, swe-1.5-fast, unknown

  -- Session context
  session_id      TEXT        NOT NULL,              -- Tool-native session identifier
  project         TEXT,                              -- Project folder name (not full path, privacy)

  -- Token counts
  input_tokens    INTEGER     NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens   INTEGER     NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_read_tokens   INTEGER NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),   -- Cursor/Claude cache
  cache_write_tokens  INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),

  -- Cost (stored in USD with 6 decimal places for sub-cent precision)
  cost_usd        NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),

  -- Timing
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Partition key: when CLI recorded this
  occurred_at     TIMESTAMPTZ NOT NULL,                 -- When the actual AI request happened

  -- Optional duration (some tools provide this, others don't)
  duration_ms     INTEGER     CHECK (duration_ms >= 0),

  -- Extensible metadata bag (tool-specific fields, upload source, etc.)
  -- Keys stored here by convention: cli_version, upload_source, devin_acu_count
  metadata        JSONB       NOT NULL DEFAULT '{}',

  -- Deduplication: hash of (tool + session_id + occurred_at + developer_id)
  -- Prevents re-uploading the same record from multiple CLI runs.
  record_hash     TEXT        NOT NULL,

  -- Partition key MUST be part of primary key for partitioned tables
  PRIMARY KEY (id, recorded_at)

) PARTITION BY RANGE (recorded_at);


-- Unique constraint on record_hash to enforce deduplication per partition.
-- Note: Cannot create UNIQUE across all partitions without including partition key.
-- The combination (record_hash, recorded_at) is unique per-partition.
-- Application-level: generate hash = SHA256(tool || session_id || occurred_at::text || developer_id)
CREATE UNIQUE INDEX idx_usage_records_dedup
  ON public.usage_records(record_hash, recorded_at);

-- Primary dashboard query: "what did team X spend in date range?"
CREATE INDEX idx_usage_team_time
  ON public.usage_records(team_id, recorded_at DESC);

-- Tool comparison: "Claude Code vs Cursor this month for team X"
CREATE INDEX idx_usage_team_tool_time
  ON public.usage_records(team_id, tool, recorded_at DESC);

-- Developer breakdown: "what did Alice spend this month?"
CREATE INDEX idx_usage_team_developer_time
  ON public.usage_records(team_id, developer_id, recorded_at DESC);

-- Project attribution: "what did project 'kova-cli' cost?"
CREATE INDEX idx_usage_team_project
  ON public.usage_records(team_id, project, recorded_at DESC)
  WHERE project IS NOT NULL;

-- Model filtering: "show all GPT-4o usage this month"
CREATE INDEX idx_usage_team_model
  ON public.usage_records(team_id, model, recorded_at DESC);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- Monthly partitions: Pre-create 12 months (Jan 2026 - Dec 2026) plus a
-- DEFAULT partition to catch any records that fall outside named partitions.
--
-- OPERATIONAL NOTE: Add next year's partitions before Jan 1 of that year.
-- Run: SELECT create_monthly_partition('2027-01-01'::DATE); for each month.
-- ---------------------------------------------------------------------------

CREATE TABLE public.usage_records_2026_01 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE public.usage_records_2026_02 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE public.usage_records_2026_03 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE public.usage_records_2026_04 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE public.usage_records_2026_05 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE public.usage_records_2026_06 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE public.usage_records_2026_07 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE public.usage_records_2026_08 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE public.usage_records_2026_09 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE public.usage_records_2026_10 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE public.usage_records_2026_11 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE public.usage_records_2026_12 PARTITION OF public.usage_records
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Safety net: records with timestamps outside named partitions land here.
-- Monitor this partition -- if it accumulates rows, create the missing partition
-- and move them: ALTER TABLE usage_records_default ... DETACH/REATTACH.
CREATE TABLE public.usage_records_default PARTITION OF public.usage_records DEFAULT;


-- ---------------------------------------------------------------------------
-- Partition management helper function.
-- Call this from a cron job (pg_cron or Supabase Edge Function) monthly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_monthly_partition(p_month DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_partition_name TEXT;
  v_start          DATE;
  v_end            DATE;
  v_sql            TEXT;
BEGIN
  v_start          := DATE_TRUNC('month', p_month);
  v_end            := v_start + INTERVAL '1 month';
  v_partition_name := 'usage_records_' || TO_CHAR(v_start, 'YYYY_MM');

  -- Idempotent: skip if partition already exists
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_partition_name
  ) THEN
    RETURN 'EXISTS: ' || v_partition_name;
  END IF;

  v_sql := format(
    'CREATE TABLE public.%I PARTITION OF public.usage_records
     FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_start::TEXT,
    v_end::TEXT
  );

  EXECUTE v_sql;
  RETURN 'CREATED: ' || v_partition_name;
END;
$$;

COMMENT ON FUNCTION public.create_monthly_partition IS
  'Creates a monthly partition for usage_records. Call monthly via pg_cron or Supabase Edge Function scheduled job. Example: SELECT public.create_monthly_partition(DATE_TRUNC(''month'', NOW() + INTERVAL ''1 month'')::DATE);';


-- =============================================================================
-- SECTION 3: AGGREGATION / ROLLUP TABLES
--
-- Design decision: Rollup tables (not materialized views) for dashboard queries.
--
-- WHY NOT MATERIALIZED VIEWS?
--   - REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index and still
--     re-computes the entire result set. For a table with 100K rows being
--     refreshed every 15 minutes, this is expensive.
--   - A rollup table can be updated INCREMENTALLY: only the rows for the
--     current day/month need updating on each CLI sync.
--   - The rollup table supports the UPSERT pattern natively (ON CONFLICT DO UPDATE).
--
-- WHEN TO USE MATERIALIZED VIEWS instead:
--   - Ad-hoc cross-team admin analytics that run infrequently
--   - Complex multi-join aggregations that would be complex to update incrementally
--   (See Section 7 for the admin materialized view)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- usage_daily_rollups
-- Pre-aggregated per (team, developer, tool, date).
-- Powers: daily cost chart, developer comparison table, tool breakdown.
-- Updated by trigger on usage_records INSERT.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.usage_daily_rollups (
  team_id         UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  developer_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool            TEXT        NOT NULL,
  model           TEXT        NOT NULL DEFAULT 'unknown',
  project         TEXT        NOT NULL DEFAULT '',   -- Empty string = "no project"
  date            DATE        NOT NULL,              -- The calendar day (UTC)

  -- Aggregated metrics
  total_input_tokens    BIGINT  NOT NULL DEFAULT 0,
  total_output_tokens   BIGINT  NOT NULL DEFAULT 0,
  total_cache_read_tokens  BIGINT NOT NULL DEFAULT 0,
  total_cache_write_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd        NUMERIC(14, 6) NOT NULL DEFAULT 0,
  request_count         INTEGER NOT NULL DEFAULT 0,  -- Number of usage records

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, developer_id, tool, model, project, date)
);

-- Query: "total daily cost for team X in Jan 2026" (aggregation across devs/tools)
CREATE INDEX idx_daily_rollups_team_date
  ON public.usage_daily_rollups(team_id, date DESC);

-- Query: "developer cost breakdown for this month"
CREATE INDEX idx_daily_rollups_team_dev_date
  ON public.usage_daily_rollups(team_id, developer_id, date DESC);

-- Query: "tool comparison chart for team X"
CREATE INDEX idx_daily_rollups_team_tool_date
  ON public.usage_daily_rollups(team_id, tool, date DESC);

ALTER TABLE public.usage_daily_rollups ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- Trigger: maintain usage_daily_rollups on each INSERT into usage_records.
-- This runs per-partition automatically because the trigger is on the parent.
--
-- PERFORMANCE NOTE: This trigger executes on EVERY insert. It is an UPSERT
-- so it is safe for concurrent CLI syncs. The ON CONFLICT is on the primary
-- key (a unique index), so it is O(1) per record.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_daily_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usage_daily_rollups (
    team_id, developer_id, tool, model, project, date,
    total_input_tokens, total_output_tokens,
    total_cache_read_tokens, total_cache_write_tokens,
    total_cost_usd, request_count, updated_at
  )
  VALUES (
    NEW.team_id,
    NEW.developer_id,
    NEW.tool,
    NEW.model,
    COALESCE(NEW.project, ''),
    DATE(NEW.recorded_at AT TIME ZONE 'UTC'),
    NEW.input_tokens,
    NEW.output_tokens,
    NEW.cache_read_tokens,
    NEW.cache_write_tokens,
    NEW.cost_usd,
    1,
    NOW()
  )
  ON CONFLICT (team_id, developer_id, tool, model, project, date)
  DO UPDATE SET
    total_input_tokens    = usage_daily_rollups.total_input_tokens    + EXCLUDED.total_input_tokens,
    total_output_tokens   = usage_daily_rollups.total_output_tokens   + EXCLUDED.total_output_tokens,
    total_cache_read_tokens  = usage_daily_rollups.total_cache_read_tokens  + EXCLUDED.total_cache_read_tokens,
    total_cache_write_tokens = usage_daily_rollups.total_cache_write_tokens + EXCLUDED.total_cache_write_tokens,
    total_cost_usd        = usage_daily_rollups.total_cost_usd        + EXCLUDED.total_cost_usd,
    request_count         = usage_daily_rollups.request_count         + 1,
    updated_at            = NOW();

  RETURN NEW;
END;
$$;

-- Trigger on the PARENT partitioned table. PostgreSQL propagates to all partitions.
CREATE TRIGGER trg_update_daily_rollup
  AFTER INSERT ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.update_daily_rollup();


-- ---------------------------------------------------------------------------
-- usage_monthly_rollups
-- Pre-aggregated per (team, developer, tool, year-month).
-- Powers: monthly cost totals, billing alerts, subscription limit checks.
-- Updated by trigger on usage_daily_rollups INSERT/UPDATE.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.usage_monthly_rollups (
  team_id               UUID    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  developer_id          UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool                  TEXT    NOT NULL,
  year_month            CHAR(7) NOT NULL,             -- Format: 'YYYY-MM'

  total_input_tokens    BIGINT  NOT NULL DEFAULT 0,
  total_output_tokens   BIGINT  NOT NULL DEFAULT 0,
  total_cost_usd        NUMERIC(14, 6) NOT NULL DEFAULT 0,
  request_count         INTEGER NOT NULL DEFAULT 0,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, developer_id, tool, year_month)
);

CREATE INDEX idx_monthly_rollups_team_month
  ON public.usage_monthly_rollups(team_id, year_month DESC);

CREATE INDEX idx_monthly_rollups_team_dev_month
  ON public.usage_monthly_rollups(team_id, developer_id, year_month DESC);

ALTER TABLE public.usage_monthly_rollups ENABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION public.update_monthly_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usage_monthly_rollups (
    team_id, developer_id, tool, year_month,
    total_input_tokens, total_output_tokens,
    total_cost_usd, request_count, updated_at
  )
  VALUES (
    NEW.team_id,
    NEW.developer_id,
    NEW.tool,
    TO_CHAR(NEW.date, 'YYYY-MM'),
    NEW.total_input_tokens,
    NEW.total_output_tokens,
    NEW.total_cost_usd,
    NEW.request_count,
    NOW()
  )
  ON CONFLICT (team_id, developer_id, tool, year_month)
  DO UPDATE SET
    total_input_tokens  = usage_monthly_rollups.total_input_tokens  + EXCLUDED.total_input_tokens,
    total_output_tokens = usage_monthly_rollups.total_output_tokens + EXCLUDED.total_output_tokens,
    total_cost_usd      = usage_monthly_rollups.total_cost_usd      + EXCLUDED.total_cost_usd,
    request_count       = usage_monthly_rollups.request_count       + EXCLUDED.request_count,
    updated_at          = NOW();

  RETURN NEW;
END;
$$;

-- Fires when a new daily rollup row is created (first record of the day for
-- a given dev/tool combination) or when an existing row is updated.
CREATE TRIGGER trg_update_monthly_rollup
  AFTER INSERT OR UPDATE ON public.usage_daily_rollups
  FOR EACH ROW EXECUTE FUNCTION public.update_monthly_rollup();


-- =============================================================================
-- SECTION 4: SUBSCRIPTIONS (Polar.sh webhooks)
--
-- Polar.sh subscription events:
--   subscription.created  -- new sub, status = active
--   subscription.updated  -- plan change, seat update
--   subscription.canceled -- cancel_at_period_end = true, status = canceled
--   subscription.revoked  -- immediate cancellation
--   subscription.active   -- reactivated after uncancellation
--   subscription.past_due -- payment failed
--
-- The webhook handler should UPSERT on (polar_subscription_id) to handle
-- out-of-order delivery. Store the full raw_event JSONB for debugging.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Polar.sh identifiers
  polar_subscription_id TEXT        NOT NULL UNIQUE,
  polar_customer_id     TEXT,
  polar_product_id      TEXT,       -- Polar product UUID

  -- Plan details (denormalized from Polar payload for fast reads)
  plan                  TEXT        NOT NULL DEFAULT 'pro'
                                    CHECK (plan IN ('pro', 'enterprise')),
  billing_interval      TEXT        NOT NULL DEFAULT 'month'
                                    CHECK (billing_interval IN ('month', 'year')),
  status                TEXT        NOT NULL
                                    CHECK (status IN ('active', 'canceled', 'past_due', 'revoked', 'unpaid')),
  seat_count            INTEGER     NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  price_amount          INTEGER     NOT NULL DEFAULT 0,  -- In cents (e.g. 1500 = $15.00)
  currency              CHAR(3)     NOT NULL DEFAULT 'usd',

  -- Billing period
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  cancel_at_period_end  BOOLEAN     NOT NULL DEFAULT FALSE,
  canceled_at           TIMESTAMPTZ,

  -- Audit
  raw_event             JSONB,      -- Full webhook payload (for debugging/replay)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_team ON public.subscriptions(team_id);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
-- Fast lookup by Polar ID during webhook processing
CREATE INDEX idx_subscriptions_polar_id ON public.subscriptions(polar_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Webhook upsert function (called from API route with service_role key)
CREATE OR REPLACE FUNCTION public.upsert_subscription(
  p_team_id               UUID,
  p_user_id               UUID,
  p_polar_subscription_id TEXT,
  p_polar_customer_id     TEXT,
  p_polar_product_id      TEXT,
  p_plan                  TEXT,
  p_billing_interval      TEXT,
  p_status                TEXT,
  p_seat_count            INTEGER,
  p_price_amount          INTEGER,
  p_currency              TEXT,
  p_current_period_start  TIMESTAMPTZ,
  p_current_period_end    TIMESTAMPTZ,
  p_cancel_at_period_end  BOOLEAN,
  p_canceled_at           TIMESTAMPTZ,
  p_raw_event             JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.subscriptions (
    team_id, user_id, polar_subscription_id, polar_customer_id,
    polar_product_id, plan, billing_interval, status, seat_count,
    price_amount, currency, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, raw_event
  )
  VALUES (
    p_team_id, p_user_id, p_polar_subscription_id, p_polar_customer_id,
    p_polar_product_id, p_plan, p_billing_interval, p_status, p_seat_count,
    p_price_amount, p_currency, p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_canceled_at, p_raw_event
  )
  ON CONFLICT (polar_subscription_id)
  DO UPDATE SET
    status               = EXCLUDED.status,
    seat_count           = EXCLUDED.seat_count,
    price_amount         = EXCLUDED.price_amount,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end   = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    canceled_at          = EXCLUDED.canceled_at,
    raw_event            = EXCLUDED.raw_event,
    updated_at           = NOW()
  RETURNING id INTO v_id;

  -- Keep teams.plan and teams.seat_count in sync with active subscription
  IF p_status = 'active' THEN
    UPDATE public.teams
    SET plan = p_plan, seat_count = p_seat_count, updated_at = NOW()
    WHERE id = p_team_id;
  ELSIF p_status IN ('canceled', 'revoked') THEN
    UPDATE public.teams
    SET plan = 'free', updated_at = NOW()
    WHERE id = p_team_id;
  END IF;

  RETURN v_id;
END;
$$;


-- =============================================================================
-- SECTION 5: API KEYS (CLI Bearer token authentication)
--
-- Security design:
--   - Keys are stored ONLY as bcrypt hashes (gen_salt('bf', 10) cost factor).
--   - The first 8 characters of the key are stored as key_prefix for O(1)
--     prefix lookup before bcrypt comparison (avoids full-table scan).
--   - The plaintext key is returned ONCE at creation and never stored.
--   - Key format: kova_<64 hex chars> (total 69 chars)
--   - bcrypt cost 10 is chosen to balance security vs API latency (~100ms).
--     Cost 12 would be more secure but adds ~400ms per CLI request.
--   - private schema keeps keys out of the auto-REST API entirely.
-- =============================================================================

CREATE TABLE IF NOT EXISTS private.api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL DEFAULT 'CLI Key',
  key_prefix    VARCHAR(8)  NOT NULL,                   -- First 8 chars of plaintext key
  key_hash      TEXT        NOT NULL,                   -- bcrypt hash of full key
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: verify_api_key() looks up by prefix first, then bcrypt-compares.
-- Partial index on is_active=TRUE keeps this index small and fast.
CREATE UNIQUE INDEX idx_api_keys_prefix_active
  ON private.api_keys(key_prefix)
  WHERE is_active = TRUE;

CREATE INDEX idx_api_keys_team ON private.api_keys(team_id);
CREATE INDEX idx_api_keys_user ON private.api_keys(user_id);


-- ---------------------------------------------------------------------------
-- private.create_api_key()
-- Called from POST /api/v1/api-keys. Returns plaintext key (shown once).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.create_api_key(
  p_user_id UUID,
  p_team_id UUID,
  p_name    TEXT DEFAULT 'CLI Key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key    TEXT;
  v_prefix TEXT;
  v_hash   TEXT;
BEGIN
  -- Generate: "kova_" + 32 random bytes as hex = 69 chars total
  v_key    := 'kova_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := LEFT(v_key, 8);                          -- "kova_XXX"
  v_hash   := crypt(v_key, gen_salt('bf', 10));

  INSERT INTO private.api_keys (user_id, team_id, name, key_prefix, key_hash)
  VALUES (p_user_id, p_team_id, p_name, v_prefix, v_hash);

  RETURN v_key;   -- Returned once; caller must display to user immediately
END;
$$;


-- ---------------------------------------------------------------------------
-- private.verify_api_key()
-- Called from API middleware on every CLI request.
-- Returns (valid, user_id, team_id, team_plan, role) for authorization.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.verify_api_key(p_key TEXT)
RETURNS TABLE(
  valid       BOOLEAN,
  user_id     UUID,
  team_id     UUID,
  team_plan   TEXT,
  user_role   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT;
  v_key_row private.api_keys%ROWTYPE;
  v_team    public.teams%ROWTYPE;
  v_member  public.team_members%ROWTYPE;
BEGIN
  v_prefix := LEFT(p_key, 8);

  -- Prefix lookup first (O(1) index scan, no bcrypt yet)
  SELECT *
  INTO   v_key_row
  FROM   private.api_keys
  WHERE  key_prefix = v_prefix
    AND  is_active  = TRUE
    AND  (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- bcrypt comparison (~100ms, unavoidable)
  IF crypt(p_key, v_key_row.key_hash) = v_key_row.key_hash THEN
    -- Update last_used_at asynchronously pattern: fire-and-forget via UPDATE
    UPDATE private.api_keys SET last_used_at = NOW() WHERE id = v_key_row.id;

    -- Fetch team and member role
    SELECT * INTO v_team   FROM public.teams        WHERE id = v_key_row.team_id;
    SELECT * INTO v_member FROM public.team_members
      WHERE team_id = v_key_row.team_id AND user_id = v_key_row.user_id AND accepted_at IS NOT NULL;

    RETURN QUERY SELECT
      TRUE,
      v_key_row.user_id,
      v_key_row.team_id,
      v_team.plan,
      COALESCE(v_member.role, 'member');
  ELSE
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- public.revoke_api_key()
-- Called from DELETE /api/v1/api-keys/:id via authenticated session.
-- Soft-delete only: preserves audit trail.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE private.api_keys
  SET    is_active = FALSE
  WHERE  id        = p_key_id
    AND  user_id   = p_user_id;   -- Owner check: users can only revoke their own keys

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;


-- ---------------------------------------------------------------------------
-- public.list_api_keys()
-- Returns safe metadata (no hashes) for the settings page.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_api_keys(p_user_id UUID)
RETURNS TABLE(
  id           UUID,
  team_id      UUID,
  name         TEXT,
  key_prefix   VARCHAR(8),
  is_active    BOOLEAN,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id, team_id, name, key_prefix, is_active, last_used_at, expires_at, created_at
  FROM   private.api_keys
  WHERE  user_id = p_user_id
  ORDER BY created_at DESC;
$$;


-- =============================================================================
-- SECTION 6: BUDGETS AND ALERTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- budgets
-- Per-team budget configuration. A team can have one monthly and one daily
-- budget. The API and CLI check these to generate alerts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budgets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Budget targets
  monthly_limit_usd NUMERIC(10, 2),    -- NULL = no monthly budget
  daily_limit_usd   NUMERIC(10, 2),    -- NULL = no daily budget

  -- Alert thresholds (percentage of limit, e.g. 80 = alert at 80%)
  warn_threshold_pct INTEGER NOT NULL DEFAULT 80
                             CHECK (warn_threshold_pct BETWEEN 1 AND 99),
  critical_threshold_pct INTEGER NOT NULL DEFAULT 95
                             CHECK (critical_threshold_pct BETWEEN 1 AND 100),

  -- Granularity: "whole team" or "per developer"
  scope             TEXT NOT NULL DEFAULT 'team'
                    CHECK (scope IN ('team', 'developer')),

  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one active budget per team per scope
  CONSTRAINT unique_active_budget UNIQUE (team_id, scope, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_budgets_team ON public.budgets(team_id) WHERE is_active = TRUE;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- budget_alerts
-- Immutable alert event log. One row per alert fired.
-- The API reads this to show alert history. The CLI polls the latest
-- alert for the team's current billing period to show warnings.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budget_alerts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  budget_id       UUID        NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  developer_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for team-scope alerts

  alert_type      TEXT        NOT NULL
                              CHECK (alert_type IN ('daily_warn', 'daily_critical', 'daily_exceeded',
                                                    'monthly_warn', 'monthly_critical', 'monthly_exceeded')),
  period          CHAR(10)    NOT NULL,  -- 'YYYY-MM-DD' for daily, 'YYYY-MM' for monthly
  budget_usd      NUMERIC(10, 2) NOT NULL,
  spent_usd       NUMERIC(14, 6) NOT NULL,
  percent         NUMERIC(5, 2)  NOT NULL,   -- e.g. 84.32

  -- Notification tracking: was this alert surfaced in the CLI / dashboard?
  notified_cli    BOOLEAN     NOT NULL DEFAULT FALSE,
  notified_email  BOOLEAN     NOT NULL DEFAULT FALSE,

  fired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate alerts for the same period/type (idempotent alert firing)
CREATE UNIQUE INDEX idx_budget_alerts_dedup
  ON public.budget_alerts(team_id, budget_id, alert_type, period);

CREATE INDEX idx_budget_alerts_team_period
  ON public.budget_alerts(team_id, period DESC);

-- CLI polls this to show unread warnings
CREATE INDEX idx_budget_alerts_unnotified
  ON public.budget_alerts(team_id, fired_at DESC)
  WHERE notified_cli = FALSE;

ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- check_and_fire_budget_alerts()
-- Called by: (1) the rollup trigger chain, (2) a scheduled cron job.
-- Fires alerts when spending crosses threshold percentages.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_and_fire_budget_alerts(
  p_team_id    UUID,
  p_year_month CHAR(7)   -- 'YYYY-MM'
)
RETURNS INTEGER   -- Number of new alerts fired
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_budget        public.budgets%ROWTYPE;
  v_monthly_spent NUMERIC(14, 6);
  v_daily_spent   NUMERIC(14, 6);
  v_today         DATE := CURRENT_DATE;
  v_alerts_fired  INTEGER := 0;
BEGIN
  -- Get active team budget
  SELECT * INTO v_budget
  FROM   public.budgets
  WHERE  team_id = p_team_id AND scope = 'team' AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Monthly spend from rollup
  SELECT COALESCE(SUM(total_cost_usd), 0)
  INTO   v_monthly_spent
  FROM   public.usage_monthly_rollups
  WHERE  team_id = p_team_id AND year_month = p_year_month;

  -- Daily spend from rollup
  SELECT COALESCE(SUM(total_cost_usd), 0)
  INTO   v_daily_spent
  FROM   public.usage_daily_rollups
  WHERE  team_id = p_team_id AND date = v_today;

  -- Check monthly budget thresholds
  IF v_budget.monthly_limit_usd IS NOT NULL AND v_monthly_spent > 0 THEN
    DECLARE
      v_pct NUMERIC := ROUND((v_monthly_spent / v_budget.monthly_limit_usd) * 100, 2);
    BEGIN
      IF v_pct >= 100 THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'monthly_exceeded', p_year_month,
           v_budget.monthly_limit_usd, v_monthly_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;

      ELSIF v_pct >= v_budget.critical_threshold_pct THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'monthly_critical', p_year_month,
           v_budget.monthly_limit_usd, v_monthly_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;

      ELSIF v_pct >= v_budget.warn_threshold_pct THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'monthly_warn', p_year_month,
           v_budget.monthly_limit_usd, v_monthly_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;
      END IF;
    END;
  END IF;

  -- Check daily budget thresholds
  IF v_budget.daily_limit_usd IS NOT NULL AND v_daily_spent > 0 THEN
    DECLARE
      v_pct NUMERIC := ROUND((v_daily_spent / v_budget.daily_limit_usd) * 100, 2);
    BEGIN
      IF v_pct >= 100 THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'daily_exceeded', v_today::TEXT,
           v_budget.daily_limit_usd, v_daily_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;

      ELSIF v_pct >= v_budget.critical_threshold_pct THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'daily_critical', v_today::TEXT,
           v_budget.daily_limit_usd, v_daily_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;

      ELSIF v_pct >= v_budget.warn_threshold_pct THEN
        INSERT INTO public.budget_alerts
          (team_id, budget_id, alert_type, period, budget_usd, spent_usd, percent)
        VALUES
          (p_team_id, v_budget.id, 'daily_warn', v_today::TEXT,
           v_budget.daily_limit_usd, v_daily_spent, v_pct)
        ON CONFLICT (team_id, budget_id, alert_type, period) DO NOTHING;
        GET DIAGNOSTICS v_alerts_fired = v_alerts_fired + ROW_COUNT;
      END IF;
    END;
  END IF;

  RETURN v_alerts_fired;
END;
$$;


-- =============================================================================
-- SECTION 7: ADMIN MATERIALIZED VIEW
-- Used for cross-team analytics (Kova internal, not customer-facing).
-- Refreshed nightly via pg_cron or Supabase scheduled Edge Function.
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS private.admin_team_monthly_summary AS
SELECT
  t.id           AS team_id,
  t.name         AS team_name,
  t.plan,
  r.year_month,
  COUNT(DISTINCT r.developer_id)     AS active_developers,
  SUM(r.total_input_tokens)          AS total_input_tokens,
  SUM(r.total_output_tokens)         AS total_output_tokens,
  SUM(r.total_cost_usd)              AS total_cost_usd,
  SUM(r.request_count)               AS total_requests,
  -- Breakdown by tool
  SUM(r.total_cost_usd) FILTER (WHERE r.tool = 'claude_code')  AS cost_claude_code,
  SUM(r.total_cost_usd) FILTER (WHERE r.tool = 'cursor')       AS cost_cursor,
  SUM(r.total_cost_usd) FILTER (WHERE r.tool = 'copilot')      AS cost_copilot,
  SUM(r.total_cost_usd) FILTER (WHERE r.tool = 'devin')        AS cost_devin,
  SUM(r.total_cost_usd) FILTER (WHERE r.tool = 'windsurf')     AS cost_windsurf
FROM   public.teams t
JOIN   public.usage_monthly_rollups r ON r.team_id = t.id
GROUP BY t.id, t.name, t.plan, r.year_month
WITH DATA;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_admin_summary_team_month
  ON private.admin_team_monthly_summary(team_id, year_month);

COMMENT ON MATERIALIZED VIEW private.admin_team_monthly_summary IS
  'Nightly admin analytics. Refresh via: REFRESH MATERIALIZED VIEW CONCURRENTLY private.admin_team_monthly_summary';


-- =============================================================================
-- SECTION 8: ROW LEVEL SECURITY POLICIES
--
-- RLS design principles applied here:
--
-- 1. PERFORMANCE: Always wrap auth.uid() in (SELECT auth.uid()) to enable
--    PostgreSQL to cache the result for the duration of the query. This is
--    the single most impactful RLS performance optimization (94.97% speedup
--    per Supabase benchmarks).
--
-- 2. TEAM ISOLATION: Data is isolated at the team level, not user level.
--    A developer can see their team's data but not other teams' data.
--    Team membership is checked via a subquery against team_members.
--
-- 3. AVOID N+1 IN RLS: The subquery pattern (team_id IN SELECT ...) is
--    evaluated once per query statement, not per row. Index on
--    team_members(user_id) makes this subquery an O(1) index scan.
--
-- 4. ROLE SCOPING: Use TO authenticated on all policies to prevent
--    anonymous access and skip policy evaluation for service_role calls
--    (which bypass RLS by design).
--
-- 5. SPLIT READ/WRITE: Separate policies for SELECT vs INSERT/UPDATE/DELETE
--    allow finer control. Members can read all team data but only admins
--    can modify budgets and team settings.
-- =============================================================================

-- Helper: returns team IDs for the current user (used in subqueries below).
-- SECURITY DEFINER + search_path = '' prevents privilege escalation.
-- Returns SETOF UUID for use in IN() subqueries.
CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE            -- Result is stable within a transaction (safe to cache)
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT team_id
  FROM   public.team_members
  WHERE  user_id     = (SELECT auth.uid())
    AND  accepted_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_my_team_ids IS
  'Returns team IDs for the authenticated user. Wrapped in SECURITY DEFINER so RLS on team_members does not recurse. STABLE allows PostgreSQL to cache the result within a query.';


-- ---------------------------------------------------------------------------
-- teams policies
-- ---------------------------------------------------------------------------

CREATE POLICY "members_can_read_their_teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_my_team_ids()));

CREATE POLICY "owners_can_update_team"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Team creation: any authenticated user can create a team (they become owner)
CREATE POLICY "authenticated_can_create_team"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------------
-- team_members policies
-- ---------------------------------------------------------------------------

-- Members can see who else is in their teams
CREATE POLICY "members_can_read_team_membership"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));

-- Admins and owners can invite/remove members
CREATE POLICY "admins_can_manage_members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id   = team_members.team_id
        AND tm.user_id   = (SELECT auth.uid())
        AND tm.role      IN ('owner', 'admin')
        AND tm.accepted_at IS NOT NULL
    )
  );

-- Users can update their own membership (e.g., accept invitation)
CREATE POLICY "users_can_accept_own_invitation"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Owners/admins can delete members; users can remove themselves
CREATE POLICY "admins_or_self_can_remove_membership"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id   = team_members.team_id
        AND tm.user_id   = (SELECT auth.uid())
        AND tm.role      IN ('owner', 'admin')
        AND tm.accepted_at IS NOT NULL
    )
  );


-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------

CREATE POLICY "users_read_own_profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "users_update_own_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Team members can read basic profile info of their teammates
CREATE POLICY "teammates_can_read_profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tm.user_id
      FROM   public.team_members tm
      WHERE  tm.team_id IN (SELECT public.get_my_team_ids())
        AND  tm.accepted_at IS NOT NULL
    )
  );


-- ---------------------------------------------------------------------------
-- usage_records policies
-- ---------------------------------------------------------------------------

-- Team members can read all usage records for their teams
CREATE POLICY "team_members_can_read_usage"
  ON public.usage_records
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));

-- Any team member can insert their own usage records (CLI sync)
CREATE POLICY "team_members_can_insert_usage"
  ON public.usage_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    developer_id = (SELECT auth.uid())
    AND team_id IN (SELECT public.get_my_team_ids())
  );

-- Usage records are immutable once inserted (no UPDATE or DELETE via client)
-- Deletions must go through service_role (e.g., data retention jobs)


-- ---------------------------------------------------------------------------
-- usage_daily_rollups policies
-- ---------------------------------------------------------------------------

-- Rollup tables are read-only for clients; writes come from triggers (DEFINER)
CREATE POLICY "team_members_can_read_daily_rollups"
  ON public.usage_daily_rollups
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));


-- ---------------------------------------------------------------------------
-- usage_monthly_rollups policies
-- ---------------------------------------------------------------------------

CREATE POLICY "team_members_can_read_monthly_rollups"
  ON public.usage_monthly_rollups
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));


-- ---------------------------------------------------------------------------
-- subscriptions policies
-- ---------------------------------------------------------------------------

-- Team members can read their team's subscription
CREATE POLICY "team_members_can_read_subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));

-- No client INSERT/UPDATE: subscriptions are managed exclusively via
-- the Polar.sh webhook handler (service_role key, bypasses RLS)


-- ---------------------------------------------------------------------------
-- budgets policies
-- ---------------------------------------------------------------------------

-- All team members can read budgets (needed to show budget status in dashboard)
CREATE POLICY "team_members_can_read_budgets"
  ON public.budgets
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));

-- Only admins and owners can create/update budgets
CREATE POLICY "admins_can_manage_budgets"
  ON public.budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = budgets.team_id
        AND tm.user_id = (SELECT auth.uid())
        AND tm.role    IN ('owner', 'admin')
        AND tm.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "admins_can_update_budgets"
  ON public.budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = budgets.team_id
        AND tm.user_id = (SELECT auth.uid())
        AND tm.role    IN ('owner', 'admin')
        AND tm.accepted_at IS NOT NULL
    )
  );


-- ---------------------------------------------------------------------------
-- budget_alerts policies
-- ---------------------------------------------------------------------------

CREATE POLICY "team_members_can_read_alerts"
  ON public.budget_alerts
  FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()));

-- CLI marks its own alerts as notified
CREATE POLICY "cli_can_mark_alerts_notified"
  ON public.budget_alerts
  FOR UPDATE
  TO authenticated
  USING (team_id IN (SELECT public.get_my_team_ids()))
  WITH CHECK (team_id IN (SELECT public.get_my_team_ids()));


-- =============================================================================
-- SECTION 9: UTILITY FUNCTIONS (called from API routes)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_team_cost_summary()
-- Primary dashboard API: returns monthly cost summary for a team.
-- Called from: GET /api/v1/teams/:id/costs
-- Uses rollup table -- no full table scan of usage_records.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_cost_summary(
  p_team_id    UUID,
  p_year_month CHAR(7)   -- 'YYYY-MM', e.g. '2026-03'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Authorization: caller must be a team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'team_id',            p_team_id,
    'year_month',         p_year_month,
    'total_cost_usd',     COALESCE(SUM(total_cost_usd), 0),
    'total_input_tokens', COALESCE(SUM(total_input_tokens), 0),
    'total_output_tokens',COALESCE(SUM(total_output_tokens), 0),
    'total_requests',     COALESCE(SUM(request_count), 0),
    'active_developers',  COUNT(DISTINCT developer_id),
    'by_tool', jsonb_object_agg(
      tool,
      jsonb_build_object(
        'cost_usd',      SUM(total_cost_usd),
        'input_tokens',  SUM(total_input_tokens),
        'output_tokens', SUM(total_output_tokens),
        'requests',      SUM(request_count)
      )
    )
  )
  INTO v_result
  FROM public.usage_monthly_rollups
  WHERE team_id   = p_team_id
    AND year_month = p_year_month;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;


-- ---------------------------------------------------------------------------
-- get_team_daily_costs()
-- Returns daily cost array for sparkline/chart rendering.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_daily_costs(
  p_team_id  UUID,
  p_from     DATE,
  p_to       DATE
)
RETURNS TABLE(date DATE, cost_usd NUMERIC, request_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    d.date,
    COALESCE(SUM(r.total_cost_usd), 0) AS cost_usd,
    COALESCE(SUM(r.request_count),  0) AS request_count
  FROM generate_series(p_from, p_to, INTERVAL '1 day') AS d(date)
  LEFT JOIN public.usage_daily_rollups r
    ON r.team_id = p_team_id AND r.date = d.date::DATE
  -- Authorization check
  WHERE EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id    = p_team_id
      AND user_id    = (SELECT auth.uid())
      AND accepted_at IS NOT NULL
  )
  GROUP BY d.date
  ORDER BY d.date;
$$;


-- ---------------------------------------------------------------------------
-- get_developer_breakdown()
-- Per-developer cost breakdown for a given month.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_developer_breakdown(
  p_team_id    UUID,
  p_year_month CHAR(7)
)
RETURNS TABLE(
  developer_id   UUID,
  display_name   TEXT,
  avatar_url     TEXT,
  total_cost_usd NUMERIC,
  total_requests BIGINT,
  by_tool        JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.developer_id,
    p.display_name,
    p.avatar_url,
    SUM(r.total_cost_usd)   AS total_cost_usd,
    SUM(r.request_count)    AS total_requests,
    jsonb_object_agg(r.tool, r.total_cost_usd) AS by_tool
  FROM public.usage_monthly_rollups r
  JOIN public.profiles p ON p.id = r.developer_id
  WHERE r.team_id    = p_team_id
    AND r.year_month = p_year_month
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id    = p_team_id
        AND user_id    = (SELECT auth.uid())
        AND accepted_at IS NOT NULL
    )
  GROUP BY r.developer_id, p.display_name, p.avatar_url
  ORDER BY total_cost_usd DESC;
$$;


-- ---------------------------------------------------------------------------
-- upload_usage_records()
-- Batch insert from CLI sync. Accepts JSONB array for efficiency.
-- Returns count of newly inserted records (deduplication via record_hash).
-- Called from: POST /api/v1/usage (with Bearer API key auth)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upload_usage_records(
  p_team_id    UUID,
  p_user_id    UUID,
  p_records    JSONB    -- Array of usage record objects
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Verify caller is an active team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id    = p_team_id
      AND user_id    = p_user_id
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Not a team member' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.usage_records (
    team_id, developer_id, tool, model, session_id, project,
    input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
    cost_usd, occurred_at, recorded_at, duration_ms, metadata, record_hash
  )
  SELECT
    p_team_id,
    p_user_id,
    (r->>'tool')::TEXT,
    COALESCE(r->>'model', 'unknown'),
    (r->>'session_id')::TEXT,
    r->>'project',
    COALESCE((r->>'input_tokens')::INTEGER,  0),
    COALESCE((r->>'output_tokens')::INTEGER, 0),
    COALESCE((r->>'cache_read_tokens')::INTEGER,  0),
    COALESCE((r->>'cache_write_tokens')::INTEGER, 0),
    COALESCE((r->>'cost_usd')::NUMERIC, 0),
    (r->>'occurred_at')::TIMESTAMPTZ,
    NOW(),
    (r->>'duration_ms')::INTEGER,
    COALESCE(r->'metadata', '{}'),
    (r->>'record_hash')::TEXT
  FROM jsonb_array_elements(p_records) AS r
  ON CONFLICT (record_hash, recorded_at) DO NOTHING;  -- Idempotent dedup

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;


-- =============================================================================
-- SECTION 10: INDEXES SUMMARY (for query validation)
-- All indexes are documented here for easy audit.
-- =============================================================================

/*
  Table: teams
  - idx_teams_owner                (owner_id)

  Table: team_members
  - PRIMARY KEY                    (team_id, user_id)
  - idx_team_members_user          (user_id) WHERE accepted_at IS NOT NULL
  - idx_team_members_team          (team_id) WHERE accepted_at IS NOT NULL

  Table: usage_records (partitioned)
  - PRIMARY KEY                    (id, recorded_at)
  - idx_usage_records_dedup        UNIQUE (record_hash, recorded_at)
  - idx_usage_team_time            (team_id, recorded_at DESC)
  - idx_usage_team_tool_time       (team_id, tool, recorded_at DESC)
  - idx_usage_team_developer_time  (team_id, developer_id, recorded_at DESC)
  - idx_usage_team_project         (team_id, project, recorded_at DESC) WHERE project IS NOT NULL
  - idx_usage_team_model           (team_id, model, recorded_at DESC)

  Table: usage_daily_rollups
  - PRIMARY KEY                    (team_id, developer_id, tool, model, project, date)
  - idx_daily_rollups_team_date    (team_id, date DESC)
  - idx_daily_rollups_team_dev_date (team_id, developer_id, date DESC)
  - idx_daily_rollups_team_tool_date (team_id, tool, date DESC)

  Table: usage_monthly_rollups
  - PRIMARY KEY                    (team_id, developer_id, tool, year_month)
  - idx_monthly_rollups_team_month (team_id, year_month DESC)
  - idx_monthly_rollups_team_dev_month (team_id, developer_id, year_month DESC)

  Table: subscriptions
  - idx_subscriptions_team         (team_id)
  - idx_subscriptions_user         (user_id)
  - idx_subscriptions_polar_id     (polar_subscription_id)

  Table: budgets
  - idx_budgets_team               (team_id) WHERE is_active = TRUE

  Table: budget_alerts
  - UNIQUE idx_budget_alerts_dedup (team_id, budget_id, alert_type, period)
  - idx_budget_alerts_team_period  (team_id, period DESC)
  - idx_budget_alerts_unnotified   (team_id, fired_at DESC) WHERE notified_cli = FALSE

  Table: private.api_keys
  - idx_api_keys_prefix_active     UNIQUE (key_prefix) WHERE is_active = TRUE
  - idx_api_keys_team              (team_id)
  - idx_api_keys_user              (user_id)
*/


-- =============================================================================
-- SECTION 11: GRANTS
-- Grant execute on public functions to the authenticated and service_role roles.
-- private functions are NOT granted to authenticated (only service_role via
-- the API server using SECURITY DEFINER pattern above).
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_my_team_ids()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_monthly_partition(DATE)             TO service_role;
GRANT EXECUTE ON FUNCTION public.get_team_cost_summary(UUID, CHAR)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_daily_costs(UUID, DATE, DATE)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_developer_breakdown(UUID, CHAR)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_usage_records(UUID, UUID, JSONB)    TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_subscription(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, JSONB)
                                                                             TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_fire_budget_alerts(UUID, CHAR)   TO service_role;
GRANT EXECUTE ON FUNCTION public.list_api_keys(UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(UUID, UUID)                 TO authenticated;

-- private schema functions: only service_role (API server, never browser client)
GRANT EXECUTE ON FUNCTION private.create_api_key(UUID, UUID, TEXT)         TO service_role;
GRANT EXECUTE ON FUNCTION private.verify_api_key(TEXT)                      TO service_role;


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

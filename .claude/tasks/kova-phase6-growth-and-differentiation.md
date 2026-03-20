# Plan: Phase 6 -- Growth, Differentiation, and User Experience

## Task Description

Phase 6 transforms Kova from a production-grade tool into a growth-stage product with viral distribution mechanics, advanced analytics that differentiate from competitors, and an onboarding experience that converts free users to paid. The focus is on features that drive adoption (GitHub App, Slack integration, embeddable badges), retention (anomaly detection, cost forecasting, weekly digests), and conversion (empty states, onboarding wizard, upgrade prompts).

This plan spans two repos:

- **kova-cli** (C:\PROJ\kova-cli) -- Onboarding wizard, compare command, dashboard opener, CLI polish
- **kova-website** (C:\PROJ\kova-website) -- Anomaly detection, forecasting, GitHub App, Slack webhooks, badges, onboarding UX, conversion optimization

## Objective

When this plan is complete:

1. `kova init` runs an interactive onboarding wizard that connects the first tool and syncs in under 2 minutes
2. Dashboard empty states show sample data with a guided setup progress tracker
3. Cost anomaly detection (z-score) surfaces spend spikes in the analytics page
4. 30-day cost forecasting shows "projected monthly spend" on the overview page
5. Shields.io badge endpoint lets users embed AI cost badges in READMEs
6. Slack incoming webhooks deliver budget alerts to team channels
7. GitHub App posts cost impact comments on pull requests
8. Free-to-Pro upgrade prompts appear contextually (not as modals) when users hit limits
9. `kova compare` command shows side-by-side cost comparison between tools/models
10. `kova dashboard` command opens the web dashboard in the default browser
11. A public changelog page exists at /changelog
12. Notification preferences page lets users control email/Slack delivery

## Problem Statement

Kova is production-ready but has no viral distribution mechanics. Every user must be individually acquired. The product lacks:

- **Onboarding friction**: New users see empty dashboards with no guidance. There's no `kova init` wizard. The path from install to first insight takes 5+ manual steps.
- **No anomaly detection**: The #1 feature engineering managers want from a cost tracker is "tell me when something unusual happens." Kova has budget alerts but no anomaly detection.
- **No viral loops**: No GitHub integration (every PR could surface Kova), no embeddable badges (every README could advertise Kova), no Slack presence (every alert could introduce Kova to the team).
- **No conversion optimization**: Free users have no reason to upgrade -- there are no usage limits, no feature gates, no upgrade prompts. The subscription enforcement in sync is the only gate.
- **No forecasting**: "How much will I spend this month?" is unanswerable without manually extrapolating from the trend chart.

## Solution Approach

### Phase 1: Quick Wins (Tasks 1-4) -- 1-2 weeks

Onboarding wizard, empty states, badge endpoint, dashboard opener command. High impact, low effort.

### Phase 2: Core Differentiation (Tasks 5-7) -- 2-3 weeks

Anomaly detection, cost forecasting, compare command. These are the features that make Kova irreplaceable.

### Phase 3: Viral Growth (Tasks 8-10) -- 3-4 weeks

GitHub App, Slack integration, upgrade prompts. These create distribution loops.

### Phase 4: Community (Tasks 11-12) -- 1 week

Changelog page, notification preferences.

## Relevant Files

### kova-cli

- `src/index.ts` -- Add init, compare, dashboard commands
- `src/commands/` -- New command files
- `src/lib/formatter.ts` -- Output formatting patterns
- `src/lib/config-store.ts` -- Config management
- `src/lib/collectors/` -- All collectors (for init wizard detection)

### kova-website

- `app/dashboard/page.tsx` -- Add empty state, forecast widget
- `app/dashboard/analytics/page.tsx` -- Add anomaly detection display
- `app/dashboard/settings/page.tsx` -- Add notification preferences
- `components/dashboard/` -- New chart components
- `components/landing/` -- Conversion optimization
- `app/api/` -- Badge endpoint, GitHub webhook, Slack routes
- `lib/anomaly-detection.ts` -- Z-score anomaly detection
- `lib/forecasting.ts` -- Linear regression cost projection

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members.

### Team Members

- Specialist
  - Name: onboarding-builder
  - Role: Build kova init wizard, empty states, dashboard opener, upgrade prompts
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: analytics-builder
  - Role: Build anomaly detection, cost forecasting, compare command
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: integrations-builder
  - Role: Build GitHub App, Slack webhooks, badge endpoint
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: content-builder
  - Role: Build changelog page, notification preferences, conversion copy
  - Agent Type: frontend-specialist
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Build kova init Onboarding Wizard

- **Task ID**: init-wizard
- **Depends On**: none
- **Assigned To**: onboarding-builder
- **Agent Type**: frontend-specialist
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-cli repo at C:\PROJ\kova-cli
- Read `src/index.ts`, `src/commands/track.ts`, `src/lib/collectors/`, `src/lib/config-store.ts`
- Create `src/commands/init.ts`:
  - Interactive wizard using stdin prompts (no external dependency needed)
  - Step 1: "Which AI tool do you use most?" -- list 5 tools, auto-detect which have data available
  - Step 2: Run a quick scan of the selected tool (`trackCommand` internally)
  - Step 3: Show first cost insight: "Found X sessions, estimated cost: $Y.YY"
  - Step 4: "Want to sync to the cloud dashboard?" -- if yes, prompt for API key or open login URL
  - Step 5: Summary with next steps
  - Auto-detect available tools by checking if their data directories exist
  - Use chalk for colors, show spinners during scan
- Register `init` command in `src/index.ts`
- Create `src/commands/dashboard.ts`:
  - Opens `kova.dev/dashboard` in the default browser
  - Use `import('open')` or `child_process.exec` with platform-specific open command
  - Fallback: print the URL if browser can't be opened
- Register `dashboard` command in `src/index.ts`
- Run `npm run build && npm test`

### 2. Build Dashboard Empty States

- **Task ID**: empty-states
- **Depends On**: none
- **Assigned To**: onboarding-builder
- **Agent Type**: frontend-specialist
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read `app/dashboard/page.tsx`, `app/dashboard/usage/page.tsx`, `components/dashboard/kpi-cards.tsx`
- Create `components/dashboard/empty-state.tsx`:
  - Reusable empty state component with: illustration/icon, title, description, CTA button
  - Props: `{ title, description, ctaText, ctaHref, showSampleData? }`
- Create `components/dashboard/onboarding-progress.tsx`:
  - 3-step progress tracker: "Install CLI" > "Track usage" > "Sync to dashboard"
  - Detect completion: check if any usage_records exist for the user
  - Show inline code blocks for each step
  - Client component with fetch to check data presence
- Update `app/dashboard/page.tsx`:
  - If no usage data exists, show the onboarding progress component instead of empty charts
  - Show sample KPI cards with "(sample data)" labels and a "Connect your first tool" CTA
- Update `app/dashboard/usage/page.tsx`:
  - If no records, show empty state with "No usage data yet. Run kova track to start."
- Update `app/dashboard/analytics/page.tsx`:
  - If no data, show empty state with sample charts blurred/greyed out
- Run `pnpm build`

### 3. Build Shields.io Badge Endpoint

- **Task ID**: badge-endpoint
- **Depends On**: none
- **Assigned To**: integrations-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/api/badges/[userId]/route.ts`:
  - GET handler, no auth required (public endpoint)
  - Accept `userId` param from URL
  - Query `usage_daily_rollups` for current month total cost
  - Query `budgets` for active budget
  - Return Shields.io endpoint badge JSON:
    ```json
    {
      "schemaVersion": 1,
      "label": "AI costs",
      "message": "$34.20/mo",
      "color": "brightgreen",
      "cacheSeconds": 3600
    }
    ```
  - Color logic: green if under 80% budget, yellow if 80-100%, red if over, blue if no budget
  - If user not found or no data, return "no data" in grey
  - Add `Cache-Control: public, max-age=3600` header
- Create `app/api/badges/[userId]/shield/route.ts` (optional):
  - Returns SVG directly for self-hosted badges (no Shields.io dependency)
- Document in API docs: how to add badge to README
- Run `pnpm build`

### 4. Build kova compare Command

- **Task ID**: compare-command
- **Depends On**: none
- **Assigned To**: analytics-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-cli repo at C:\PROJ\kova-cli
- Read `src/commands/costs.ts`, `src/lib/formatter.ts`, `src/lib/local-store.ts`
- Create `src/commands/compare.ts`:
  - `kova compare` -- side-by-side cost comparison
  - Options: `--tools` (compare tools), `--models` (compare models), `--period` (7d/30d/90d)
  - Default: compare all active tools for the last 30 days
  - Output: formatted table with columns: Tool/Model, Sessions, Input Tokens, Output Tokens, Cost, Cost/Session
  - Highlight the most and least expensive with colors
  - Show cost efficiency metrics (cost per 1K tokens)
  - Example output:

    ```
    AI Tool Cost Comparison (Last 30 Days)

    Tool          Sessions  Cost      Cost/Session  Cost/1K Tokens
    Claude Code   234       $45.67    $0.20         $0.015
    Cursor        567       $23.45    $0.04         $0.008
    Copilot       890       $19.99    $0.02         $0.003
    Windsurf      123       $12.34    $0.10         $0.012
    Devin         45        $89.00    $1.98         $0.045

    Total: $190.45 across 1,859 sessions
    Most efficient: Copilot ($0.003/1K tokens)
    Most expensive: Devin ($0.045/1K tokens)
    ```

- Register in `src/index.ts`
- Write tests in `tests/commands/compare.test.ts`
- Run `npm run build && npm test`

### 5. Build Anomaly Detection

- **Task ID**: anomaly-detection
- **Depends On**: none
- **Assigned To**: analytics-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `lib/anomaly-detection.ts`:

  ```typescript
  export interface AnomalyResult {
    date: string;
    cost: number;
    rollingAvg: number;
    zScore: number;
    isAnomaly: boolean;
    severity: "info" | "warning" | "critical";
  }

  export function detectAnomalies(
    dailyCosts: { date: string; cost: number }[],
    options?: { zThreshold?: number; minDays?: number },
  ): AnomalyResult[] {
    // Z-score with 14-day rolling window
    // Minimum 7 days of data before detection activates
    // Severity: >2 SD = warning, >3 SD = critical
  }
  ```

- Create `components/dashboard/anomaly-chart.tsx`:
  - Extends the existing cost trend chart
  - Overlay anomaly markers (red dots) on the area chart
  - Tooltip shows: date, cost, expected range, deviation
  - Click anomaly to see detail: "Cursor usage spiked 3.2x above your 14-day average"
- Update `app/dashboard/analytics/page.tsx`:
  - Add "Cost Anomalies" section below existing charts
  - Show anomaly timeline + list of recent anomalies with details
  - Only show after 7+ days of data; show "Building baseline..." before
- Write `tests/unit/anomaly-detection.test.ts`:
  - Test: no anomalies in flat data
  - Test: spike detected at 3x normal
  - Test: minimum data requirement (returns empty before 7 days)
  - Test: severity levels match thresholds
- Run `pnpm build && pnpm test`

### 6. Build Cost Forecasting

- **Task ID**: cost-forecasting
- **Depends On**: none
- **Assigned To**: analytics-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `lib/forecasting.ts`:

  ```typescript
  export interface ForecastResult {
    projectedMonthlyTotal: number;
    dailyTrend: "up" | "down" | "stable";
    trendPercent: number;
    confidence: number; // 0-1
    projectedDays: {
      date: string;
      projected: number;
      lower: number;
      upper: number;
    }[];
  }

  export function forecastCosts(
    dailyCosts: { date: string; cost: number }[],
    forecastDays?: number,
  ): ForecastResult | null {
    // Linear regression on daily spend
    // Account for weekday/weekend pattern (7-day MA)
    // Return null if < 14 days of data
    // Confidence band: +/- 1 standard error
  }
  ```

- Create `components/dashboard/forecast-card.tsx`:
  - Card showing: "Projected this month: $XXX" with trend arrow
  - Confidence level: "Based on 30 days of data (high confidence)"
  - Small sparkline showing projected trend
- Create `components/dashboard/forecast-chart.tsx`:
  - Extends cost trend chart with projected line (dashed) + confidence band (shaded area)
  - Clear visual separation between actual data and forecast
- Update `app/dashboard/page.tsx`:
  - Add ForecastCard to the KPI row (5th card, or replace Budget Status if no budget)
  - Add forecast overlay to the CostTrendChart
- Write `tests/unit/forecasting.test.ts`:
  - Test: returns null for < 14 days
  - Test: flat data forecasts near current average
  - Test: upward trend forecasts higher
  - Test: confidence decreases with more variance
- Run `pnpm build && pnpm test`

### 7. Build Slack Incoming Webhooks

- **Task ID**: slack-webhooks
- **Depends On**: none
- **Assigned To**: integrations-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read `lib/resend.ts` (notification pattern), `app/api/v1/notifications/budget-alert/route.ts`
- Create `lib/slack.ts`:

  ```typescript
  export async function sendSlackNotification(
    webhookUrl: string,
    message: {
      text: string;
      blocks?: object[];
    },
  ): Promise<boolean> {
    // POST to webhookUrl with message payload
    // Return true on success, false on failure
    // Timeout: 5 seconds
  }

  export function buildBudgetAlertBlocks(params: {
    teamName: string;
    period: string;
    budgetAmount: number;
    currentSpend: number;
    dashboardUrl: string;
  }): object[] {
    // Slack Block Kit format with section, divider, actions
  }

  export function buildAnomalyAlertBlocks(params: {
    toolName: string;
    date: string;
    cost: number;
    expectedCost: number;
    deviation: string;
    dashboardUrl: string;
  }): object[] {
    // Slack Block Kit for anomaly alerts
  }
  ```

- Update `app/api/v1/notifications/budget-alert/route.ts`:
  - After sending email, check if team has a slack_webhook_url
  - If yes, also send via `sendSlackNotification`
- Add `slack_webhook_url` to teams table (document as migration 005 or add to existing migration):
  - `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;`
- Update `app/dashboard/settings/page.tsx`:
  - Add "Slack Integration" section with webhook URL input field
  - "Test" button to send a test notification
  - Save to teams table
- Run `pnpm build`

### 8. Build GitHub App Scaffold

- **Task ID**: github-app
- **Depends On**: none
- **Assigned To**: integrations-builder
- **Agent Type**: backend-engineer
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/api/github/webhook/route.ts`:
  - POST handler for GitHub App webhook events
  - Verify webhook signature using `crypto.createHmac('sha256', secret)`
  - Handle `pull_request.opened` and `pull_request.synchronize` events
  - For each PR: look up the repo owner's Kova team, query recent cost data, post a comment
  - Use `@octokit/app` for authentication (JWT -> installation token)
  - Install: `pnpm add @octokit/app @octokit/rest`
- Create `lib/github-app.ts`:
  - `createGitHubApp()` -- initialized from env vars (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET)
  - `postPRComment()` -- posts or updates a cost summary comment on a PR
  - `buildCostComment()` -- formats the cost data as markdown
- Create `app/api/github/install/route.ts`:
  - OAuth callback for when a user installs the GitHub App
  - Links their GitHub identity to their Kova team
- The PR comment should show:
  - Current daily AI cost for the repo/team
  - Week-over-week trend
  - Budget status
  - Link to dashboard
- NOTE: The actual cost-from-diff estimation is complex and can be Phase 7. For now, show team-level cost summary on every PR (still valuable).
- Run `pnpm build`

### 9. Build Conversion Optimization (Upgrade Prompts)

- **Task ID**: upgrade-prompts
- **Depends On**: empty-states
- **Assigned To**: onboarding-builder
- **Agent Type**: frontend-specialist
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read `app/dashboard/page.tsx`, `app/dashboard/analytics/page.tsx`, `app/pricing/page.tsx`
- Create `components/dashboard/upgrade-nudge.tsx`:
  - Contextual, dismissible banner component
  - Props: `{ message, ctaText, ctaHref, variant: 'info' | 'feature' }`
  - Style: subtle, border-left accent, not a modal
  - Uses localStorage to track dismissals (don't show same nudge twice in 7 days)
- Add upgrade nudges to dashboard pages (only for free plan users):
  - Overview: "Unlock 90-day history and cost forecasting" (when viewing limited history)
  - Analytics: Show forecast chart greyed out with "Upgrade to Pro for cost forecasting"
  - Budget: "Get email + Slack alerts when budgets are exceeded"
  - Usage: "Export unlimited CSV data with Pro" (if they hit the 30-day free limit)
- Update the pricing page:
  - Add feature comparison table below the tier cards
  - Add FAQ section addressing common developer concerns
- Run `pnpm build`

### 10. Build Changelog Page

- **Task ID**: changelog
- **Depends On**: none
- **Assigned To**: content-builder
- **Agent Type**: frontend-specialist
- **Parallel**: true
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Create `app/changelog/page.tsx`:
  - Server component that renders changelog entries
  - Each entry: date, version, title, description (markdown), tags (feature/fix/improvement)
  - Styled with kova design tokens
  - Latest entries first
- Create `content/changelog/` directory with MDX entries:
  - `2026-03-19-v0.4.1.mdx` -- Phase 5: Security hardening, Sentry, email notifications, testing
  - `2026-03-19-v0.4.0.mdx` -- Phase 4: Rate limiting, CSV export, sync enforcement, auto-sync
  - `2026-03-18-v0.3.0.mdx` -- Phase 2-3: Multi-tool collectors, web dashboard, payments
  - `2026-03-17-v0.1.0.mdx` -- Phase 1: Initial release with 11 commands
- Add `/changelog` link to the site navbar/footer
- Update sitemap.ts with /changelog
- Run `pnpm build`

### 11. Build Notification Preferences

- **Task ID**: notification-prefs
- **Depends On**: slack-webhooks
- **Assigned To**: content-builder
- **Agent Type**: frontend-specialist
- **Parallel**: false
- **IMPORTANT**: This task works in the kova-website repo at C:\PROJ\kova-website
- Read `app/dashboard/settings/page.tsx`
- Add "Notification Preferences" section to settings:
  - Email notifications toggle (budget alerts, weekly digest)
  - Slack webhook URL input + test button
  - Alert threshold selector (Critical only / High + Critical / All)
  - Weekly digest: enabled/disabled + preferred day (Monday default)
- Store preferences in a new column on profiles or a new `notification_preferences` JSONB column on teams
- Create migration 005 if needed:
  ```sql
  ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email_alerts": true, "email_digest": true, "slack_alerts": true, "alert_threshold": "high"}';
  ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
  ```
- Run `pnpm build`

### 12. Final Validation

- **Task ID**: validate-all
- **Depends On**: all above
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Parallel**: false
- Run `cd C:\PROJ\kova-cli && npm run build && npm test`
- Run `cd C:\PROJ\kova-website && pnpm build && pnpm test`
- Verify all 12 acceptance criteria
- Fix any build errors
- Report PASS/FAIL

## Acceptance Criteria

1. `npm run build` and `npm test` pass in kova-cli
2. `pnpm build` and `pnpm test` pass in kova-website
3. `kova init` command exists and runs an interactive wizard
4. `kova dashboard` command opens a URL
5. `kova compare` command shows tool/model cost comparison
6. Dashboard shows onboarding progress for users with no data
7. `lib/anomaly-detection.ts` exists with z-score detection + tests
8. `lib/forecasting.ts` exists with linear regression + tests
9. Forecast card appears on dashboard overview
10. `app/api/badges/[userId]/route.ts` returns Shields.io JSON
11. `lib/slack.ts` exists with notification functions
12. `app/api/github/webhook/route.ts` exists with PR comment scaffold
13. Upgrade nudge component exists for free-plan users
14. `/changelog` page exists with at least 4 entries
15. Notification preferences section exists in settings
16. Anomaly markers appear in analytics page

## Validation Commands

```bash
# kova-cli
cd C:\PROJ\kova-cli
npm run build
npm test
node bin/kova.js init --help
node bin/kova.js compare --help
node bin/kova.js dashboard --help

# kova-website
cd C:\PROJ\kova-website
pnpm build
pnpm test

# File checks
test -f lib/anomaly-detection.ts && echo "OK: anomaly detection"
test -f lib/forecasting.ts && echo "OK: forecasting"
test -f lib/slack.ts && echo "OK: slack"
test -f app/api/badges/*/route.ts && echo "OK: badges"
test -f app/api/github/webhook/route.ts && echo "OK: github app"
test -f app/changelog/page.tsx && echo "OK: changelog"
test -f components/dashboard/empty-state.tsx && echo "OK: empty states"
test -f components/dashboard/upgrade-nudge.tsx && echo "OK: upgrade nudge"
test -f components/dashboard/anomaly-chart.tsx && echo "OK: anomaly chart"
test -f components/dashboard/forecast-card.tsx && echo "OK: forecast card"
```

## Notes

- **GitHub App env vars**: GITHUB_APP_ID, GITHUB_PRIVATE_KEY (PEM), GITHUB_WEBHOOK_SECRET. These are configured when creating the GitHub App in GitHub Developer Settings.
- **Slack webhook URL**: Stored per-team, not per-user. Team owners configure it in settings.
- **Badge privacy**: Badges are public by default for the userId in the URL. Consider adding an opt-in flag on the profile/team to control visibility.
- **Anomaly detection baseline**: Requires 7+ days of data. Show "Building your cost baseline..." for new users.
- **Forecasting confidence**: Linear regression on < 14 days returns null. 14-30 days = low confidence. 30+ days = high confidence. Display this clearly.
- **kova init auto-detection**: Check for data directories: ~/.claude (Claude Code), ~/.cursor (Cursor), ~/.config/github-copilot (Copilot), check Windsurf and Devin paths from their respective collectors.
- **Compare command offline**: Works entirely from local data, no cloud sync required. Great for free users.
- **Upgrade nudge frequency**: Never show the same nudge more than once per 7 days. Cap at 2 nudges visible per page. localStorage tracks dismissals.
- **Changelog entries**: Use MDX with frontmatter (date, version, title, tags). The page reads from content/changelog/ directory.

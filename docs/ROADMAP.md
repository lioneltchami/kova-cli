# Kova Improvement Roadmap

**Last Updated**: 2026-03-15
**Current Version**: 0.1.0
**Total Tests**: 415 passing
**Website**: https://github.com/lioneltchami/kova-website (26 docs pages, 9-section landing page)

---

## Current State (What's Built)

### CLI Tool (Complete)

- 11 CLI commands: init, plan, run, build, team-build, pr, status, config, update, completions, version
- Auto-detection of project type (language, framework, PM, database, auth, payments)
- Template scaffolding (.claude/ directory with commands, skills, hooks, agents)
- 6 plan templates (feature, bugfix, refactor, migration, security, performance)
- Combined `kova run` (plan + approve + build in one step)
- `kova update` with local modification detection (SHA-256 hashing)
- Checkpoint-based progress tracking with crash recovery (--resume)
- Token usage tracking with budget warnings (80%, 95% thresholds)
- Webhook notifications (Discord, Slack, custom) with graceful failure
- Live progress monitoring (--live flag with terminal refresh)
- Cross-platform support (Windows .cmd resolution, atomic writes, glob normalization)
- Auto model selection (haiku/sonnet/opus based on task complexity signals)
- Interactive mode for `kova init` (7-step guided setup via @inquirer/prompts)
- Shell completions (bash, zsh, fish)
- Auto-update check (npm registry, 24h cache, non-blocking)
- Levenshtein-based error suggestions with docs links
- GitHub integration: `kova pr` (auto-PR), `--issue` (fetch issue context), auto-branch creation
- Global error handler with wrapCommandAction on all commands
- 415 passing tests across 25 test files, 0 flaky

### Website (Complete)

- Next.js 15 + Fumadocs + Tailwind CSS + Framer Motion
- 9-section landing page with 14 cult-ui animated components
- 26 MDX documentation pages (Getting Started, Commands, Guides, Reference)
- Wolf mascot with eye pulse animation and scroll parallax
- Section reveal animations on scroll
- Copy-to-clipboard install command
- Mobile hamburger navigation
- Dynamic OG image generation (Vercel OG)
- Fumadocs dark theme matching Kova palette
- SEO metadata, sitemap, robots.txt

### GitHub Repos

- CLI: https://github.com/lioneltchami/kova-cli
- Website: https://github.com/lioneltchami/kova-website

---

## Completed Tiers

| Tier                       | What                                                                          | Tests Added | Total |
| -------------------------- | ----------------------------------------------------------------------------- | ----------- | ----- |
| Phase 1: MVP               | Project foundation, 7 commands, types, config, checkpoint                     | 92          | 92    |
| Phase 2: Resilience        | Windows atomic writes, subprocess fix, token restore, webhooks, live progress | 64          | 156   |
| Tier 3: Quick Wins         | kova run, 6 plan templates, kova update                                       | 34          | 190   |
| Tier 1: UX Fundamentals    | Interactive mode, shell completions, auto-update, error suggestions           | 112         | 302   |
| Tier 2: GitHub Integration | kova pr, --issue linking, auto-branch creation                                | 113         | 415   |
| Website + Docs             | Landing page (14 components), 26 MDX pages, wolf mascot, OG image             | N/A         | N/A   |

---

## What's Next: Path to Paid Product

The CLI is feature-complete for launch. The focus shifts from building features to monetization. Here is the recommended order:

```
Step 1: Launch & Distribute     -- 1 week    -- IMMEDIATE
Step 2: Payment Infrastructure  -- 1-2 weeks -- Revenue foundation
Step 3: Gated Pro Features      -- 2-3 weeks -- First revenue
Step 4: Web Dashboard (MVP)     -- 3-4 weeks -- Team tier unlock
Step 5: Plugin Ecosystem        -- 3-4 weeks -- Community moat
Step 6: VS Code Extension       -- 3-4 weeks -- Distribution multiplier
```

---

## Step 1: Launch and Distribute (1 week)

Get the product in front of developers. No code changes needed.

### 1.1 npm Publish

- Run `npm publish` on kova-cli
- Verify `npx kova-cli init` works globally
- Add npm badge to README and website

### 1.2 Deploy Website

- Connect kova-website repo to Vercel
- Set up custom domain (kova.dev or similar)
- Verify all pages render, OG image works

### 1.3 Launch Announcements

- GitHub README with clear value prop and install command
- Twitter/X thread showing the terminal animation
- Reddit posts: r/programming, r/webdev, r/node, r/ClaudeAI
- Hacker News "Show HN: Kova -- AI coding orchestration CLI"
- Dev.to article: "How I built Kova: Multi-agent AI orchestration for your codebase"

### 1.4 Community Setup

- Enable GitHub Discussions on kova-cli repo
- Create Discord server (or use GitHub Discussions as primary)
- Set up issue templates (bug report, feature request)

---

## Step 2: Payment Infrastructure (1-2 weeks)

Set up the billing system before building paid features.

### 2.1 Choose Payment Processor

**Recommended: Polar.sh** (built for developer tools, handles license keys)

Alternatives: Stripe (more control), Lemon Squeezy (simpler), Dodo Payments

### 2.2 License Key System

- Users sign up at kova.dev/pricing
- Purchase generates a license key
- CLI validates key: `kova login <key>` stores in `~/.kova/license.json`
- Free tier: no key needed (all current features work)
- Pro tier: key unlocks gated features

### 2.3 Account System

- Add `/pricing` page to kova-website
- Add `/login` and `/signup` pages
- Use Polar.sh hosted checkout or Stripe Checkout
- Webhook handler for subscription events

### 2.4 CLI Auth Command

- `kova login` -- enter license key or open browser for OAuth
- `kova logout` -- clear credentials
- `kova account` -- show plan, usage, renewal date
- License validation: check local cache first, then API (with 24h cache like update-checker)

---

## Step 3: Gated Pro Features (2-3 weeks)

Add features exclusive to paid tiers that justify the price.

### Pricing Model

| Tier           | Price   | What's Included                                                                                          |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| **Free**       | $0/mo   | All current CLI features (11 commands, templates, completions, GitHub integration)                       |
| **Pro**        | $29/mo  | Cloud build history, advanced token analytics, priority model routing, unlimited webhooks, email support |
| **Team**       | $99/mo  | Pro + team shared plans, approval workflows, centralized config, 5 seats                                 |
| **Enterprise** | $299/mo | Team + SSO, audit logs, custom agent definitions, unlimited seats, dedicated support                     |

### Pro-Only Features to Build

**3.1 Cloud Build History** (core Pro feature)

- After each build completes, CLI uploads checkpoint summary to Kova API
- Dashboard shows: all builds, duration, token costs, success rate, trend charts
- Free tier: local-only history (already built via checkpoints)
- Pro tier: cloud sync with dashboard access

**3.2 Advanced Token Analytics**

- Token usage breakdown by: project, model, agent type, time period
- Cost optimization suggestions: "Switch 40% of your sonnet tasks to haiku to save $X/month"
- Free tier: per-build token summary (already built)
- Pro tier: cross-build analytics + optimization

**3.3 Priority Model Routing**

- Pro users get smart model routing: automatically use the fastest available model based on current rate limits
- Queue position priority when Claude is under load
- This is a perceived value feature that justifies the subscription

**3.4 Team Shared Config**

- `extends: "@team/kova-config"` in kova.yaml
- Central config stored in Kova cloud, pulled at init time
- Team admin manages rules, boundaries, agent preferences
- Free tier: local config only
- Team tier: shared cloud config

---

## Step 4: Web Dashboard MVP (3-4 weeks)

The dashboard is where Pro/Team users see the value of their subscription.

### 4.1 Dashboard Architecture

```
kova-website/ (already exists)
  app/
    dashboard/
      layout.tsx         # Authenticated dashboard layout
      page.tsx           # Overview: recent builds, stats
      builds/page.tsx    # Build history list
      builds/[id]/       # Build detail with task breakdown
      analytics/page.tsx # Token usage charts
      settings/page.tsx  # Account, team, API keys
    api/
      builds/route.ts    # CLI uploads build summaries
      auth/route.ts      # License validation
```

### 4.2 Tech Stack

- Next.js 15 (already the website framework)
- Supabase (database + auth + real-time)
- Polar.sh or Stripe for payments
- Recharts or Tremor for analytics charts

### 4.3 Dashboard Pages

- **Overview**: Last 5 builds, total tokens this week, success rate
- **Builds**: Sortable table of all builds with plan name, status, duration, cost
- **Build Detail**: Task-by-task breakdown with agent types, models used, token counts
- **Analytics**: Charts for token usage over time, cost by model, success rate trend
- **Settings**: Account info, API key, team management (Team tier)

---

## Step 5: Plugin Ecosystem (3-4 weeks)

Transforms Kova from a tool into a platform. Creates community moat.

### 5.1 Plugin System

- `kova-plugin-*` npm naming convention
- Plugins export: custom agents, plan templates, quality checks, hooks
- `kova plugin install kova-plugin-nextjs`
- Plugin discovery via npm search or future marketplace

### 5.2 Shared Config

- `extends: "@company/kova-config"` in kova.yaml
- Published as npm packages: `@company/kova-config`
- Merge strategy: plugin config extends, local overrides

### 5.3 Starter Plugins to Build

- `kova-plugin-nextjs` -- Next.js-specific agents and templates
- `kova-plugin-react-native` -- Mobile app templates
- `kova-plugin-python` -- Python/Django/FastAPI support
- `kova-plugin-supabase` -- Supabase-specific migrations and RLS

---

## Step 6: VS Code Extension (3-4 weeks)

63% of Claude Code adoption is IDE-driven. This is the distribution multiplier.

### 6.1 Extension Features

- Sidebar panel: plan board, build progress, status
- Context menu: right-click "Plan with Kova" / "Build with Kova"
- Status bar: build progress icon + percentage
- Integration with dashboard (Pro tier: cloud build history in VS Code)

### 6.2 Distribution

- VS Code Marketplace
- Open VSX Registry (for non-Microsoft editors)
- Bundled with CLI install recommendation

---

## Revenue Projections (Updated)

### Conservative Scenario

| Month | CLI Users | Pro ($29) | Team ($99) | MRR    |
| ----- | --------- | --------- | ---------- | ------ |
| 1     | 200       | 0         | 0          | $0     |
| 3     | 1,000     | 10        | 0          | $290   |
| 6     | 3,000     | 40        | 5          | $1,655 |
| 9     | 7,000     | 100       | 15         | $4,385 |
| 12    | 15,000    | 200       | 40         | $9,760 |

### Optimistic Scenario (with VS Code extension + plugins)

| Month | CLI Users | Pro ($29) | Team ($99) | Enterprise ($299) | MRR     |
| ----- | --------- | --------- | ---------- | ----------------- | ------- |
| 6     | 5,000     | 80        | 10         | 1                 | $3,619  |
| 12    | 25,000    | 400       | 80         | 5                 | $21,115 |

---

## Immediate Next Steps (This Week)

1. **npm publish** -- `cd C:/PROJ/kova-cli && npm publish`
2. **Deploy website** -- Connect to Vercel, set up domain
3. **Write launch post** -- Show HN, Twitter thread, Dev.to article
4. **Set up Polar.sh** -- Create product, pricing tiers, checkout pages
5. **Add `kova login` command** -- License key validation in CLI
6. **Add `/pricing` page** -- To kova-website with Polar checkout links

---

## Risk Assessment (Updated)

| Risk                             | Probability | Impact | Mitigation                                                |
| -------------------------------- | ----------- | ------ | --------------------------------------------------------- |
| Claude Code CLI API changes      | Medium      | High   | Abstract subprocess interface, pin versions               |
| Low initial adoption             | Medium      | High   | Launch on HN + Twitter + Reddit simultaneously            |
| Users won't pay for Pro          | Medium      | High   | Make cloud analytics genuinely valuable; A/B test pricing |
| Competitor launches similar tool | Medium      | Medium | Speed to market + plugin ecosystem as moat                |
| Dashboard costs exceed revenue   | Medium      | Medium | Use Supabase free tier initially; scale only with revenue |
| Churn after free trial           | Medium      | Medium | 14-day free Pro trial, then clear value demonstration     |

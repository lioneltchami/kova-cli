# Kova Launch Checklist

Everything is built. This document walks you through the manual steps to go live with Kova as a paid product.

---

## Prerequisites

Before starting, ensure you have:

- Node.js 18+ installed (check: `node --version`)
- npm account (create at npmjs.com if you don't have one)
- GitHub account with push access to lioneltchami/kova-cli and lioneltchami/kova-website
- Supabase instance (self-hosted on your VPS, already running)
- Polar.sh account (create at polar.sh)
- Vercel account (create at vercel.com, free tier works fine)
- A domain name (kova.dev recommended, optional but recommended for professional appearance)
- Local git clone of both repositories with main branch pulled

---

## Step 1: Run the Database Migration

Your Supabase instance needs the Kova tables. The migration file is ready at:

```
C:/PROJ/kova-website/supabase/migrations/001_kova_schema.sql
```

### How to Apply the Migration

1. Open your Supabase dashboard (your self-hosted instance URL)
2. Navigate to SQL Editor
3. Open the file: `C:/PROJ/kova-website/supabase/migrations/001_kova_schema.sql`
4. Copy the ENTIRE contents
5. Go back to Supabase SQL Editor and paste it
6. Click "Run" and wait for completion

### Verify the Migration

After running, confirm these tables exist in your public schema:

- `profiles` (stores user profile info, auto-created on signup)
- `builds` (stores build metadata and results)
- `build_tasks` (stores individual tasks within builds)
- `subscriptions` (stores Polar subscription info)

And this table in the private schema:

- `api_keys` (stores bcrypt-hashed API keys for CLI authentication)

All tables should have Row Level Security (RLS) policies enabled.

This migration creates:

- 5 core tables with proper indexing
- Auto-profile creation trigger (creates a profile row when a user signs up)
- API key verification functions (bcrypt hashing for security)
- Indexes for fast dashboard queries

---

## Step 2: Configure GitHub OAuth in Supabase

The website uses GitHub OAuth for authentication. You must configure this in your Supabase instance.

### Create a GitHub OAuth Application

1. Go to github.com/settings/developers
2. Click "OAuth Apps" in the left sidebar
3. Click "New OAuth App"
4. Fill in the form:
   - **Application name**: Kova
   - **Homepage URL**: https://kova.dev (or your custom domain)
   - **Application description**: AI coding orchestration CLI
   - **Authorization callback URL**: `https://YOUR_SUPABASE_URL/auth/v1/callback`
     - Replace YOUR_SUPABASE_URL with your actual Supabase instance URL (e.g., https://kova.supabase.co)
5. Click "Register application"
6. You'll see the Client ID. Click "Generate a new client secret"
7. Copy both the Client ID and Client Secret (keep them safe)

### Add to Supabase

1. Open your Supabase dashboard
2. Go to Authentication > Providers
3. Find GitHub and toggle it ON
4. Paste the Client ID and Client Secret you copied
5. Click Save

GitHub OAuth is now configured. Users can log in to the website with their GitHub account.

---

## Step 3: Set Up Polar.sh for Payments

Polar.sh handles all subscription and payment processing.

### Create a Polar Account and Organization

1. Go to polar.sh
2. Sign up for an account
3. After signing in, create an organization (e.g., "kova")
4. Note your Organization ID (visible in Settings or the URL bar)

### Create Products

You need 4 products in Polar representing the pricing tiers:

1. **Kova Pro Monthly**
   - Price: $29/month
   - Recurrence: Monthly
   - Metadata: `{ "plan": "pro" }`

2. **Kova Pro Annual**
   - Price: $276/year ($23/month equivalent)
   - Recurrence: Yearly
   - Metadata: `{ "plan": "pro" }`

3. **Kova Team Monthly**
   - Price: $99/month
   - Recurrence: Monthly
   - Metadata: `{ "plan": "team" }`

4. **Kova Team Annual**
   - Price: $948/year ($79/month equivalent)
   - Recurrence: Yearly
   - Metadata: `{ "plan": "team" }`

For each product, add the metadata in Polar's product settings (usually in JSON format). This metadata links the product to your plan levels in the database.

### Generate API Credentials

1. Go to Polar Settings > Developers
2. Click "New Token"
   - Name: "Kova Website"
   - Permissions: Read and write subscriptions/orders
3. Copy the access token immediately (you won't see it again)
4. Keep it safe; you'll add it to environment variables in Step 4

### Set Up Webhooks

1. Still in Polar Settings > Webhooks
2. Click "Create Endpoint"
3. Configure:
   - **URL**: `https://YOUR_DOMAIN/api/webhooks/polar`
     - Replace YOUR_DOMAIN with your Vercel deployment URL (from Step 4)
     - If you don't have it yet, come back to this after Step 4
   - **Events to subscribe to**:
     - subscription.created
     - subscription.updated
     - subscription.canceled
     - subscription.revoked
     - order.created
     - order.paid
4. Click "Create"
5. Polar will show a webhook secret (signing key). Copy this; you'll need it for environment variables.

Record these three values for Step 4:

- POLAR_ACCESS_TOKEN
- POLAR_WEBHOOK_SECRET
- POLAR_ORG_ID

---

## Step 4: Deploy the Website to Vercel

The website (landing page, docs, dashboard, pricing) runs on Vercel.

### Import the Repository

1. Go to vercel.com and sign in with GitHub
2. Click "Add New..." then "Project"
3. Click "Import Git Repository"
4. Search for and select `lioneltchami/kova-website`
5. Click Import

### Configure Environment Variables

On the environment setup page, add these variables:

| Variable                        | Value                                                       |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase instance URL (e.g., https://kova.supabase.co) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase > Settings > API > anon public key            |
| `SUPABASE_SERVICE_ROLE_KEY`     | From Supabase > Settings > API > service_role key           |
| `POLAR_ACCESS_TOKEN`            | From Step 3                                                 |
| `POLAR_WEBHOOK_SECRET`          | From Step 3                                                 |
| `POLAR_ORG_ID`                  | From Step 3                                                 |
| `NEXT_PUBLIC_APP_URL`           | Your Vercel deployment URL (e.g., https://kova.vercel.app)  |

### Deploy

1. Click "Deploy"
2. Wait for the build to complete (usually 2-5 minutes)
3. Vercel will show you a URL like `https://kova.vercel.app`
4. Copy this URL for Step 3 webhook setup (if you haven't done it yet)

### Verify the Deployment

Once deployed, test:

1. Visit `https://your-domain.vercel.app/` (landing page should load with Wolf mascot)
2. Visit `https://your-domain.vercel.app/docs` (documentation should load)
3. Visit `https://your-domain.vercel.app/login` (should show "Sign in with GitHub" button)
4. Visit `https://your-domain.vercel.app/pricing` (should show 4 pricing tiers)

### Optional: Add Custom Domain

If you have a custom domain (e.g., kova.dev):

1. In Vercel > Project Settings > Domains
2. Click "Add Domain"
3. Enter your domain (e.g., kova.dev)
4. Follow Vercel's DNS configuration instructions (depends on your DNS provider)
5. Point your domain's DNS to Vercel's nameservers or add CNAME records as instructed

---

## Step 5: Update Polar Webhook URL (If Needed)

If you skipped this in Step 3, go back now:

1. Open Polar dashboard > Settings > Webhooks
2. Find the endpoint you created
3. Edit it and set the URL to: `https://YOUR_DOMAIN/api/webhooks/polar`
4. Save

---

## Step 6: Publish the CLI to npm

The CLI tool is published to npmjs.com so users can install it globally.

### Prerequisites

- npm account (create at npmjs.com if needed)
- Local copy of kova-cli repository with git main branch pulled

### Publish Steps

1. Open a terminal and navigate to the CLI project:

   ```bash
   cd C:/PROJ/kova-cli
   ```

2. Verify you're logged in to npm:

   ```bash
   npm whoami
   ```

   - If not logged in, run: `npm login`

3. Build the project:

   ```bash
   npm run build
   ```

   - This compiles TypeScript to JavaScript in the `dist/` folder

4. Run tests one final time to ensure everything works:

   ```bash
   npm test
   ```

   - All 415 tests should pass

5. Publish to npm:

   ```bash
   npm publish
   ```

   - This publishes version 0.1.0 (from package.json) to npmjs.com

6. Verify the publish:

   ```bash
   npm info kova-cli
   ```

   - Should show version 0.1.0 with your user as the author

7. Test installation globally:

   ```bash
   npm install -g kova-cli
   kova --version
   ```

   - Should output: `0.1.0`

8. Verify on npmjs.com:
   - Visit npmjs.com/package/kova-cli
   - Your package should be publicly visible

---

## Step 7: Update CLI Dashboard URL (If Using Custom Domain)

The CLI currently points to `https://kova.dev/api/v1` as the default dashboard URL. If your deployment uses a different domain (e.g., `https://kova.vercel.app`), update the CLI:

1. Open `C:/PROJ/kova-cli/src/lib/constants.ts`
2. Find the `DASHBOARD_API_URL` constant
3. Update it to your actual domain:
   ```typescript
   export const DASHBOARD_API_URL = "https://YOUR_DOMAIN/api/v1";
   ```
4. Rebuild and republish:
   ```bash
   cd C:/PROJ/kova-cli
   npm run build
   npm publish
   ```

**Note**: Users can also override the dashboard URL locally with:

```bash
kova config set dashboardUrl https://your-custom-url
```

---

## Step 8: Test the Full Flow End-to-End

Now test that everything works together: CLI, website, authentication, builds, payments.

### Test User Authentication

1. Visit your website at `https://your-domain.vercel.app`
2. Click "Sign in with GitHub"
3. Authorize the GitHub OAuth application
4. You should be redirected to the dashboard at `/dashboard`
5. You should see a profile page with your GitHub username

### Test API Key Generation

1. In the dashboard, go to Settings
2. Click "Create New API Key"
3. Copy the key (you'll use it next)
4. This key is hashed and stored in the `api_keys` table

### Test CLI Installation and Authentication

1. Install the CLI (if you haven't):

   ```bash
   npm install -g kova-cli
   ```

2. In a new project directory, initialize:

   ```bash
   cd any-test-project
   kova init
   ```

   - Answer the prompts (or accept defaults)

3. Authenticate the CLI with your API key:

   ```bash
   kova login YOUR_API_KEY_HERE
   ```

   - The key is stored in `~/.kova/config.yaml`

4. Verify authentication worked:
   ```bash
   kova account
   ```

   - Should display your user info and subscription plan (free for new accounts)

### Test Build Creation

1. Create a test build:

   ```bash
   kova plan "Add test feature"
   ```

   - This creates a plan and prompts for approval

2. Once approved, run:

   ```bash
   kova build
   ```

   - This executes the build with Claude

3. Check the dashboard:
   - Visit `/dashboard/builds`
   - Your build should appear in the list with status and timestamps

### Test Subscription/Pricing

1. Go to the pricing page: `https://your-domain.vercel.app/pricing`
2. Click "Subscribe" on any tier
3. You should be redirected to Polar's checkout page
4. Complete a test transaction (use Stripe test card: 4242 4242 4242 4242, expiry: any future date, CVC: any 3 digits)
5. After payment, check your Supabase `subscriptions` table:
   - A new subscription record should exist with Polar's subscription ID

---

## Step 9: Launch Announcements

You're ready to announce Kova to the world. Here are suggested channels and templates:

### Hacker News (Show HN)

Best time: 9am-12pm EST on a weekday

**Title**: "Show HN: Kova -- AI coding orchestration CLI with 17+ specialist agents"

**Template**:

```
I spent the last 3 months building Kova, an open-source CLI that orchestrates
17+ AI specialist agents to plan, build, and ship code in minutes.

The problem: Single-agent AI coding tools lack planning and architectural insight.
They can't break down complex features or coordinate cross-domain work.

The solution: Kova uses multi-agent orchestration. You describe what you want,
Kova creates a detailed plan, then runs specialist agents (frontend, backend,
database, testing) in parallel. Built-in GitHub integration auto-creates PRs.

Features:
- 11 CLI commands (plan, build, team-build, pr, status, etc.)
- 6 plan templates (feature, bugfix, refactor, migration, security, perf)
- Checkpoint-based progress tracking with crash recovery
- Webhook notifications (Discord, Slack)
- Token usage tracking with budget warnings
- Shell completions (bash, zsh, fish)
- Cross-platform (Windows, Mac, Linux)

Get started: npm install -g kova-cli
Website: https://kova.dev
Docs: https://kova.dev/docs
Open source: https://github.com/lioneltchami/kova-cli
```

### Twitter/X Thread

**Tweet 1** (Hook):

```
I built Kova: an open-source AI coding orchestration CLI that uses 17+ specialist
agents to plan, build, and ship code.

Single-agent AI tools are cool but limited. Kova fixes that.

A thread on why AI coding needs orchestration:
```

**Tweet 2** (The Problem):

```
Most AI coding tools use a single agent to do everything:
- Claude reads your prompt
- Generates a plan (usually shallow)
- Writes code
- No specialization, no real planning

Result: Plans are incomplete. Code doesn't integrate. Features break things.
```

**Tweet 3** (The Solution):

```
Kova uses multi-agent orchestration:

1. Specialist agents for different domains (frontend, backend, DB, DevOps, security)
2. Dependency-aware execution (some tasks run in parallel, others wait)
3. Contract-first design (agents coordinate via interfaces)
4. Built-in GitHub PR creation

The result: Faster, better code. Fewer bugs. Real planning.
```

**Tweet 4** (The Demo):

```
Here's how it works:

$ kova plan "Add user authentication with OAuth"
(Kova creates a detailed multi-phase plan)

$ kova build
(Specialists execute in parallel: frontend, backend, database, tests)

$ kova pr
(Auto-creates a GitHub PR with your changes)

Clip: [GIF showing kova plan -> kova build -> kova pr]
```

**Tweet 5** (The Call to Action):

```
It's free, open source, and MIT licensed.

Install: npm install -g kova-cli
Docs: https://kova.dev/docs
GitHub: https://github.com/lioneltchami/kova-cli

Tell me what you think. Issues and PRs welcome.
```

### Reddit

Post to multiple subreddits (one post per subreddit, adapted slightly for each community):

**Subreddits**: r/programming, r/webdev, r/node, r/ClaudeAI, r/LanguageModels, r/OpenSource

**Title**: "I built Kova: open-source AI orchestration CLI that runs 17+ specialist agents to plan and build code"

**Template**:

```
Hi everyone,

I just launched Kova, an open-source CLI tool that solves a real problem I ran
into: single-agent AI coding tools lack planning and can't coordinate complex
multi-domain work.

Kova uses Claude to orchestrate 17+ specialist agents (frontend, backend,
database, testing, DevOps, security, etc.) to plan and build features in parallel.

Key features:
- Multi-agent orchestration with dependency-aware execution
- 6 plan templates (feature, bugfix, refactor, migration, security, perf)
- Checkpoint-based progress tracking (resume from crashes)
- Webhook notifications (Discord, Slack, custom)
- Built-in GitHub integration (auto-PR creation)
- 11 CLI commands covering the full workflow
- 415 passing tests, cross-platform (Windows, Mac, Linux)

Install: npm install -g kova-cli
Website: https://kova.dev
GitHub: https://github.com/lioneltchami/kova-cli

Feedback welcome. Issues and PRs are open.
```

### Dev.to Article

Title: "How I Built Kova: Multi-Agent AI Coding Orchestration"

Structure:

1. The problem (single-agent limitations)
2. The solution (Kova's architecture)
3. A walkthrough (how to use kova plan -> kova build)
4. Key features and differentiators
5. Open source contribution invitation
6. Links to website, GitHub, npm

---

## Step 10: Monitor After Launch

After launch, monitor these metrics:

### npm Package

- **Downloads**: Run `npm info kova-cli` or visit npmjs.com/package/kova-cli
- **Daily active**: Should trend upward after announcements
- **Issues/PRs**: Check GitHub for bug reports

### Website Analytics

- Vercel automatically tracks analytics:
  - Go to Vercel > Project > Analytics
  - Monitor page views, unique visitors, top pages
  - Focus on `/pricing` and `/docs/getting-started`

### Dashboard Signups

- Query your Supabase: `SELECT COUNT(*) FROM profiles`
- Track weekly growth
- Monitor profile creation timestamps

### Subscriptions

- Query: `SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`
- Track MRR (Monthly Recurring Revenue)
- Monitor subscription plan distribution

### CLI Usage

- Monitor GitHub releases and issues
- Check npm download trends at npmjs.com/package/kova-cli
- Collect feedback from GitHub Discussions

### Error Monitoring

- Check Vercel function logs for API errors:
  - Vercel > Project > Functions > Logs
  - Look for `/api/webhooks/polar` and `/api/builds` errors
- Set up alerting on critical errors (500s, webhook failures)

### GitHub Activity

- Watch your repository for issues and PRs
- Respond to feedback and bug reports quickly
- Track GitHub stars at github.com/lioneltchami/kova-cli

---

## Quick Reference: All URLs and IDs

### Production URLs

| What                   | URL                                          |
| ---------------------- | -------------------------------------------- |
| CLI npm package        | npmjs.com/package/kova-cli                   |
| Website (after deploy) | https://your-domain.vercel.app               |
| Dashboard              | https://your-domain.vercel.app/dashboard     |
| Pricing                | https://your-domain.vercel.app/pricing       |
| Documentation          | https://your-domain.vercel.app/docs          |
| GitHub CLI repo        | https://github.com/lioneltchami/kova-cli     |
| GitHub Website repo    | https://github.com/lioneltchami/kova-website |
| Polar dashboard        | https://polar.sh/your-org                    |
| Supabase dashboard     | Your self-hosted instance URL                |

### Environment Variables Quick Reference

| Variable                      | Where to Get                            | Example                  |
| ----------------------------- | --------------------------------------- | ------------------------ |
| NEXT_PUBLIC_SUPABASE_URL      | Supabase Settings > API                 | https://kova.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Settings > API > anon key      | eyJhbGci...              |
| SUPABASE_SERVICE_ROLE_KEY     | Supabase Settings > API > service_role  | eyJhbGci...              |
| POLAR_ACCESS_TOKEN            | Polar Settings > Developers > New Token | pauth\_...               |
| POLAR_WEBHOOK_SECRET          | Polar Settings > Webhooks > Secret      | whsec\_...               |
| POLAR_ORG_ID                  | Polar Settings or URL                   | org_xxx                  |
| NEXT_PUBLIC_APP_URL           | Your Vercel deployment URL              | https://kova.vercel.app  |

### Supabase Keys Location

- Supabase Dashboard > Project Settings > API
  - anon public key: Use for NEXT_PUBLIC_SUPABASE_ANON_KEY
  - service_role key: Use for SUPABASE_SERVICE_ROLE_KEY
  - Project URL: Use for NEXT_PUBLIC_SUPABASE_URL

---

## What's Already Built (Don't Rebuild These)

The following are complete and production-ready. Do not modify or rebuild unless fixing a bug:

**CLI Tool (Complete, v0.1.0)**

- 11 commands: init, plan, run, build, team-build, pr, status, config, update, completions, version
- 6 plan templates (feature, bugfix, refactor, migration, security, performance)
- Auto-project detection (language, framework, package manager, database, auth, payments)
- 415 passing tests with 0 flaky tests
- Checkpoint-based progress tracking with resume capability
- Token usage tracking with budget warnings
- Webhook notifications (Discord, Slack, custom)
- GitHub integration (auto-PR, issue context, auto-branch)
- Shell completions (bash, zsh, fish)
- Cross-platform support (Windows, Mac, Linux)

**Website (Complete, Next.js 15)**

- 9-section landing page with 14 cult-ui animated components
- 26 MDX documentation pages (Getting Started, Commands, Guides, Reference)
- Wolf mascot with eye pulse animation and scroll parallax
- Section reveal animations on scroll
- 5-page dashboard (overview, builds, build detail, analytics, settings)
- Pricing page with 4 tiers
- GitHub OAuth login integration
- Polar.sh subscription webhook handler
- Dark theme matching Kova brand
- Mobile responsive hamburger navigation
- Copy-to-clipboard install command
- Dynamic OG image generation
- SEO metadata, sitemap, robots.txt

**Database (Complete, SQL Migration)**

- 5 core tables: profiles, builds, build_tasks, subscriptions, api_keys
- RLS policies for security
- Auto-profile creation trigger
- Bcrypt-hashed API key storage
- Indexes for performance

Do not modify these unless you find a bug that needs fixing. The entire product is ready to launch.

---

## Troubleshooting

### Issue: "API key is invalid" when running `kova login`

**Cause**: The API key stored in Supabase doesn't match the one you're trying to use.

**Solution**:

1. Generate a new API key in the dashboard (Settings > API Keys)
2. Run `kova login YOUR_NEW_KEY`
3. Verify: `kova account`

### Issue: Polar webhooks not firing / subscriptions not syncing

**Cause**: Webhook endpoint URL is incorrect or webhook signing secret doesn't match.

**Solution**:

1. In Polar dashboard, verify the webhook URL is exactly: `https://YOUR_DOMAIN/api/webhooks/polar`
2. Verify POLAR_WEBHOOK_SECRET in Vercel environment matches Polar's webhook secret
3. Redeploy Vercel to pick up updated env vars: `vercel --prod` or redeploy from dashboard
4. Test by creating a new subscription

### Issue: GitHub OAuth "Invalid callback URL"

**Cause**: The callback URL in GitHub OAuth settings doesn't match Supabase's requirement.

**Solution**:

1. Go to github.com/settings/developers > OAuth Apps > Your App
2. Edit the app
3. Verify "Authorization callback URL" is exactly: `https://YOUR_SUPABASE_URL/auth/v1/callback`
4. Save

### Issue: "Failed to fetch" when visiting dashboard after login

**Cause**: SUPABASE_SERVICE_ROLE_KEY or other backend env vars are missing in Vercel.

**Solution**:

1. Go to Vercel > Project > Settings > Environment Variables
2. Verify all variables from Step 4 are set correctly
3. Redeploy: `vercel --prod`
4. Clear browser cache and try again

### Issue: npm publish fails with permission error

**Cause**: You're not the owner of the package name on npm, or you're not logged in.

**Solution**:

1. Verify you're logged in: `npm whoami`
2. If not, log in: `npm login`
3. If the package already exists and you don't own it, use a different name in package.json
4. Try publishing again: `npm publish`

### Issue: CLI doesn't auto-update on `npm install -g kova-cli`

**Cause**: Global npm cache is stale.

**Solution**:

```bash
npm cache clean --force
npm install -g kova-cli@latest
kova --version
```

---

## Post-Launch Checklist (First Week)

After your launch, use this checklist to ensure everything stays healthy:

- [ ] Monitor npm downloads (npmjs.com/package/kova-cli)
- [ ] Check website analytics (Vercel)
- [ ] Review GitHub issues and respond to bugs within 24 hours
- [ ] Test the full flow (login > create API key > CLI login > build)
- [ ] Monitor Vercel function logs for errors
- [ ] Check Polar dashboard for new subscriptions
- [ ] Query Supabase for new signups and builds
- [ ] Test Stripe webhook with Polar's test mode
- [ ] Verify email notifications are sending (from send-email function)
- [ ] Respond to feedback on Reddit, Twitter, HN

---

## Success Criteria

You've successfully launched Kova when:

1. CLI is published on npm and installable globally (`npm install -g kova-cli`)
2. Website is live and all pages load (landing, docs, dashboard, pricing)
3. Users can sign in with GitHub OAuth
4. Users can generate API keys in the dashboard
5. CLI authentication works (`kova login` stores key and `kova account` shows user)
6. Builds appear in the dashboard after running `kova build`
7. Stripe test payments work on the pricing page
8. Polar webhooks sync subscriptions to Supabase
9. GitHub stars and social mentions are flowing in
10. You've published to at least 2 announcement channels (HN, Twitter, Reddit)

Once all 10 are complete, Kova is officially live as a paid product.

---

## Next Steps (Post-Launch)

After launch, consider these improvements:

- Add Sentry error tracking (currently initialized but not wired up)
- Implement email notifications for builds (Edge Function exists but not connected)
- Add team/organization features (database schema supports it)
- Build admin dashboard (for managing users, subscriptions, abuse)
- Add more plan templates (more specific to user feedback)
- Expand documentation (tutorials, best practices, case studies)
- Build Discord bot (for webhook notifications integration)
- Add CI/CD checks (GitHub Actions for npm publish safety)
- Performance optimizations (TanStack Query for dashboard caching)
- Internationalization (i18n for non-English users)

---

## Emergency Contacts and Escalation

If something breaks on launch:

1. **CLI not installing**: Check npm publish worked. Run `npm publish` again if needed.
2. **Website down**: Check Vercel deployment status and redeploy from dashboard.
3. **Auth broken**: Check GitHub OAuth callback URL and Supabase settings.
4. **Payments broken**: Check Polar webhook endpoint and signing secret.
5. **Database issues**: Check Supabase migration ran completely; re-run if needed.

For urgent issues:

- Check Vercel logs: Vercel > Project > Functions > Logs
- Check Supabase logs: Supabase > Logs > Edge Functions
- Check Polar webhooks: Polar > Webhooks > Delivery Logs

---

Good luck launching Kova. You've built something great.

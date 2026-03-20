# Plan: Kova Launch Preparation and Payment Infrastructure

## Task Description

Prepare both the kova-cli npm package and kova-website for public launch, then implement the payment infrastructure using Polar.sh: a `kova login` / `kova logout` / `kova account` command set in the CLI with license key validation and 7-day caching, a `/pricing` page on the website with Free/Pro/Team/Enterprise tiers, and a feature gating module ready for Step 3. This combines Steps 1 and 2 from the roadmap into a single implementation.

## Objective

Deliver: (1) a publish-ready npm package with correct metadata and clean `.npmignore`, (2) three new CLI commands (`login`, `logout`, `account`) with Polar.sh license validation, (3) a `license.ts` module with 7-day cached validation matching the update-checker.ts pattern, (4) a `gate.ts` module for future feature gating, (5) a `/pricing` page on the website with tier cards and checkout links, (6) updated navbar with Pricing link. All 415 existing tests must pass with 25+ new tests.

## Problem Statement

Kova has 415 tests, 11 commands, a full website, and documentation -- but no way to generate revenue. The CLI needs license key validation infrastructure so paid features can be gated in Step 3. The website needs a pricing page so users can see tiers and purchase. The npm package needs correct metadata for a professional first impression on npmjs.com.

## Solution Approach

**Payment processor**: Polar.sh. Their license key validation endpoint (`POST /v1/customer-portal/license-keys/validate`) requires no authentication from the client, making it perfect for CLI tools. License keys are generated automatically on checkout. The 4% + $0.40 fee includes Merchant of Record (tax compliance handled).

**License validation pattern**: Mirror the existing `update-checker.ts` pattern exactly -- cache validation result in `~/.kova/license.json` for 7 days, revalidate online when cache expires, graceful offline (allow usage if cache is valid but network unavailable).

**Feature gating**: A `gate.ts` module that checks license status before allowing Pro features. For Step 1+2, nothing is gated -- the infrastructure is just ready. A subtle "Upgrade to Pro" message appears after builds.

**Pricing page**: Static page on kova-website with 4 tier cards matching the roadmap pricing ($0 / $29 / $99 / $299). Checkout buttons link to Polar.sh hosted checkout (placeholder URLs until Polar account is configured).

## Relevant Files

### CLI: Existing Files to Modify (C:/PROJ/kova-cli/)

- `package.json` -- Add repository, homepage, bugs, author fields
- `src/index.ts` -- Register login, logout, account commands
- `src/lib/completions.ts` -- Add login, logout, account to command registry
- `src/types.ts` -- Add LicenseInfo and LicenseValidation types
- `src/commands/build.ts` -- Add subtle Pro upsell message after builds

### CLI: New Files to Create

- `.npmignore` -- Exclude tests, .claude/, docs/ from npm package
- `src/lib/license.ts` -- License key storage, validation, caching (core module)
- `src/lib/gate.ts` -- Feature gating module (requirePro, isPro)
- `src/commands/login.ts` -- `kova login <key>` command
- `src/commands/logout.ts` -- `kova logout` command
- `src/commands/account.ts` -- `kova account` command (show plan info)
- `tests/license.test.ts` -- Unit tests for license module
- `tests/gate.test.ts` -- Unit tests for gating module
- `tests/auth-integration.test.ts` -- Integration test for login/logout/account flow

### Website: Existing Files to Modify (C:/PROJ/kova-website/)

- `components/landing/navbar.tsx` -- Add "Pricing" link
- `components/landing/footer.tsx` -- Add "Pricing" link to Product section

### Website: New Files to Create

- `app/pricing/page.tsx` -- Pricing page with tier cards

## Implementation Phases

### Phase 1: Foundation

Package metadata, .npmignore, types, and the license.ts core module.

### Phase 2: Core Implementation

Login/logout/account commands, gate.ts module, pricing page, navbar updates.

### Phase 3: Testing & Polish

Tests for all new modules, verify existing tests pass, final build verification for both projects.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-cli-foundation
  - Role: Update package.json metadata, create .npmignore, add types, build license.ts and gate.ts modules
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-cli-commands
  - Role: Build login.ts, logout.ts, account.ts commands, update index.ts and completions.ts, add Pro upsell to build.ts
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: builder-website
  - Role: Build /pricing page on kova-website, update navbar and footer with Pricing link
  - Agent Type: frontend-specialist
  - Resume: false

- Specialist
  - Name: builder-tests
  - Role: Write all tests for license, gate, and auth integration
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

### 1. Package Metadata and License Module Foundation

- **Task ID**: cli-foundation
- **Depends On**: none
- **Assigned To**: builder-cli-foundation
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/package.json, C:/PROJ/kova-cli/src/types.ts, C:/PROJ/kova-cli/src/lib/update-checker.ts (for caching pattern), C:/PROJ/kova-cli/src/lib/constants.ts

**Step 1: Update package.json** -- add these fields:

```json
{
  "author": "Lionel Tchami",
  "repository": {
    "type": "git",
    "url": "https://github.com/lioneltchami/kova-cli.git"
  },
  "homepage": "https://github.com/lioneltchami/kova-cli#readme",
  "bugs": {
    "url": "https://github.com/lioneltchami/kova-cli/issues"
  }
}
```

**Step 2: Create .npmignore** at C:/PROJ/kova-cli/.npmignore:

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

**Step 3: Add types to src/types.ts** -- append at the end:

```typescript
// License and payment types
export interface LicenseInfo {
  key: string;
  plan: "free" | "pro" | "team" | "enterprise";
  status: "active" | "expired" | "canceled" | "invalid";
  customerEmail: string | null;
  expiresAt: string | null;
  validatedAt: string;
}

export interface LicenseCache {
  license: LicenseInfo;
  cachedAt: string;
}
```

**Step 4: Build src/lib/license.ts** -- the core license module. Follow the EXACT same caching pattern as update-checker.ts:

```typescript
import fs from "fs";
import os from "os";
import path from "path";
import * as logger from "./logger.js";
import type { LicenseInfo, LicenseCache } from "../types.js";

// Polar.sh organization ID -- placeholder until Polar account is created
const POLAR_ORG_ID = "POLAR_ORG_ID_PLACEHOLDER";
const VALIDATE_URL =
  "https://api.polar.sh/v1/customer-portal/license-keys/validate";

export function getLicensePath(): string {
  return path.join(os.homedir(), ".kova", "license.json");
}

export function storeLicense(info: LicenseInfo): void {
  const dir = path.dirname(getLicensePath());
  fs.mkdirSync(dir, { recursive: true });
  const cache: LicenseCache = {
    license: info,
    cachedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getLicensePath(), JSON.stringify(cache, null, 2), "utf-8");
}

export function readLicense(): LicenseCache | null {
  try {
    const raw = fs.readFileSync(getLicensePath(), "utf-8");
    return JSON.parse(raw) as LicenseCache;
  } catch {
    return null;
  }
}

export function removeLicense(): void {
  try {
    fs.unlinkSync(getLicensePath());
  } catch {
    // File may not exist, that's fine
  }
}

export function isCacheValid(cache: LicenseCache): boolean {
  const cachedAt = new Date(cache.cachedAt).getTime();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return now - cachedAt < sevenDays;
}

export function isLicenseExpired(license: LicenseInfo): boolean {
  if (!license.expiresAt) return false;
  return new Date(license.expiresAt).getTime() < Date.now();
}

export async function validateLicenseOnline(
  key: string,
): Promise<LicenseInfo | null> {
  try {
    const response = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        organization_id: POLAR_ORG_ID,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        key,
        plan: "free",
        status: "invalid",
        customerEmail: null,
        expiresAt: null,
        validatedAt: new Date().toISOString(),
      };
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Map Polar response to LicenseInfo
    // Polar returns: { id, key, status, expires_at, customer: { email }, benefit: { ... } }
    const plan = determinePlan(data);

    return {
      key,
      plan,
      status: "active",
      customerEmail:
        ((data["customer"] as Record<string, unknown>)?.["email"] as
          | string
          | null) ?? null,
      expiresAt: (data["expires_at"] as string | null) ?? null,
      validatedAt: new Date().toISOString(),
    };
  } catch {
    return null; // Network error -- graceful offline
  }
}

function determinePlan(
  data: Record<string, unknown>,
): "free" | "pro" | "team" | "enterprise" {
  // Map Polar benefit/product metadata to plan tier
  // This will be configured when Polar products are created
  const metadata = data["metadata"] as Record<string, unknown> | undefined;
  const plan = metadata?.["plan"] as string | undefined;
  if (plan === "enterprise") return "enterprise";
  if (plan === "team") return "team";
  if (plan === "pro") return "pro";
  return "pro"; // Default to pro for any valid license
}

export async function isProUser(): Promise<boolean> {
  const cached = readLicense();

  // No license stored -- free user
  if (!cached) return false;

  // Check if license is expired
  if (isLicenseExpired(cached.license)) return false;

  // Check if license is active
  if (cached.license.status !== "active") return false;

  // If cache is still valid (within 7 days), trust it
  if (isCacheValid(cached)) {
    return cached.license.plan !== "free";
  }

  // Cache expired -- revalidate online
  const validated = await validateLicenseOnline(cached.license.key);
  if (validated) {
    storeLicense(validated);
    return validated.status === "active" && validated.plan !== "free";
  }

  // Network failed but we have a cached license -- allow usage (grace period)
  logger.debug("Could not revalidate license online. Using cached validation.");
  return cached.license.plan !== "free";
}

export function getLicenseInfo(): LicenseInfo | null {
  const cached = readLicense();
  if (!cached) return null;
  return cached.license;
}
```

**Step 5: Build src/lib/gate.ts** -- feature gating module:

```typescript
import * as logger from "./logger.js";
import { isProUser, getLicenseInfo } from "./license.js";

export async function requirePro(featureName: string): Promise<void> {
  const isPro = await isProUser();
  if (!isPro) {
    logger.error(`"${featureName}" requires a Pro subscription.`);
    logger.info("Upgrade at: https://kova.dev/pricing");
    logger.info("Already have a key? Run: kova login <your-key>");
    process.exitCode = 1;
    throw new Error(`Pro feature required: ${featureName}`);
  }
}

export async function isPro(): Promise<boolean> {
  return isProUser();
}

export function showProUpsell(): void {
  const license = getLicenseInfo();
  if (!license || license.plan === "free") {
    logger.info("");
    logger.info("  Upgrade to Pro for cloud build analytics: kova.dev/pricing");
  }
}
```

- Run `cd C:/PROJ/kova-cli && npm run build` to verify compilation
- Run `npm test` to verify 415 existing tests pass
- Run `npm pack --dry-run` to verify .npmignore works (tests/ and .claude/ excluded)

### 2. Build Login, Logout, Account Commands

- **Task ID**: build-auth-commands
- **Depends On**: cli-foundation
- **Assigned To**: builder-cli-commands
- **Agent Type**: backend-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/src/lib/license.ts, C:/PROJ/kova-cli/src/lib/gate.ts, C:/PROJ/kova-cli/src/index.ts, C:/PROJ/kova-cli/src/lib/completions.ts, C:/PROJ/kova-cli/src/commands/build.ts

**Build src/commands/login.ts**:

```typescript
import * as logger from "../lib/logger.js";
import { validateLicenseOnline, storeLicense } from "../lib/license.js";

export async function loginCommand(key?: string): Promise<void> {
  if (!key || key.trim() === "") {
    logger.error("Please provide a license key.");
    logger.info("Usage: kova login <license-key>");
    logger.info("Get a key at: https://kova.dev/pricing");
    process.exit(1);
  }

  logger.info("Validating license key...");

  const result = await validateLicenseOnline(key.trim());

  if (!result) {
    logger.error(
      "Could not validate license key. Check your network connection and try again.",
    );
    process.exit(1);
  }

  if (result.status === "invalid") {
    logger.error("Invalid license key. Check your key and try again.");
    logger.info("Get a key at: https://kova.dev/pricing");
    process.exit(1);
  }

  storeLicense(result);

  logger.success(`Logged in successfully!`);
  logger.table([
    ["plan", result.plan],
    ["email", result.customerEmail ?? "(none)"],
    ["expires", result.expiresAt ?? "never"],
  ]);
}
```

**Build src/commands/logout.ts**:

```typescript
import * as logger from "../lib/logger.js";
import { removeLicense, readLicense } from "../lib/license.js";

export async function logoutCommand(): Promise<void> {
  const cached = readLicense();
  if (!cached) {
    logger.info("Not logged in. Nothing to do.");
    return;
  }

  removeLicense();
  logger.success("Logged out. License key removed.");
}
```

**Build src/commands/account.ts**:

```typescript
import * as logger from "../lib/logger.js";
import { readLicense, isLicenseExpired, isCacheValid } from "../lib/license.js";

export async function accountCommand(): Promise<void> {
  const cached = readLicense();

  if (!cached) {
    logger.info("Not logged in.");
    logger.info("");
    logger.table([
      ["plan", "Free"],
      ["features", "All CLI features"],
    ]);
    logger.info("");
    logger.info("Upgrade at: https://kova.dev/pricing");
    logger.info("Already have a key? Run: kova login <your-key>");
    return;
  }

  const license = cached.license;
  const expired = isLicenseExpired(license);
  const cacheValid = isCacheValid(cached);

  logger.header("Kova Account");
  logger.table([
    ["plan", license.plan],
    ["status", expired ? "expired" : license.status],
    ["email", license.customerEmail ?? "(none)"],
    ["expires", license.expiresAt ?? "never"],
    ["last validated", cached.cachedAt],
    [
      "cache status",
      cacheValid
        ? "valid (within 7 days)"
        : "expired (will revalidate on next use)",
    ],
  ]);

  if (expired) {
    logger.warn("Your license has expired. Renew at: https://kova.dev/pricing");
  }
}
```

**Update src/index.ts** -- register 3 new commands (add after the completions command block):

```typescript
// Login command
program
  .command("login [key]")
  .description("Authenticate with a license key")
  .action(
    wrapCommandAction(async (key) => {
      const { loginCommand } = await import("./commands/login.js");
      await loginCommand(key as string | undefined);
    }),
  );

// Logout command
program
  .command("logout")
  .description("Remove stored license key")
  .action(
    wrapCommandAction(async () => {
      const { logoutCommand } = await import("./commands/logout.js");
      await logoutCommand();
    }),
  );

// Account command
program
  .command("account")
  .description("Show account and subscription info")
  .action(
    wrapCommandAction(async () => {
      const { accountCommand } = await import("./commands/account.js");
      await accountCommand();
    }),
  );
```

**Update src/lib/completions.ts** -- add 3 new commands to getCommandRegistry():

```typescript
{
  name: "login",
  description: "Authenticate with a license key",
  options: [],
},
{
  name: "logout",
  description: "Remove stored license key",
  options: [],
},
{
  name: "account",
  description: "Show account and subscription info",
  options: [],
},
```

**Update src/commands/build.ts** -- add Pro upsell after build summary:

- Import `showProUpsell` from `../lib/gate.js`
- After `displayBuildSummary(checkpoint, startedAt);` at the end of `buildCommand()`, add: `showProUpsell();`
- Do the same in team-build.ts

- Run `npm run build`
- Verify: `node bin/kova.js login --help`
- Verify: `node bin/kova.js logout --help`
- Verify: `node bin/kova.js account --help`
- Verify: `node bin/kova.js --help` lists login, logout, account
- Run `npm test` to verify 415 existing tests pass

### 3. Build Pricing Page on Website

- **Task ID**: build-pricing-page
- **Depends On**: none
- **Assigned To**: builder-website
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: true (can run alongside CLI tasks)
- Read C:/PROJ/kova-website/app/page.tsx for landing page patterns
- Read C:/PROJ/kova-website/components/landing/navbar.tsx
- Read C:/PROJ/kova-website/components/landing/footer.tsx
- Read C:/PROJ/kova-website/components/ui/gradient-heading.tsx

**Create app/pricing/page.tsx**:

A pricing page with 4 tier cards. Use the Kova dark theme. Layout:

```
[Gradient Heading: "Simple, Transparent Pricing"]
[Subtitle: "Free forever for individuals. Pro for teams that ship."]

[4 cards in a row (1 col mobile, 2 col tablet, 4 col desktop)]

Card 1 - Free ($0):
  - All 11 CLI commands
  - 6 plan templates
  - GitHub integration (PR, issues, branches)
  - Shell completions (bash/zsh/fish)
  - Interactive mode
  - Local build history
  - CTA: "Get Started" -> /docs/getting-started/installation

Card 2 - Pro ($29/mo, highlight as "Most Popular"):
  - Everything in Free
  - Cloud build history and analytics
  - Token usage optimization suggestions
  - Priority model routing
  - Unlimited webhook channels
  - Email support
  - CTA: "Subscribe" -> https://polar.sh/kova (placeholder)

Card 3 - Team ($99/mo):
  - Everything in Pro
  - Team shared plans
  - Approval workflows
  - Centralized config
  - 5 team seats
  - CTA: "Subscribe" -> https://polar.sh/kova (placeholder)

Card 4 - Enterprise ($299/mo):
  - Everything in Team
  - SSO / SAML
  - Audit logs
  - Custom agent definitions
  - Unlimited seats
  - Dedicated support
  - CTA: "Contact Us" -> mailto:hello@kova.dev
```

Style: dark cards (bg-kova-surface), blue border on the "Most Popular" card, check marks for features, Kova blue for CTAs. Each card has rounded corners, subtle border, and padding.

Add annual pricing toggle: monthly default, annual shows 20% discount ($23/mo, $79/mo, $239/mo billed annually).

**Update navbar.tsx** -- add "Pricing" link between "Docs" and "GitHub":

```tsx
<Link href="/pricing" className="...">
  Pricing
</Link>
```

**Update footer.tsx** -- add "Pricing" to the Product links array.

**Update mobile menu** in navbar -- add Pricing link.

- Run `cd C:/PROJ/kova-website && pnpm build` to verify

### 4. Write Tests

- **Task ID**: write-tests
- **Depends On**: build-auth-commands, build-pricing-page
- **Assigned To**: builder-tests
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/src/lib/license.ts, C:/PROJ/kova-cli/src/lib/gate.ts

**Write tests/license.test.ts**:

- Test `getLicensePath()` returns path containing ".kova" and "license.json"
- Test `storeLicense()` + `readLicense()` roundtrip
- Test `removeLicense()` deletes the file
- Test `removeLicense()` does not throw if file doesn't exist
- Test `isCacheValid()` returns true for cache written just now
- Test `isCacheValid()` returns false for cache written 8 days ago
- Test `isLicenseExpired()` returns false when expiresAt is in the future
- Test `isLicenseExpired()` returns true when expiresAt is in the past
- Test `isLicenseExpired()` returns false when expiresAt is null
- Test `validateLicenseOnline()` with mocked fetch returning valid response
- Test `validateLicenseOnline()` with mocked fetch returning 404 (invalid key)
- Test `validateLicenseOnline()` returns null when fetch throws (network error)
- Test `isProUser()` returns false when no license stored
- Test `isProUser()` returns true when valid Pro license cached within 7 days
- Test `isProUser()` returns false when license expired
- Test `getLicenseInfo()` returns null when no license stored
- Test `getLicenseInfo()` returns license info when stored
- Use temp directories for license file storage (mock getLicensePath or use env override)

**Write tests/gate.test.ts**:

- Test `isPro()` returns false for free user (no license)
- Test `showProUpsell()` outputs upgrade message for free users (spy console.log)
- Test `showProUpsell()` outputs nothing for Pro users (mock isProUser to return true)
- Test `requirePro()` throws for free users
- Test `requirePro()` does not throw for Pro users

**Write tests/auth-integration.test.ts**:

- Test login stores license, account reads it, logout removes it (end-to-end flow using temp files)
- Test account with no license shows "Free" plan
- Test completions registry includes login, logout, account commands

- Run `cd C:/PROJ/kova-cli && npm test` -- ALL tests must pass (415 existing + new)
- Run `npm test` again to verify no flaky tests

### 5. Final Validation

- **Task ID**: validate-all
- **Depends On**: cli-foundation, build-auth-commands, build-pricing-page, write-tests
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check:
  - All 415 existing tests still pass
  - 25+ new tests added and passing
  - package.json has repository, homepage, bugs, author fields
  - .npmignore exists and excludes tests/
  - `npm pack --dry-run` excludes tests/ and .claude/
  - `kova login --help` works
  - `kova logout --help` works
  - `kova account --help` works
  - `kova --help` lists login, logout, account
  - Completions include login, logout, account
  - license.ts has 7-day cache pattern
  - gate.ts exports requirePro and isPro
  - Website /pricing page builds (pnpm build in kova-website)
  - No TypeScript `any` types in new CLI source files
  - `npm run build` clean for both projects
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. All 415 existing CLI tests continue to pass
2. `npm run build` compiles cleanly (both CLI and website)
3. 25+ new tests added, all passing
4. package.json has repository, homepage, bugs, author fields
5. .npmignore excludes tests/, .claude/, docs/
6. `npm pack --dry-run` produces clean package without test files
7. `kova login <key>` stores license in ~/.kova/license.json
8. `kova logout` removes license file
9. `kova account` shows plan info (or "Free" if not logged in)
10. `kova --help` lists login, logout, account commands
11. License validation uses 7-day cache (matching update-checker.ts pattern)
12. `isProUser()` returns false when no license, true when valid Pro cached
13. `gate.ts` exports requirePro() and isPro()
14. Build command shows subtle Pro upsell for free users
15. Website /pricing page has 4 tier cards (Free/Pro/Team/Enterprise)
16. Website navbar has Pricing link
17. No TypeScript `any` types in new CLI source code
18. No flaky tests (run suite twice, same results)
19. Completions registry includes login, logout, account

## Validation Commands

- `cd C:/PROJ/kova-cli && npm run build` -- CLI compiles cleanly
- `npm run lint` -- No TypeScript errors
- `npm test` -- Full test suite (440+ tests, 0 failures)
- `npm test` -- Run again for flaky check
- `node bin/kova.js --version` -- Outputs 0.1.0
- `node bin/kova.js --help` -- Lists login, logout, account
- `node bin/kova.js login --help` -- Shows usage
- `node bin/kova.js account --help` -- Shows usage
- `npm pack --dry-run` -- No tests/ or .claude/ in package
- `cd C:/PROJ/kova-website && pnpm build` -- Website builds cleanly
- Verify /pricing route exists in build output

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- CLI project: C:/PROJ/kova-cli/
- Website project: C:/PROJ/kova-website/
- Polar.sh org ID is a PLACEHOLDER. The actual org ID will be set when the Polar account is created. Use the string "POLAR_ORG_ID_PLACEHOLDER" for now.
- Polar checkout URLs are PLACEHOLDERS. Use "https://polar.sh/kova" for now. These will be updated after Polar product configuration.
- The license.ts module follows the EXACT same pattern as update-checker.ts: cache in ~/.kova/, 7-day validity, graceful offline, try-catch all network calls.
- For testing license.ts, mock global.fetch with vi.stubGlobal (same as update-checker tests).
- The gate.ts module does NOT gate any features yet. It is infrastructure for Step 3.
- The Pro upsell message in build.ts is a single line after the build summary. It should be subtle (dim text, not an error).
- The pricing page uses placeholder checkout URLs. When Polar is configured, update the URLs to actual Polar checkout session URLs.
- The website Task 3 can run in PARALLEL with CLI Tasks 1-2 since they modify different projects.

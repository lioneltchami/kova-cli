# Plan: Kova Website and Documentation Build

## Task Description

Build the complete Kova website at `C:/PROJ/kova-website/` consisting of a visually striking landing page using cult-ui animated components and a comprehensive 25+ page documentation site using Fumadocs. The landing page features 9 sections with a dark wolf-pack aesthetic (charcoal #1A1A2E + electric blue #4361EE + wolf silver #C0C0C8), animated terminal demos, fractal grid backgrounds, and interactive feature cards. The documentation site covers all 11 Kova CLI commands, 8 guides, and 4 reference pages with full code examples.

## Objective

Deliver a production-ready Next.js 15 website with: (1) a landing page at `/` with 9 animated sections using 14 cult-ui components, (2) a documentation site at `/docs` with 25+ MDX pages via Fumadocs, (3) responsive design (mobile/tablet/desktop), (4) SEO meta tags, and (5) a clean `pnpm build` with zero errors. The site must load in under 3 seconds and score 85+ on Lighthouse.

## Problem Statement

Kova CLI has 11 commands, 415 tests, and production-quality features, but no web presence. The README is insufficient for the complexity of the tool. Developers discovering Kova via npm or GitHub need a professional landing page (first impression) and comprehensive documentation (onboarding and reference). Without this, adoption stalls.

## Solution Approach

Build a Next.js 15 App Router project with Fumadocs for documentation. Use pnpm as package manager. Install 14 cult-ui components via the shadcn CLI for the landing page. Write 25+ MDX docs pages porting content from the existing README.md, PRD.md, and ROADMAP.md. Deploy-ready for Vercel.

**Key architectural decisions:**

- Single Next.js project serves both landing page and docs (shared layout, nav, footer)
- Fumadocs provides the /docs route with MDX, search, sidebar, dark mode
- cult-ui components are copy-pasted into the project (full ownership, no external runtime dependency)
- All pages are dark mode by default (bg-kova-charcoal)
- Framer Motion for animations (required by cult-ui)
- Inter font for body, JetBrains Mono for code

## Relevant Files

### Content Sources (read from C:/PROJ/kova-cli/)

- `C:/PROJ/kova-cli/README.md` -- Commands, config, agent types, quick start
- `C:/PROJ/kova-cli/PRD.md` -- Detailed feature specs, architecture, competitive analysis
- `C:/PROJ/kova-cli/docs/ROADMAP.md` -- Feature descriptions, pricing tiers
- `C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md` -- Full section-by-section landing page design
- `C:/PROJ/kova-cli/docs/WEBSITE-RESEARCH-SUMMARY.md` -- cult-ui component list, Fumadocs recommendation

### New Files to Create (at C:/PROJ/kova-website/)

**Project Foundation:**

- `package.json` -- Next.js 15, Fumadocs, Tailwind, Framer Motion, shadcn/ui
- `next.config.mjs` -- MDX support via Fumadocs
- `tailwind.config.ts` -- Kova palette tokens, fonts
- `tsconfig.json` -- TypeScript strict mode
- `components.json` -- shadcn/ui configuration
- `postcss.config.mjs` -- Tailwind PostCSS
- `.gitignore` -- Node.js + Next.js

**App Layout:**

- `app/layout.tsx` -- Root layout: dark theme, Inter + JetBrains Mono fonts, metadata
- `app/page.tsx` -- Landing page composing all 9 sections
- `app/docs/layout.tsx` -- Fumadocs docs layout with sidebar
- `app/docs/[[...slug]]/page.tsx` -- Fumadocs page renderer

**Landing Page Components:**

- `components/landing/navbar.tsx` -- Sticky dark navbar with logo, Docs, GitHub, npm links
- `components/landing/hero.tsx` -- Hero with fractal grid, gradient heading, typewriter, terminal, CTAs
- `components/landing/marquee.tsx` -- LightBoard LED scrolling text
- `components/landing/how-it-works.tsx` -- Direction-aware tabs with code blocks
- `components/landing/features.tsx` -- 6 Shift Cards on Stripe Bg Guides
- `components/landing/comparison.tsx` -- Kova vs alternatives table
- `components/landing/stats.tsx` -- 3 animated numbers
- `components/landing/quick-start.tsx` -- Tabbed code block install guide
- `components/landing/cta.tsx` -- Final CTA with fractal grid
- `components/landing/footer.tsx` -- Links + branding

**Documentation Content (25+ MDX files):**

- `content/docs/index.mdx`
- `content/docs/getting-started/installation.mdx`
- `content/docs/getting-started/quickstart.mdx`
- `content/docs/getting-started/configuration.mdx`
- `content/docs/commands/init.mdx` through `completions.mdx` (10 files)
- `content/docs/guides/plan-templates.mdx` through `cross-platform.mdx` (8 files)
- `content/docs/reference/kova-yaml.mdx` through `checkpoint-format.mdx` (4 files)

**Fumadocs Config:**

- `lib/source.ts` -- Fumadocs content source configuration
- `content/docs/meta.json` -- Sidebar navigation structure

**Assets:**

- `public/wolf-logo.svg` -- Simple wolf head SVG mark
- `public/og-image.png` -- Open Graph share image (can be placeholder initially)

## Implementation Phases

### Phase 1: Foundation (Tasks 1-2)

Create the Next.js project, install all dependencies, configure Tailwind with Kova tokens, set up Fumadocs, install cult-ui components, and verify the dev server starts.

### Phase 2: Landing Page (Tasks 3-5)

Build all 9 landing page sections as React components. Wire them into app/page.tsx. The navbar and footer are shared components used on all pages.

### Phase 3: Documentation (Tasks 6-8)

Write all 25+ MDX documentation pages. Configure Fumadocs sidebar navigation. Port content from existing README, PRD, and ROADMAP files.

### Phase 4: Polish (Tasks 9-10)

Add SEO meta tags, responsive design fixes, performance optimization, and final validation.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- IMPORTANT: Use ONLY haiku and sonnet models for sub-agents. No opus.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Specialist
  - Name: builder-foundation
  - Role: Create the Next.js project, install dependencies, configure Tailwind/Fumadocs/shadcn, install cult-ui components, verify dev server starts
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: builder-landing-hero
  - Role: Build the hero section (fractal grid, gradient heading, typewriter, terminal animation, CTAs), navbar, and marquee
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: builder-landing-sections
  - Role: Build sections 3-9 of the landing page (how-it-works, features, comparison, stats, quick-start, CTA, footer) and compose them in page.tsx
  - Agent Type: frontend-specialist
  - Resume: true

- Specialist
  - Name: builder-docs-getting-started
  - Role: Write Getting Started docs (3 pages) and Commands docs (10 pages) in MDX, configure Fumadocs sidebar
  - Agent Type: general-purpose
  - Resume: true

- Specialist
  - Name: builder-docs-guides
  - Role: Write Guides (8 pages) and Reference (4 pages) documentation in MDX
  - Agent Type: general-purpose
  - Resume: true

- Quality Engineer (Validator)
  - Name: validator
  - Role: Validate completed work against acceptance criteria (read-only inspection mode). Verify build, check all pages render, test responsive, audit Lighthouse.
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Project Foundation Setup

- **Task ID**: setup-foundation
- **Depends On**: none
- **Assigned To**: builder-foundation
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Create directory `C:/PROJ/kova-website/`
- Initialize Next.js 15 project with pnpm:
  ```bash
  cd C:/PROJ && pnpx create-next-app@latest kova-website --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm
  ```
- Install Fumadocs:
  ```bash
  cd C:/PROJ/kova-website && pnpm add fumadocs-ui fumadocs-core fumadocs-mdx
  ```
- Install Framer Motion and Shiki:
  ```bash
  pnpm add framer-motion shiki
  ```
- Install shadcn/ui:
  ```bash
  pnpx shadcn@latest init
  ```
  When prompted: TypeScript, Default style, Slate base color, CSS variables, app/ directory
- Install Radix UI dependencies needed by cult-ui:
  ```bash
  pnpm add @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react
  ```
- Configure `tailwind.config.ts` with Kova palette tokens:

  ```typescript
  import type { Config } from "tailwindcss";

  const config: Config = {
    darkMode: "class",
    content: [
      "./app/**/*.{ts,tsx,mdx}",
      "./components/**/*.{ts,tsx}",
      "./content/**/*.mdx",
      "./node_modules/fumadocs-ui/dist/**/*.js",
    ],
    theme: {
      extend: {
        colors: {
          kova: {
            charcoal: "#1A1A2E",
            "charcoal-light": "#252540",
            blue: "#4361EE",
            "blue-light": "#5B7BFF",
            silver: "#C0C0C8",
            "silver-dim": "#8A8A94",
            surface: "#16162A",
            border: "#2A2A45",
          },
        },
        fontFamily: {
          sans: ["Inter", "system-ui", "sans-serif"],
          mono: ["JetBrains Mono", "Fira Code", "monospace"],
        },
      },
    },
    plugins: [],
  };
  export default config;
  ```

- Set up Fumadocs content source. Create `lib/source.ts`:

  ```typescript
  import { docs, meta } from "@/.source";

  export const source = docs;
  export const metaSource = meta;
  ```

- Create `source.config.ts` at root:

  ```typescript
  import { defineDocs, defineConfig } from "fumadocs-mdx/config";

  export const { docs, meta } = defineDocs({
    dir: "content/docs",
  });

  export default defineConfig();
  ```

- Update `next.config.mjs` to use Fumadocs MDX:

  ```javascript
  import { createMDX } from "fumadocs-mdx/next";

  const withMDX = createMDX();

  /** @type {import('next').NextConfig} */
  const config = {};

  export default withMDX(config);
  ```

- Create `app/layout.tsx` root layout with dark theme, Inter font, metadata:

  ```tsx
  import type { Metadata } from "next";
  import { Inter, JetBrains_Mono } from "next/font/google";
  import "./globals.css";

  const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
  const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
  });

  export const metadata: Metadata = {
    title: "Kova - AI Coding Orchestration CLI",
    description:
      "Plan the hunt. Run the pack. Orchestrate 17+ specialist AI agents to plan, build, and ship code.",
  };

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-kova-charcoal text-kova-silver antialiased`}
        >
          {children}
        </body>
      </html>
    );
  }
  ```

- Update `app/globals.css` to set dark background:

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  :root {
    --background: 240 20% 9%;
    --foreground: 240 5% 78%;
  }

  body {
    background-color: #1a1a2e;
    color: #c0c0c8;
  }
  ```

- Create a minimal `app/page.tsx` placeholder:
  ```tsx
  export default function Home() {
    return (
      <main className="min-h-screen bg-kova-charcoal">
        <div className="flex items-center justify-center min-h-screen">
          <h1 className="text-4xl font-bold text-kova-silver">
            Kova - Coming Soon
          </h1>
        </div>
      </main>
    );
  }
  ```
- Set up Fumadocs docs route. Create `app/docs/layout.tsx`:

  ```tsx
  import { DocsLayout } from "fumadocs-ui/layouts/docs";
  import type { ReactNode } from "react";
  import { source } from "@/lib/source";

  export default function Layout({ children }: { children: ReactNode }) {
    return <DocsLayout tree={source.pageTree}>{children}</DocsLayout>;
  }
  ```

- Create `app/docs/[[...slug]]/page.tsx`:

  ```tsx
  import { source } from "@/lib/source";
  import { DocsPage, DocsBody } from "fumadocs-ui/page";
  import { notFound } from "next/navigation";

  export default async function Page(props: {
    params: Promise<{ slug?: string[] }>;
  }) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();
    const MDX = page.data.body;
    return (
      <DocsPage toc={page.data.toc}>
        <DocsBody>
          <MDX />
        </DocsBody>
      </DocsPage>
    );
  }

  export function generateStaticParams() {
    return source.generateParams();
  }
  ```

- Create initial docs content. Create `content/docs/index.mdx`:

  ```mdx
  ---
  title: Kova Documentation
  description: Complete guide to the Kova AI coding orchestration CLI
  ---

  # Kova Documentation

  Welcome to the Kova documentation. Kova is an AI coding orchestration CLI that coordinates 17+ specialist agents to plan, build, and ship code.

  ## Getting Started

  - [Installation](/docs/getting-started/installation) - Install Kova CLI
  - [Quick Start](/docs/getting-started/quickstart) - Your first plan and build in 30 seconds
  - [Configuration](/docs/getting-started/configuration) - Configure kova.yaml
  ```

- Create `content/docs/meta.json` for sidebar:
  ```json
  {
    "title": "Kova",
    "pages": [
      "---Getting Started---",
      "getting-started/installation",
      "getting-started/quickstart",
      "getting-started/configuration",
      "---Commands---",
      "commands/init",
      "commands/plan",
      "commands/run",
      "commands/build",
      "commands/team-build",
      "commands/pr",
      "commands/status",
      "commands/config",
      "commands/update",
      "commands/completions",
      "---Guides---",
      "guides/plan-templates",
      "guides/token-tracking",
      "guides/github-integration",
      "guides/webhook-notifications",
      "guides/interactive-mode",
      "guides/model-tiering",
      "guides/checkpoint-recovery",
      "guides/cross-platform",
      "---Reference---",
      "reference/kova-yaml",
      "reference/agent-types",
      "reference/plan-format",
      "reference/checkpoint-format"
    ]
  }
  ```
- Create placeholder MDX files for all 25 docs pages (just title + description frontmatter, 1-line body) so the build succeeds. Create them in the correct directory structure under `content/docs/`.
- Create `public/wolf-logo.svg` -- a simple geometric wolf head SVG (can be a minimal triangle/diamond wolf silhouette)
- Run `pnpm dev` to verify the site starts without errors
- Run `pnpm build` to verify static build succeeds
- Report results

### 2. Install Cult-UI Components

- **Task ID**: install-cultui
- **Depends On**: setup-foundation
- **Assigned To**: builder-foundation
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Read the WEBSITE-PLAN.md component list at C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md (section 5)
- Install each cult-ui component. Note: some may fail if the shadcn registry URL format is different. If `pnpm dlx shadcn@latest add <url>` fails, manually create the component file based on the cult-ui docs.
- Install components one at a time:
  ```bash
  cd C:/PROJ/kova-website
  pnpm dlx shadcn@latest add https://cult-ui.com/r/terminal-animation.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/canvas-fractal-grid.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/code-block.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/stripe-bg-guides.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/gradient-heading.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/text-animate.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/typewriter.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/shift-card.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/cosmic-button.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/bg-animate-button.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/direction-aware-tabs.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/lightboard.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/neumorph-eyebrow.json
  pnpm dlx shadcn@latest add https://cult-ui.com/r/animated-number.json
  ```
- If any install fails, note the error and check cult-ui.com docs for the component. Create it manually if needed by visiting the component page and copying the code.
- After all installs, run `pnpm build` to verify no import errors
- List all installed components in `components/ui/` directory
- Report which components installed successfully and which needed manual creation

### 3. Build Hero Section + Navbar + Marquee

- **Task ID**: build-hero
- **Depends On**: install-cultui
- **Assigned To**: builder-landing-hero
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md sections 1-2 for hero and marquee specs
- Read all installed cult-ui components in C:/PROJ/kova-website/components/ui/ to understand their APIs
- Build `components/landing/navbar.tsx`:
  - Sticky top navbar with glass effect (backdrop-blur)
  - Left: Wolf logo SVG + "KOVA" text
  - Center: Docs link, GitHub link, npm link
  - Right: "npx kova-cli init" button (Cosmic Button or simple styled)
  - Dark background matching kova-charcoal
  - Mobile: hamburger menu
- Build `components/landing/hero.tsx`:
  - Full-viewport height section
  - Background: Canvas Fractal Grid (if installed) with dotColor #C0C0C8, glowColor #4361EE, backgroundColor #1A1A2E. If Canvas Fractal Grid failed to install, use a simple radial gradient background as fallback.
  - Top center: Neumorph Eyebrow badge "v1.0 -- Open Source"
  - Main heading: Gradient Heading "Plan the hunt." (line 1) "Run the pack." (line 2) with gradient from #C0C0C8 to #4361EE. If Gradient Heading component not available, use Tailwind bg-gradient-to-r + bg-clip-text + text-transparent.
  - Subtitle: Typewriter component cycling 3 phrases (see WEBSITE-PLAN.md). If Typewriter not available, use simple text.
  - Terminal demo: Terminal Animation showing 3 tabs (Plan/Build/Ship) with the exact content from WEBSITE-PLAN.md section 1. If Terminal Animation not available, build a simple tabbed dark terminal component with monospace text.
  - CTAs: Cosmic Button "npx kova-cli init" + secondary "Read the Docs" link
  - IMPORTANT: Every cult-ui component may have a different API than expected. Read the actual installed component source files to understand props. Adapt as needed.
- Build `components/landing/marquee.tsx`:
  - LightBoard component with text "PLAN -- ORCHESTRATE -- EXECUTE -- VALIDATE -- SHIP"
  - If LightBoard not available, build a simple CSS marquee with silver text on dark bg
- Update `app/page.tsx` to import and render Navbar + Hero + Marquee
- Run `pnpm build` to verify no errors
- Run `pnpm dev` and visually verify the hero renders

### 4. Build Landing Page Sections 3-6

- **Task ID**: build-sections-3-6
- **Depends On**: build-hero
- **Assigned To**: builder-landing-sections
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md sections 3-6
- Read all installed components in C:/PROJ/kova-website/components/ui/
- Build `components/landing/how-it-works.tsx`:
  - Section heading with Text Animate "How the Pack Works"
  - Direction Aware Tabs with 3 tabs: Plan, Build, Ship
  - Each tab shows a code block and description (content from WEBSITE-PLAN.md)
  - If Direction Aware Tabs not available, use simple tab component with shadcn Tabs
- Build `components/landing/features.tsx`:
  - Background: Stripe Bg Guides (if available) with glowColor #4361EE. Fallback: dark section with subtle border.
  - Section heading: Text Animate "Built for Developers Who Ship"
  - 3x2 grid of Shift Cards. If Shift Card not available, use simple cards with hover effect.
  - Each card: title, icon (from lucide-react), hover description (content from WEBSITE-PLAN.md)
- Build `components/landing/comparison.tsx`:
  - Section heading: "How Kova Compares"
  - Table from WEBSITE-PLAN.md section 5: Kova vs Ralphy vs Aider vs Cursor
  - Style: dark table with kova-blue highlights for Kova column
  - Checkmarks for Yes, X for No
- Build `components/landing/stats.tsx`:
  - 3 Animated Numbers in a row: 415+ (Tests Passing), 11 (Commands), 6 (Plan Templates)
  - If Animated Number not available, use static numbers with bold styling
  - Dark background with centered layout
- Update `app/page.tsx` to include these 4 sections
- Run `pnpm build`

### 5. Build Landing Page Sections 7-9

- **Task ID**: build-sections-7-9
- **Depends On**: build-sections-3-6
- **Assigned To**: builder-landing-sections
- **Agent Type**: frontend-specialist
- **Model**: sonnet
- **Parallel**: false
- Read C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md sections 7-9
- Build `components/landing/quick-start.tsx`:
  - Section heading: "Get Started in 30 Seconds"
  - Tabbed Code Block with 5 tabs: Install, Init, Plan, Build, Ship
  - Each tab shows one command (from WEBSITE-PLAN.md)
  - If Code Block cult-ui component not available, build simple pre+code with tabs
- Build `components/landing/cta.tsx`:
  - Background: reuse fractal grid or gradient
  - Gradient Heading: "Join the Pack"
  - Subtitle: "Open source. Free forever. Ship faster."
  - Two buttons: Cosmic Button "npx kova-cli init" + "Star on GitHub"
- Build `components/landing/footer.tsx`:
  - "Kova -- Plan the hunt. Run the pack."
  - Link columns: Product (Docs, GitHub, npm) | Resources (Blog, Changelog) | Community (Discord, Twitter)
  - Bottom: "MIT License | Built with Next.js"
  - Wolf silver text on kova-charcoal
- Update `app/page.tsx` to include all 9 sections in order
- Run `pnpm build` to verify complete landing page builds
- Run `pnpm dev` to verify all sections render

### 6. Write Getting Started + Commands Documentation

- **Task ID**: write-docs-commands
- **Depends On**: setup-foundation
- **Assigned To**: builder-docs-getting-started
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (can run alongside landing page tasks 3-5)
- Read C:/PROJ/kova-cli/README.md for command docs content
- Read C:/PROJ/kova-cli/PRD.md sections 7.1 for detailed feature specs
- Read C:/PROJ/kova-cli/docs/WEBSITE-PLAN.md section 4 for docs structure and page template
- Write 13 MDX files, replacing the placeholders created in Task 1:

**Getting Started (3 pages):**

- `content/docs/getting-started/installation.mdx` -- Prerequisites (Node 18+, Claude Code CLI), install methods (npm global, npx), verify installation
- `content/docs/getting-started/quickstart.mdx` -- 30-second demo: kova init -> kova plan -> kova build -> kova pr. Show actual terminal output.
- `content/docs/getting-started/configuration.mdx` -- kova.yaml overview, key sections, how to customize

**Commands (10 pages):**
Each command page follows this structure: Brief description, Usage syntax, Flags table, Examples (2-3), How It Works explanation, Related links.

- `content/docs/commands/init.mdx` -- kova init with --force, --merge, --dry-run, --no-detect, --preset. Include interactive mode section.
- `content/docs/commands/plan.mdx` -- kova plan with --template, --model, --auto-build, --output, --issue, --no-branch
- `content/docs/commands/run.mdx` -- kova run as combined plan+build. --no-auto, --template, --live, --issue, --branch
- `content/docs/commands/build.mdx` -- kova build with --resume, --parallel, --model-override, --dry-run, --verbose, --no-validate, --live
- `content/docs/commands/team-build.mdx` -- kova team-build with Agent Teams, --wave-timeout. Explain contract-first execution.
- `content/docs/commands/pr.mdx` -- kova pr with --title, --body, --draft, --base. Show generated PR example.
- `content/docs/commands/status.mdx` -- kova status showing checkpoint progress, token usage
- `content/docs/commands/config.mdx` -- kova config with set, add-rule, add-boundary subcommands
- `content/docs/commands/update.mdx` -- kova update with --force, local modification detection
- `content/docs/commands/completions.mdx` -- kova completions bash/zsh/fish with install instructions

Each page should have 50-100 lines of MDX content with frontmatter, code blocks, and tables. Do NOT use emojis.

- Run `pnpm build` to verify all docs pages compile

### 7. Write Guides Documentation

- **Task ID**: write-docs-guides
- **Depends On**: setup-foundation
- **Assigned To**: builder-docs-guides
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (can run alongside tasks 3-6)
- Read C:/PROJ/kova-cli/PRD.md for feature specifications
- Read C:/PROJ/kova-cli/docs/ROADMAP.md for feature descriptions
- Write 8 guide MDX files:

- `content/docs/guides/plan-templates.mdx` -- 6 templates (feature, bugfix, refactor, migration, security, performance). For each: what it does, when to use, example command, what the template includes.
- `content/docs/guides/token-tracking.mdx` -- How token tracking works, per-task display, build summary, budget warnings (80%/95%), plan types (Pro/Max5/Max20/API), configuration in kova.yaml.
- `content/docs/guides/github-integration.mdx` -- Complete workflow: --issue flag (fetch issue context), auto-branch creation, kova pr (PR generation). Show the full viral loop.
- `content/docs/guides/webhook-notifications.mdx` -- Discord, Slack, custom webhook setup. Payload format. Configuration in kova.yaml. Failure handling.
- `content/docs/guides/interactive-mode.mdx` -- When it activates (TTY + no flags), the 7-step prompt sequence, how to skip (--force or any flag).
- `content/docs/guides/model-tiering.mdx` -- Haiku/sonnet/opus selection logic. Signal-based auto-detection. Cost savings (3-10x). Configuration overrides.
- `content/docs/guides/checkpoint-recovery.mdx` -- How checkpoints work, atomic writes, --resume flag, token persistence across resumes, Windows compatibility.
- `content/docs/guides/cross-platform.mdx` -- Windows (shell:true for .cmd), macOS, Linux. Glob normalization. Atomic writes. subprocess handling.

Each guide should have 60-120 lines with code examples, tables, and step-by-step instructions.

- Run `pnpm build` to verify guides compile

### 8. Write Reference Documentation

- **Task ID**: write-docs-reference
- **Depends On**: setup-foundation
- **Assigned To**: builder-docs-guides
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: true (can run after guides, same agent)
- Read C:/PROJ/kova-cli/src/types.ts for type definitions
- Read C:/PROJ/kova-cli/src/lib/constants.ts for config defaults
- Write 4 reference MDX files:

- `content/docs/reference/kova-yaml.mdx` -- Complete kova.yaml schema. Every field with type, default, description. Organized by section (project, models, quality, agents, boundaries, rules, execution, notifications, usage_tracking, plan_validation).
- `content/docs/reference/agent-types.mdx` -- Table of all 17+ agent types: name, specialty, when used, default model. Include: frontend-specialist, backend-engineer, supabase-specialist, quality-engineer, security-auditor, performance-optimizer, debugger-detective, code-simplifier, general-purpose, etc.
- `content/docs/reference/plan-format.mdx` -- The plan markdown specification: required sections (Task Description, Objective, Relevant Files, Step by Step Tasks, Acceptance Criteria, Team Orchestration), task metadata fields, dependency format.
- `content/docs/reference/checkpoint-format.mdx` -- The .progress.json schema: plan, started_at, status, tasks map, token_usage, validation. Show example JSON.

- Run `pnpm build`

### 9. SEO and Performance Polish

- **Task ID**: polish-seo
- **Depends On**: build-sections-7-9, write-docs-commands, write-docs-guides, write-docs-reference
- **Assigned To**: builder-foundation
- **Agent Type**: frontend-specialist
- **Model**: haiku
- **Parallel**: false
- Update `app/layout.tsx` metadata with full SEO tags:
  - title template: "%s | Kova"
  - description
  - Open Graph: title, description, image, type
  - Twitter card: summary_large_image
- Add `robots.txt` and `sitemap.xml` generation (Next.js built-in or manual)
- Create `public/og-image.png` placeholder (dark background with "Kova" text and wolf logo -- can be a simple generated image or SVG)
- Verify `pnpm build` succeeds with zero warnings
- Check that all 25+ docs pages are generated in the build output
- Verify landing page and docs layout render correctly

### 10. Final Validation

- **Task ID**: validate-all
- **Depends On**: setup-foundation, install-cultui, build-hero, build-sections-3-6, build-sections-7-9, write-docs-commands, write-docs-guides, write-docs-reference, polish-seo
- **Assigned To**: validator
- **Agent Type**: quality-engineer
- **Model**: sonnet
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Operate in validation mode: inspect and report only, do not modify files
- Check:
  - `pnpm build` succeeds with zero errors
  - Landing page (`app/page.tsx`) renders all 9 sections
  - Docs index (`/docs`) loads with sidebar navigation
  - All 25+ MDX files have non-placeholder content (more than 10 lines each)
  - Navbar appears on all pages
  - Footer appears on landing page
  - Dark theme applied globally (bg-kova-charcoal)
  - No TypeScript errors (`pnpm lint`)
  - No broken links in docs navigation
  - Mobile responsive (check viewport meta tag exists)
  - SEO meta tags present in layout.tsx
- Report PASS/FAIL for each criterion

## Acceptance Criteria

1. `pnpm build` succeeds with zero errors at C:/PROJ/kova-website/
2. Landing page has all 9 sections rendering (hero, marquee, how-it-works, features, comparison, stats, quick-start, CTA, footer)
3. Navbar is sticky with logo, Docs link, GitHub link
4. Hero section has animated terminal demo showing real Kova commands
5. Features section has 6 cards with hover effects
6. Comparison table shows Kova vs 3 competitors
7. Docs site at /docs has working sidebar navigation
8. All 25+ MDX documentation pages have real content (not placeholders)
9. Getting Started section has installation, quickstart, configuration pages
10. All 10 command pages have usage, flags table, and examples
11. All 8 guide pages have explanations and code examples
12. All 4 reference pages have complete schemas/tables
13. Dark theme (bg-kova-charcoal) applied globally
14. Inter font for body text, JetBrains Mono for code
15. SEO metadata in root layout (title, description, OG tags)
16. No TypeScript errors
17. Fumadocs search functional on docs pages
18. Mobile responsive layout (no horizontal scroll on 375px width)

## Validation Commands

Execute these commands to validate the task is complete:

- `cd C:/PROJ/kova-website && pnpm build` -- Zero errors
- `pnpm lint` -- No TypeScript/ESLint errors
- `find content/docs -name "*.mdx" | wc -l` -- Should be 25+
- `grep -r "Coming Soon" content/docs/ --files-with-matches` -- Should find 0 (no placeholders left)
- `grep "bg-kova-charcoal" app/layout.tsx` -- Dark theme applied
- `grep "Inter" app/layout.tsx` -- Inter font loaded
- `grep "JetBrains" app/layout.tsx` -- JetBrains Mono loaded
- `grep "og:title" app/layout.tsx` -- OG tags present

## Notes

- Use ONLY haiku and sonnet models for all sub-agents. No opus.
- The project directory is C:/PROJ/kova-website/ (separate from C:/PROJ/kova-cli/)
- Content sources are at C:/PROJ/kova-cli/ (README.md, PRD.md, ROADMAP.md)
- cult-ui components install via shadcn registry URLs. If a URL fails, the agent should visit https://cult-ui.com/docs/components/<name> and manually copy the component code into components/ui/<name>.tsx
- CRITICAL: cult-ui components may have different APIs than described in the plan. Agents MUST read the actual installed source files before using them. Do not assume prop names.
- If a cult-ui component fails to install or compile, build a simpler fallback using Tailwind CSS + Framer Motion. The landing page must build even if some fancy components are unavailable.
- Fumadocs requires specific file structure. Follow their docs at https://fumadocs.vercel.app/docs/ui if the setup differs from what's described here.
- All MDX content should be written in clear, concise developer documentation style. No fluff, no emojis. Code examples in every page. Tables for structured data.
- The docs pages should stand alone -- each page should be useful without reading other pages first.
- Tasks 6, 7, 8 (docs writing) can run in PARALLEL with tasks 3, 4, 5 (landing page building) since they work on different files.

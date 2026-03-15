# Kova Website and Documentation Plan

**Date**: 2026-03-14
**Status**: Ready for Implementation
**Scope**: Landing page (kova.dev) + Documentation site (/docs)

---

## 1. Architecture Decision

### Recommended Stack

| Layer                   | Technology                     | Rationale                                                              |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| **Framework**           | Next.js 15 (App Router)        | Same stack as future dashboard; React ecosystem for cult-ui components |
| **Docs Engine**         | Fumadocs                       | Next.js-native docs framework; MDX support; built-in search; dark mode |
| **Styling**             | Tailwind CSS v4                | Required by all cult-ui components; Kova palette as custom tokens      |
| **Animations**          | Framer Motion                  | Required by cult-ui components (terminal, fractal grid, text animate)  |
| **Components**          | cult-ui + shadcn/ui            | Copy-paste components with full source ownership                       |
| **Syntax Highlighting** | Shiki (via cult-ui Code Block) | 100+ languages, dark themes matching #1A1A2E                           |
| **Deployment**          | Vercel                         | Zero-config Next.js deployment, edge network, analytics                |
| **Domain**              | kova.dev                       | Short, developer-friendly TLD                                          |

### Project Structure

```
kova-website/
  app/
    layout.tsx                  # Root layout (dark theme, fonts, analytics)
    page.tsx                    # Landing page (/)
    pricing/page.tsx            # Pricing page (/pricing)
    docs/
      [[...slug]]/page.tsx      # Fumadocs catch-all route
  components/
    landing/
      hero.tsx                  # Hero section with terminal animation
      features.tsx              # Feature showcase with shift cards
      how-it-works.tsx          # Direction-aware tabs + code blocks
      stats.tsx                 # Animated numbers section
      comparison.tsx            # Kova vs alternatives table
      cta.tsx                   # Final call-to-action
      footer.tsx                # Site footer
    shared/
      navbar.tsx                # Global navigation
      terminal-demo.tsx         # Kova CLI terminal animation
      gradient-heading.tsx      # Branded heading component
  content/docs/
    index.mdx                   # Docs landing
    getting-started/
      installation.mdx
      quickstart.mdx
      configuration.mdx
    commands/
      init.mdx
      plan.mdx
      run.mdx
      build.mdx
      team-build.mdx
      pr.mdx
      status.mdx
      config.mdx
      update.mdx
      completions.mdx
    guides/
      plan-templates.mdx
      token-tracking.mdx
      github-integration.mdx
      webhook-notifications.mdx
      interactive-mode.mdx
      model-tiering.mdx
      checkpoint-recovery.mdx
      cross-platform.mdx
    reference/
      kova-yaml.mdx
      agent-types.mdx
      plan-format.mdx
      checkpoint-format.mdx
  public/
    wolf-logo.svg               # Kova wolf mark
    og-image.png                # Social share image
  tailwind.config.ts            # Kova palette tokens
```

---

## 2. Brand Tokens (Tailwind Config)

```typescript
// tailwind.config.ts
const config = {
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
};
```

---

## 3. Landing Page Sections

### Section 1: Hero

**Components**: Canvas Fractal Grid (background) + Gradient Heading (h1) + Typewriter (subtitle) + Terminal Animation (demo) + Cosmic Button (CTA)

**Layout**:

```
[Canvas Fractal Grid background - dots: #C0C0C8, glow: #4361EE, bg: #1A1A2E]

  [Neumorph Eyebrow: "v1.0 -- Open Source"]

  [Gradient Heading: "Plan the hunt.\nRun the pack."]
  [gradient: wolf silver #C0C0C8 -> electric blue #4361EE]

  [Typewriter cycling:]
  "Multi-agent AI orchestration for your codebase."
  "17 specialist agents. One CLI command."
  "Plan before you code. Validate independently."

  [Terminal Animation showing:]
  Tab 1: $ kova plan "add user authentication"
         Planning... (using opus model)
         Plan created: .claude/tasks/user-auth.md
         Tasks: 7 | Agents: 4 | Est. models: 2x haiku, 3x sonnet, 1x opus
  Tab 2: $ kova build
         Building: user-auth
         [=====>          ] 3/7 tasks (42%)
         [done]  setup-schema       haiku   47s
         [done]  build-api          sonnet  2m 18s
         [done]  build-frontend     sonnet  1m 45s
         [running] integration-tests  sonnet  started 1m ago
  Tab 3: $ kova pr
         Creating PR: Add User Authentication
         Branch: feat/user-auth -> main
         PR #42 created: https://github.com/org/repo/pull/42

  [Cosmic Button: "npx kova-cli init"]  [Bg Animate Button: "Read the Docs"]
```

### Section 2: Marquee / Announcement

**Component**: LightBoard

```
Scrolling LED text: "PLAN -- ORCHESTRATE -- EXECUTE -- VALIDATE -- SHIP"
Dot color: #C0C0C8, background: #1A1A2E
```

### Section 3: How It Works

**Components**: Direction Aware Tabs + Code Block + Text Animate headings

```
[Text Animate (shift-in-up): "How the Pack Works"]

[Direction Aware Tabs:]

Tab "Plan":
  [Code Block (bash):]
  $ kova plan --template feature "add user profiles"
  [Description: "Analyze your codebase. Map dependencies. Design the approach.
   Claude analyzes your project and creates a structured plan with
   specialist agents, task dependencies, and acceptance criteria."]

Tab "Build":
  [Code Block (bash):]
  $ kova build --live
  [Description: "Dispatch specialist agents in dependency order.
   Frontend, backend, database, security -- each agent works on
   what it knows best. Quality engineer validates independently."]

Tab "Ship":
  [Code Block (bash):]
  $ kova pr --draft
  [Description: "Auto-create a GitHub PR with generated title and body.
   Links issues, shows build status, lists completed tasks.
   Zero manual PR writing."]
```

### Section 4: Features

**Components**: Shift Card x 6 + Stripe Bg Guides (background)

```
[Stripe Bg Guides background - glow: #4361EE]

[Text Animate: "Built for Developers Who Ship"]

[Grid: 3x2 Shift Cards]

Card 1: "17+ Specialist Agents"
  Hover: frontend, backend, database, security, quality, performance...
  Each agent is an expert in its domain.

Card 2: "Dependency-Aware Execution"
  Hover: Tasks wait for prerequisites. No building on assumptions.
  Explicit task graphs with addBlockedBy.

Card 3: "Model Tiering (3-10x Savings)"
  Hover: Haiku for typos. Sonnet for features. Opus for architecture.
  Auto-selects the right model per task.

Card 4: "Crash Recovery"
  Hover: Checkpoint every task. Resume with --resume.
  Never lose progress to a rate limit or timeout.

Card 5: "Token Budget Tracking"
  Hover: Per-task and per-build token usage.
  Warnings at 80% and 95% of your session budget.

Card 6: "GitHub Integration"
  Hover: Auto-branches, issue linking, PR creation.
  Complete viral loop from idea to merged PR.
```

### Section 5: Comparison Table

**Component**: Custom table with shadcn styling

```
[Text Animate: "How Kova Compares"]

| Feature               | Kova    | Ralphy  | Aider   | Cursor  |
|-----------------------|---------|---------|---------|---------|
| Planning phase        | Yes     | No      | No      | Partial |
| Specialist agents     | 17+     | No      | No      | No      |
| Task dependencies     | Explicit| Implicit| No      | No      |
| Independent QA        | Yes     | No      | No      | No      |
| Model tiering         | Auto    | N/A     | Manual  | Auto    |
| Crash recovery        | Yes     | Partial | Git     | Auto    |
| GitHub PRs            | Yes     | No      | No      | No      |
| Token tracking        | Yes     | No      | No      | No      |
| Price                 | Free    | Free    | Free    | $20/mo  |
```

### Section 6: Stats

**Components**: Animated Number x 3

```
[Dark section with subtle gradient]

  415+          11          6
  Tests         Commands    Plan Templates
  Passing       Available   Ready to Use
```

### Section 7: Install / Quick Start

**Component**: Code Block (tabbed)

```
[Text Animate: "Get Started in 30 Seconds"]

[Code Block tabs:]
Tab "Install":    npm install -g kova-cli
Tab "Init":       cd your-project && kova init
Tab "Plan":       kova plan "add user authentication"
Tab "Build":      kova build --live
Tab "Ship":       kova pr
```

### Section 8: Call to Action

**Components**: Gradient Heading + Cosmic Button + Canvas Fractal Grid (background)

```
[Canvas Fractal Grid background]

  [Gradient Heading: "Join the Pack"]
  [Subtitle: "Open source. Free forever. Ship faster."]

  [Cosmic Button: "npx kova-cli init"]
  [Bg Animate Button: "Star on GitHub"]
```

### Section 9: Footer

```
Kova -- Plan the hunt. Run the pack.

[Links:]
Docs | GitHub | npm | Discord | Twitter

MIT License | Built with Next.js
```

---

## 4. Documentation Site Structure

### Navigation Hierarchy

```
Getting Started
  Installation ................ npm install, npx, prerequisites
  Quick Start ................. 30-second demo: init -> plan -> build -> pr
  Configuration ............... kova.yaml full reference

Commands
  kova init ................... Project initialization + interactive mode
  kova plan ................... Plan creation + templates + issue linking
  kova run .................... Combined plan+build
  kova build .................. Hub-and-spoke execution
  kova team-build ............. Agent Teams execution
  kova pr ..................... GitHub PR creation
  kova status ................. Build progress display
  kova config ................. Configuration management
  kova update ................. Template updates
  kova completions ............ Shell completions

Guides
  Plan Templates .............. 6 templates with examples
  Token Tracking .............. Budget system, per-task display, warnings
  GitHub Integration .......... Issues, branches, PRs
  Webhook Notifications ....... Discord, Slack, custom webhooks
  Interactive Mode ............ Guided init setup
  Model Tiering ............... Haiku/sonnet/opus auto-selection
  Checkpoint & Recovery ....... Crash recovery, --resume
  Cross-Platform .............. Windows, macOS, Linux compatibility

Reference
  kova.yaml Schema ............ Every field documented
  Agent Types ................. 17+ specialist agents with descriptions
  Plan Format ................. Markdown plan specification
  Checkpoint Format ........... JSON checkpoint specification
```

### Per-Page Template

Each documentation page follows this structure:

```markdown
---
title: Command Name
description: One-line description
---

# Command Name

Brief description of what this command does.

## Usage

\`\`\`bash
kova <command> [arguments] [flags]
\`\`\`

## Flags

| Flag   | Description  | Default |
| ------ | ------------ | ------- |
| --flag | What it does | value   |

## Examples

### Basic Usage

\`\`\`bash
kova plan "add user profiles"
\`\`\`

### With Template

\`\`\`bash
kova plan --template feature "add user profiles"
\`\`\`

## How It Works

Step-by-step explanation with code blocks.

## Related

- [kova build](/docs/commands/build) -- Execute the plan
- [Plan Templates](/docs/guides/plan-templates) -- Available templates
```

### Content Sources

Most documentation content already exists in these files:

- `C:/PROJ/kova-cli/README.md` -- Commands, config, agent types
- `C:/PROJ/kova-cli/PRD.md` -- Detailed specifications for every feature
- `C:/PROJ/kova-cli/docs/ROADMAP.md` -- Feature descriptions

---

## 5. Cult-UI Components to Install

These components will be installed from cult-ui.com via the shadcn CLI:

| Component            | Install Command                                                              | Used In                |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| Terminal Animation   | `pnpm dlx shadcn@latest add https://cult-ui.com/r/terminal-animation.json`   | Hero                   |
| Canvas Fractal Grid  | `pnpm dlx shadcn@latest add https://cult-ui.com/r/canvas-fractal-grid.json`  | Hero + CTA backgrounds |
| Code Block           | `pnpm dlx shadcn@latest add https://cult-ui.com/r/code-block.json`           | How It Works + Install |
| Stripe Bg Guides     | `pnpm dlx shadcn@latest add https://cult-ui.com/r/stripe-bg-guides.json`     | Features background    |
| Gradient Heading     | `pnpm dlx shadcn@latest add https://cult-ui.com/r/gradient-heading.json`     | Hero + CTA headings    |
| Text Animate         | `pnpm dlx shadcn@latest add https://cult-ui.com/r/text-animate.json`         | Section headings       |
| Typewriter           | `pnpm dlx shadcn@latest add https://cult-ui.com/r/typewriter.json`           | Hero subtitle          |
| Shift Card           | `pnpm dlx shadcn@latest add https://cult-ui.com/r/shift-card.json`           | Features grid          |
| Cosmic Button        | `pnpm dlx shadcn@latest add https://cult-ui.com/r/cosmic-button.json`        | Primary CTAs           |
| Bg Animate Button    | `pnpm dlx shadcn@latest add https://cult-ui.com/r/bg-animate-button.json`    | Secondary CTAs         |
| Direction Aware Tabs | `pnpm dlx shadcn@latest add https://cult-ui.com/r/direction-aware-tabs.json` | How It Works           |
| LightBoard           | `pnpm dlx shadcn@latest add https://cult-ui.com/r/lightboard.json`           | Marquee                |
| Neumorph Eyebrow     | `pnpm dlx shadcn@latest add https://cult-ui.com/r/neumorph-eyebrow.json`     | Badge labels           |
| Animated Number      | `pnpm dlx shadcn@latest add https://cult-ui.com/r/animated-number.json`      | Stats section          |

**Dependencies required**: Framer Motion, Shiki, class-variance-authority (CVA), @radix-ui/react-slot

---

## 6. Implementation Phases

### Phase 1: Project Setup (1 day)

- Create Next.js 15 project at `C:/PROJ/kova-website/`
- Install Tailwind CSS v4, Fumadocs, shadcn/ui
- Configure Kova color tokens and fonts
- Set up Fumadocs for /docs route
- Deploy empty site to Vercel

### Phase 2: Landing Page (2-3 days)

- Install all 14 cult-ui components
- Build 9 landing page sections (hero through footer)
- Implement terminal animation with real Kova commands
- Configure Canvas Fractal Grid with Kova colors
- Add responsive design (mobile, tablet, desktop)

### Phase 3: Documentation Content (2-3 days)

- Write 25+ MDX documentation pages
- Port content from README, PRD, and ROADMAP
- Add code examples and command references
- Configure Fumadocs search and navigation
- Add syntax highlighting for bash/typescript/yaml/json

### Phase 4: Polish (1 day)

- SEO meta tags and Open Graph images
- Performance optimization (lazy load animations, image optimization)
- Accessibility audit (keyboard navigation, screen readers)
- Cross-browser testing
- Analytics (Vercel Analytics or Umami)

**Total estimate**: 6-8 days

---

## 7. SEO Strategy

### Key Pages and Targets

| Page               | Target Keywords                                                  |
| ------------------ | ---------------------------------------------------------------- |
| Landing (/)        | "AI coding orchestration", "multi-agent coding CLI"              |
| Docs (/docs)       | "kova cli documentation"                                         |
| Installation       | "kova cli install", "AI code agent setup"                        |
| Plan Templates     | "AI coding plan templates"                                       |
| GitHub Integration | "AI PR creation", "automated pull request from AI"               |
| Comparison         | "kova vs ralphy", "kova vs cursor", "AI coding tools comparison" |

### Meta Template

```html
<title>Kova - AI Coding Orchestration CLI | Plan the hunt. Run the pack.</title>
<meta
  name="description"
  content="Orchestrate 17+ specialist AI agents to plan, build, and ship code. Free, open source CLI with dependency-aware execution and independent quality validation."
/>
<meta property="og:image" content="/og-image.png" />
```

---

## 8. What Makes This Better Than Aqua's Site

| Aspect               | Aqua                     | Kova (Planned)                                           |
| -------------------- | ------------------------ | -------------------------------------------------------- |
| Visual identity      | Clean but generic        | Distinctive dark theme with animated wolf-pack aesthetic |
| Hero section         | Static text + screenshot | Animated terminal demo + fractal grid + typewriter       |
| Interactive elements | None on landing page     | Shift cards, direction tabs, LightBoard marquee          |
| Component quality    | Standard Tailwind        | cult-ui animated components (Framer Motion)              |
| Brand personality    | Professional/neutral     | "Wolf pack" identity, tactical mission briefing tone     |
| Documentation        | Excellent (reference)    | Matching depth with better visual design                 |
| First impression     | "This is a QA tool"      | "This is a weapon for shipping code"                     |

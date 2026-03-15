# Kova Website Research Summary

**Date**: 2026-03-14
**Agents Used**: 4 parallel research agents
**Sources**: cult-ui.com, aquaqa.com/docs, fumadocs.dev, starlight.astro.build, mintlify.com, 15+ component libraries

---

## Research Agent 1: cult-ui.com Components

**Finding**: 67+ animated React components, all shadcn-compatible, MIT licensed, copy-paste via CLI.

**Top 18 components selected for Kova** (prioritized):

| Tier      | Component            | Used For                                         |
| --------- | -------------------- | ------------------------------------------------ |
| Must-Have | Terminal Animation   | Hero -- animated CLI demo                        |
| Must-Have | Canvas Fractal Grid  | Hero/CTA backgrounds -- interactive dot grid     |
| Must-Have | Code Block           | Docs + landing -- tabbed syntax highlighting     |
| Must-Have | Stripe Bg Guides     | Features section -- animated vertical glow lines |
| Must-Have | Gradient Heading     | Hero + CTA -- silver-to-blue gradient text       |
| High      | Text Animate         | Section headings -- character entrance animation |
| High      | Typewriter           | Hero subtitle -- cycling taglines                |
| High      | Shift Card           | Features grid -- hover-reveal detail cards       |
| High      | Cosmic Button        | Primary CTA -- rotating gradient border          |
| High      | Bg Animate Button    | Secondary CTA -- animated gradient background    |
| High      | Direction Aware Tabs | How It Works -- Plan/Build/Ship tabs             |
| Medium    | LightBoard           | Marquee -- LED scrolling text                    |
| Medium    | Neumorph Eyebrow     | Badges -- "v1.0", "Open Source"                  |
| Medium    | Animated Number      | Stats -- count-up on scroll                      |

**Install method**: `pnpm dlx shadcn@latest add https://cult-ui.com/r/<name>.json`
**Dependencies**: Framer Motion, Shiki, CVA, Radix UI

---

## Research Agent 2: Aqua QA Docs Deep Dive

**Finding**: 16-page documentation using Starlight (Astro). Three-tier hierarchy.

**Key patterns to replicate**:

1. Progressive disclosure: Getting Started -> Guides -> Reference
2. Definition-first writing: explain concept, then show code
3. Bold keywords for emphasis (not callout boxes)
4. Every command has copy-paste code examples
5. Tables for structured data (Name | Type | Purpose)
6. LLM-friendly docs (llms.txt, llms-full.txt, llms-small.txt)
7. Short sections: 2-4 paragraphs max per section
8. Consistent page structure across all pages

**Aqua docs page count**: 16 pages total
**Kova docs page count** (planned): 25+ pages (more features)

---

## Research Agent 3: Docs Framework Comparison

**Scores** (out of 50):

| Framework    | Score     | Best For                                       |
| ------------ | --------- | ---------------------------------------------- |
| **Fumadocs** | **45/50** | Next.js projects needing dashboard integration |
| Nextra       | 42/50     | Simple Next.js docs                            |
| Starlight    | 34/50     | Pure static docs (Astro)                       |
| Mintlify     | 34/50     | Managed hosting ($300+/mo)                     |
| Docusaurus   | 30/50     | Large OSS projects                             |

**Winner: Fumadocs** because:

- Next.js native (same codebase as future dashboard)
- Headless architecture (full Tailwind customization)
- Built-in Orama search
- AI-native (LLMs.txt support)
- Free + self-hosted
- 3x YoY growth, used by v0 (Vercel)

**What popular CLI tools use**:

- Turborepo, Biome, Bun: Custom-built docs
- Cursor, Perplexity, Anthropic: Mintlify ($300+/mo)
- Fumadocs is the "build custom without the pain" option

---

## Research Agent 4: code-ui.com (Earlier Agent)

**Finding**: code-ui.com is a Romanian web design agency, NOT a component library.

**Redirected research** identified these additional libraries:

- Magic UI (magicui.design) -- 150+ animated components
- Aceternity UI (ui.aceternity.com) -- 200+ dramatic dark components
- Launch UI (launch-ui.com) -- Complete landing page sections
- Page UI (pageui.shipixen.com) -- Pricing, features, CTA sections

**Primary recommendation**: cult-ui covers all needs. Use Magic UI or Aceternity as fallbacks for specific effects.

---

## Final Architecture Decision

```
kova-website/ (Next.js 15 + Fumadocs + Tailwind v4 + cult-ui)
  app/
    page.tsx          # Landing page with cult-ui components
    docs/             # Fumadocs documentation (25+ MDX pages)
    pricing/          # Pricing page
  (future)
    dashboard/        # Team dashboard (Phase 5)
    api/              # Dashboard API
```

**Why this works**: One codebase serves landing page, docs, and future dashboard. Same auth, same styling, same deployment. No context-switching between frameworks.

---

## Implementation Priority

1. **Landing page first** (2-3 days) -- first impression for GitHub/Twitter visitors
2. **Documentation second** (2-3 days) -- needed once users install
3. **SEO + polish third** (1 day) -- meta tags, OG images, analytics
4. **Dashboard later** (Phase 5) -- only after CLI proves adoption

**Total**: 6-8 days to production-ready website + docs

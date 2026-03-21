# Plan: Kova v2.0 -- AI Coding Orchestrator with Intelligent Model Routing

## Task Description

Transform Kova CLI from a pure cost tracking tool into an AI coding orchestrator that can execute development tasks using LLMs with intelligent model routing. The key feature is automatic model selection based on task complexity: simple tasks route to cheap models (Haiku, GPT-4.1 Nano, Gemini Flash), moderate tasks to balanced models (Sonnet, GPT-4.1), and complex tasks to the strongest models (Opus, o3). Users can also manually override model selection. Every orchestrated task feeds into Kova's existing FinOps cost tracking pipeline, creating a unified "use AI + track what it costs" experience.

This transforms Kova from a monthly dashboard check into a daily-use developer tool, dramatically increasing engagement and making the cost tracking features a natural byproduct of usage rather than a standalone concern.

## Objective

When this plan is complete:

1. `kova run "add error handling to src/lib/uploader.ts"` works end-to-end: classifies complexity, picks the optimal model, streams the response, applies file edits, and records usage in the local store
2. `kova run --model anthropic:claude-haiku-4-5-20251001 "fix typo"` uses the exact specified model
3. `kova run --tier strong "redesign the sync architecture"` uses Opus/o3
4. `kova chat` opens an interactive REPL with streaming responses, file context, and model routing
5. `kova models` lists all available models with pricing and current routing config
6. `kova provider add anthropic` prompts for API key, stores securely, and tests the connection
7. Every AI request creates a UsageRecord in ~/.kova/usage.json with tool="kova_orchestrator"
8. `kova costs` shows orchestration costs alongside collector costs seamlessly
9. All new commands have comprehensive test suites

## Problem Statement

Kova v1.0.0 is a pure measurement tool -- it watches what developers spend on AI coding tools but offers no way to actually use those tools. This creates two problems:

1. **Low daily engagement**: Developers check cost dashboards weekly or monthly, not daily. This limits retention and word-of-mouth growth.
2. **No workflow integration**: The cost tracking is divorced from the actual AI coding workflow. Developers want to use AI for coding AND see what it costs in one place.

The solution is to make Kova the tool developers use to run AI coding tasks, with cost tracking as a built-in feature rather than a separate concern.

## Solution Approach

### Architecture: Vercel AI SDK + Custom Heuristic Router

**Why Vercel AI SDK** (20M+ monthly npm downloads):

- Unified `generateText()`/`streamText()` across Anthropic, OpenAI, Google, OpenRouter
- Normalized tool calling via Zod schemas -- same tool definitions work across all providers
- Token usage reported on every request (feeds directly into cost tracking)
- Provider registry enables string-based model routing (`anthropic:claude-sonnet-4-20250514`)
- TypeScript-native, Node 18+ compatible

**Model Routing Strategy** (validated by ICLR 2025 research -- 70%+ cost savings):

```
User prompt arrives
    |
    v
Heuristic Classifier:
  - Prompt length (short = simple, long = complex)
  - File count referenced (1 file = simple, 5+ = complex)
  - Keywords ("refactor", "architect", "migrate" = complex; "fix typo", "rename" = simple)
  - Explicit --model or --tier flag overrides everything
    |
    +--> simple   --> Haiku ($1/$5) or GPT-4.1 Nano ($0.10/$0.40) or Gemini Flash ($0.30/$2.50)
    +--> moderate --> Sonnet ($3/$15) or GPT-4.1 ($2/$8) or Gemini Pro ($1.25/$10)
    +--> complex  --> Opus ($5/$25) or o3 ($2/$8)
```

**Edit Format**: Search/replace blocks (Aider-proven, most reliable across LLMs)

**Tool Loop**: The LLM gets tools to read files, edit files, list directory contents, and run shell commands. It calls tools iteratively until the task is complete. Each tool call's token usage is tracked.

### Integration with Existing Cost Tracking

Every AI SDK request produces `usage.inputTokens` and `usage.outputTokens`. These feed directly into:

- `computeCost()` from `src/lib/cost-calculator.ts` (TOKEN_COSTS already has pricing for all models)
- `appendRecords()` from `src/lib/local-store.ts` (creates UsageRecord with tool="kova_orchestrator")
- The existing `kova costs`, `kova report`, `kova sync` commands work automatically

## Relevant Files

### Existing files to modify

- `src/index.ts` -- Register 4 new commands (run, chat, models, provider)
- `src/types.ts` -- Add `"kova_orchestrator"` to AiTool union, add new model IDs to AiModel, add orchestration types
- `src/lib/constants.ts` -- Add provider API key file path, update TOKEN_COSTS with latest pricing, add model tier mappings
- `src/lib/config-store.ts` -- Extend KovaFinOpsConfigExtended with orchestration config section
- `src/lib/credential-manager.ts` -- Add provider key management (separate from tool credentials)
- `package.json` -- Add Vercel AI SDK dependencies

### New Files

- `src/commands/run.ts` -- The `kova run` command (core orchestration)
- `src/commands/chat.ts` -- Interactive REPL chat command
- `src/commands/models.ts` -- List available models and pricing
- `src/commands/provider.ts` -- Manage AI provider API keys
- `src/lib/ai/provider-registry.ts` -- Creates Vercel AI SDK provider registry from configured keys
- `src/lib/ai/model-router.ts` -- Task complexity classifier + model selection
- `src/lib/ai/tools.ts` -- AI SDK tool definitions (readFile, editFile, listFiles, runCommand, searchFiles)
- `src/lib/ai/edit-applier.ts` -- Parses search/replace blocks from LLM output, applies to files
- `src/lib/ai/system-prompt.ts` -- System prompt construction with project context
- `src/lib/ai/cost-recorder.ts` -- Records AI SDK usage as UsageRecords in local store
- `tests/commands/run.test.ts` -- Tests for run command
- `tests/commands/chat.test.ts` -- Tests for chat command
- `tests/commands/models.test.ts` -- Tests for models command
- `tests/commands/provider.test.ts` -- Tests for provider command
- `tests/lib/ai/model-router.test.ts` -- Tests for complexity classifier
- `tests/lib/ai/edit-applier.test.ts` -- Tests for edit application
- `tests/lib/ai/cost-recorder.test.ts` -- Tests for cost recording
- `tests/lib/ai/provider-registry.test.ts` -- Tests for provider setup

## Implementation Phases

### Phase 1: Foundation

Install dependencies, extend types, set up provider credential management, and create the AI SDK provider registry. This is pure infrastructure with no user-facing commands yet.

**Key deliverables:**

- `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `zod` installed
- Provider key management in credential-manager.ts
- Provider registry module that creates AI SDK registry from stored keys
- Types extended with `"kova_orchestrator"` tool and orchestration config

### Phase 2: Core Implementation

Build the model router, tool definitions, edit applier, cost recorder, and the `kova run` command. This is the heart of the feature.

**Key deliverables:**

- Heuristic complexity classifier with model selection
- AI SDK tools for file operations and shell commands
- Search/replace edit parser and applier
- Cost recording bridge (AI SDK usage -> UsageRecord -> local store)
- `kova run <prompt>` working end-to-end

### Phase 3: Commands and Polish

Build remaining commands (`chat`, `models`, `provider`), add comprehensive tests, update help text.

**Key deliverables:**

- Interactive `kova chat` REPL
- `kova models` listing
- `kova provider` management
- Full test suite for all new code
- Updated CLI description and help

## Team Orchestration

You are the team lead. Deploy specialists in parallel tracks as documented below. Never write code directly.

### Team Members

- Specialist
  - Name: foundation-engineer
  - Role: Install dependencies, extend types, build provider credential management and AI SDK registry
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: router-engineer
  - Role: Build the model router (complexity classifier + model selection logic)
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: tools-engineer
  - Role: Build AI SDK tool definitions and the edit applier for search/replace blocks
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: run-command-engineer
  - Role: Build the kova run command with streaming, tool loop, and cost recording
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: commands-engineer
  - Role: Build kova chat, kova models, and kova provider commands
  - Agent Type: backend-engineer
  - Resume: true

- Specialist
  - Name: test-engineer
  - Role: Write comprehensive tests for all new modules and commands
  - Agent Type: quality-engineer
  - Resume: true

- Quality Engineer (Validator)
  - Name: phase-validator
  - Role: Validate all deliverables against acceptance criteria (read-only inspection mode)
  - Agent Type: quality-engineer
  - Resume: false

## Step by Step Tasks

### 1. Install Dependencies and Extend Types

- **Task ID**: install-deps-extend-types
- **Depends On**: none
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Read these files first:

- `package.json` (full)
- `src/types.ts` (full)
- `src/lib/constants.ts` (full)
- `src/lib/config-store.ts` (full)
- `tsup.config.ts` (full)

**Install dependencies:**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @openrouter/ai-sdk-provider zod
```

**Extend `src/types.ts`:**

Add `"kova_orchestrator"` to the `AiTool` union type:

```typescript
export type AiTool =
  | "claude_code"
  | "cursor"
  // ... existing tools ...
  | "lovable"
  | "kova_orchestrator"; // NEW: Kova's own orchestration tool
```

Add new model IDs to `AiModel`:

```typescript
export type AiModel =
  | "haiku"
  | "sonnet"
  | "opus"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4.1"
  | "gpt-4.1-mini" // NEW
  | "gpt-4.1-nano" // NEW
  | "gpt-5"
  | "gpt-5-mini"
  | "o1"
  | "o3"
  | "o4-mini" // NEW
  | "gemini-pro"
  | "gemini-flash"
  | "swe-1.5"
  | "swe-1.5-fast"
  | "unknown";
```

Add orchestration types:

```typescript
export type AiProvider = "anthropic" | "openai" | "google" | "openrouter";

export type ModelTier = "cheap" | "mid" | "strong";

export type TaskComplexity = "simple" | "moderate" | "complex";

export interface OrchestrationConfig {
  default_provider: AiProvider;
  default_model?: string; // full AI SDK model ID override
  routing: {
    simple: string; // AI SDK model ID, e.g. "anthropic:claude-haiku-4-5-20251001"
    moderate: string; // e.g. "anthropic:claude-sonnet-4-20250514"
    complex: string; // e.g. "anthropic:claude-opus-4-20250115"
  };
  auto_apply: boolean;
  max_tokens: number;
  temperature: number;
}

export interface ProviderCredentials {
  anthropic?: string;
  openai?: string;
  google?: string;
  openrouter?: string;
}
```

**Extend `src/lib/constants.ts`:**

Add provider credentials file path:

```typescript
export const PROVIDER_CREDENTIALS_FILE = "provider-keys.json";
```

Update TOKEN_COSTS with latest pricing and new model IDs:

```typescript
// Add to TOKEN_COSTS:
"gpt-4.1-mini": { input: 0.4, output: 1.6 },
"gpt-4.1-nano": { input: 0.1, output: 0.4 },
"o4-mini": { input: 0.55, output: 2.2 },
```

Add model tier mappings:

```typescript
export const MODEL_TIERS: Record<
  string,
  { tier: string; provider: string; sdkId: string }
> = {
  // Anthropic
  haiku: {
    tier: "cheap",
    provider: "anthropic",
    sdkId: "claude-haiku-4-5-20251001",
  },
  sonnet: {
    tier: "mid",
    provider: "anthropic",
    sdkId: "claude-sonnet-4-20250514",
  },
  opus: {
    tier: "strong",
    provider: "anthropic",
    sdkId: "claude-opus-4-20250115",
  },
  // OpenAI
  "gpt-4.1-nano": { tier: "cheap", provider: "openai", sdkId: "gpt-4.1-nano" },
  "gpt-4.1-mini": { tier: "cheap", provider: "openai", sdkId: "gpt-4.1-mini" },
  "gpt-4.1": { tier: "mid", provider: "openai", sdkId: "gpt-4.1" },
  "gpt-4o": { tier: "mid", provider: "openai", sdkId: "gpt-4o" },
  o3: { tier: "strong", provider: "openai", sdkId: "o3" },
  "o4-mini": { tier: "mid", provider: "openai", sdkId: "o4-mini" },
  // Google
  "gemini-flash": {
    tier: "cheap",
    provider: "google",
    sdkId: "gemini-2.5-flash",
  },
  "gemini-pro": { tier: "mid", provider: "google", sdkId: "gemini-2.5-pro" },
};

export const DEFAULT_ROUTING = {
  simple: "anthropic:claude-haiku-4-5-20251001",
  moderate: "anthropic:claude-sonnet-4-20250514",
  complex: "anthropic:claude-opus-4-20250115",
};
```

**Extend `src/lib/config-store.ts`:**

Add `orchestration` to `KovaFinOpsConfigExtended`:

```typescript
export interface KovaFinOpsConfigExtended extends KovaFinOpsConfig {
  // ... existing optional sections ...
  orchestration?: OrchestrationConfig;
}
```

Update `getDefaultConfig()` to include orchestration defaults. Update `updateConfig()` to handle the `orchestration` section.

---

### 2. Provider Credential Management

- **Task ID**: provider-credentials
- **Depends On**: install-deps-extend-types
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Read these files first:

- `src/lib/credential-manager.ts` (full) -- pattern to follow
- `src/lib/constants.ts` (after Task 1 modifications)
- `src/types.ts` (after Task 1 modifications)

**Extend `src/lib/credential-manager.ts`** with provider key functions:

Add these functions (following the exact pattern of existing tool credential functions):

```typescript
// Provider API key storage (separate file from tool credentials)
const PROVIDER_CREDENTIALS_FILE = "provider-keys.json";

export function getProviderCredentialsPath(): string {
  return path.join(KOVA_DATA_DIR, PROVIDER_CREDENTIALS_FILE);
}

export function readProviderCredentials(): ProviderCredentials {
  try {
    const raw = fs.readFileSync(getProviderCredentialsPath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ProviderCredentials;
  } catch {
    return {};
  }
}

export function writeProviderCredentials(creds: ProviderCredentials): void {
  const dir = path.dirname(getProviderCredentialsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getProviderCredentialsPath(),
    JSON.stringify(creds, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

export function getProviderKey(provider: AiProvider): string | null {
  const creds = readProviderCredentials();
  return creds[provider] ?? null;
}

export function setProviderKey(provider: AiProvider, key: string): void {
  const creds = readProviderCredentials();
  creds[provider] = key;
  writeProviderCredentials(creds);
}

export function removeProviderKey(provider: AiProvider): void {
  const creds = readProviderCredentials();
  delete creds[provider];
  writeProviderCredentials(creds);
}

export function listConfiguredProviders(): AiProvider[] {
  const creds = readProviderCredentials();
  return (Object.keys(creds) as AiProvider[]).filter(
    (k) => creds[k] !== undefined && creds[k] !== "",
  );
}
```

Import `AiProvider` and `ProviderCredentials` from types.

---

### 3. AI SDK Provider Registry

- **Task ID**: provider-registry
- **Depends On**: provider-credentials
- **Assigned To**: foundation-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Create `src/lib/ai/provider-registry.ts`:

```typescript
import { createProviderRegistry } from "ai";
import type { ProviderCredentials } from "../../types.js";

export function createKovaRegistry(credentials: ProviderCredentials) {
  const providers: Record<string, unknown> = {};

  if (credentials.anthropic) {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    providers.anthropic = createAnthropic({ apiKey: credentials.anthropic });
  }

  if (credentials.openai) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    providers.openai = createOpenAI({ apiKey: credentials.openai });
  }

  if (credentials.google) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    providers.google = createGoogleGenerativeAI({ apiKey: credentials.google });
  }

  if (credentials.openrouter) {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    providers.openrouter = createOpenRouter({ apiKey: credentials.openrouter });
  }

  if (Object.keys(providers).length === 0) {
    return null; // No providers configured
  }

  return createProviderRegistry(providers);
}
```

Note: Use dynamic imports for provider packages so they are only loaded when the provider is configured. This keeps the CLI fast for non-orchestration commands.

---

### 4. Model Router (Complexity Classifier)

- **Task ID**: model-router
- **Depends On**: install-deps-extend-types
- **Assigned To**: router-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true (independent of Tasks 2-3)

Create `src/lib/ai/model-router.ts`:

```typescript
import type { TaskComplexity, OrchestrationConfig } from "../../types.js";
import { DEFAULT_ROUTING } from "../constants.js";

// Keywords that indicate high complexity
const COMPLEX_KEYWORDS = [
  "architect",
  "redesign",
  "migrate",
  "refactor entire",
  "rewrite",
  "implement from scratch",
  "design system",
  "database schema",
  "api design",
  "security audit",
  "performance optimization",
  "multi-file",
  "cross-module",
];

// Keywords that indicate low complexity
const SIMPLE_KEYWORDS = [
  "fix typo",
  "rename",
  "format",
  "add comment",
  "update import",
  "change variable",
  "fix lint",
  "add type",
  "remove unused",
  "fix spacing",
];

export function classifyComplexity(prompt: string): TaskComplexity {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;

  // Check for explicit complexity signals
  if (COMPLEX_KEYWORDS.some((kw) => lower.includes(kw))) return "complex";
  if (SIMPLE_KEYWORDS.some((kw) => lower.includes(kw))) return "simple";

  // Heuristic: longer prompts tend to be more complex
  if (wordCount > 100) return "complex";
  if (wordCount > 30) return "moderate";

  return "simple";
}

export function selectModel(
  complexity: TaskComplexity,
  config?: OrchestrationConfig,
): string {
  // If config specifies a default model override, use it
  if (config?.default_model) return config.default_model;

  const routing = config?.routing ?? DEFAULT_ROUTING;

  switch (complexity) {
    case "simple":
      return routing.simple;
    case "moderate":
      return routing.moderate;
    case "complex":
      return routing.complex;
  }
}

export function tierToComplexity(tier: string): TaskComplexity {
  switch (tier) {
    case "cheap":
      return "simple";
    case "mid":
      return "moderate";
    case "strong":
      return "complex";
    default:
      return "moderate";
  }
}

export function getModelDisplayName(sdkModelId: string): string {
  // "anthropic:claude-sonnet-4-20250514" -> "Claude Sonnet 4"
  const parts = sdkModelId.split(":");
  const modelPart = parts[1] ?? parts[0] ?? sdkModelId;
  return modelPart
    .replace(/-\d{8}$/, "") // strip date suffix
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
```

---

### 5. AI SDK Tools (File Operations + Shell)

- **Task ID**: ai-tools
- **Depends On**: install-deps-extend-types
- **Assigned To**: tools-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true (independent of Tasks 2-4)

Create `src/lib/ai/tools.ts`:

Define tools using the Vercel AI SDK `tool()` helper with Zod schemas. These tools allow the LLM to interact with the local filesystem and run commands.

```typescript
import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { execa } from "execa";

export function createCodingTools(workingDir: string) {
  return {
    readFile: tool({
      description:
        "Read the contents of a file. Use this to understand existing code before making changes.",
      parameters: z.object({
        filePath: z
          .string()
          .describe("Relative path to the file from the project root"),
      }),
      execute: async ({ filePath }) => {
        const fullPath = path.resolve(workingDir, filePath);
        // Security: prevent path traversal outside working directory
        if (!fullPath.startsWith(workingDir)) {
          return {
            error:
              "Path traversal detected. Must stay within project directory.",
          };
        }
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          return { content, lines: content.split("\n").length };
        } catch {
          return { error: `File not found: ${filePath}` };
        }
      },
    }),

    editFile: tool({
      description:
        "Edit a file by replacing a specific string with new content. The old_string must match exactly (including whitespace and indentation).",
      parameters: z.object({
        filePath: z.string().describe("Relative path to the file"),
        oldString: z.string().describe("The exact string to find and replace"),
        newString: z.string().describe("The replacement string"),
      }),
      execute: async ({ filePath, oldString, newString }) => {
        const fullPath = path.resolve(workingDir, filePath);
        if (!fullPath.startsWith(workingDir)) {
          return { error: "Path traversal detected." };
        }
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (!content.includes(oldString)) {
            return {
              error: `Could not find the specified string in ${filePath}. Make sure it matches exactly.`,
            };
          }
          const occurrences = content.split(oldString).length - 1;
          if (occurrences > 1) {
            return {
              error: `Found ${occurrences} occurrences of the string. Please provide more context to make the match unique.`,
            };
          }
          const updated = content.replace(oldString, newString);
          fs.writeFileSync(fullPath, updated, "utf-8");
          return { success: true, filePath };
        } catch {
          return { error: `Failed to edit ${filePath}` };
        }
      },
    }),

    createFile: tool({
      description: "Create a new file with the given content.",
      parameters: z.object({
        filePath: z.string().describe("Relative path for the new file"),
        content: z.string().describe("The file content to write"),
      }),
      execute: async ({ filePath, content }) => {
        const fullPath = path.resolve(workingDir, filePath);
        if (!fullPath.startsWith(workingDir)) {
          return { error: "Path traversal detected." };
        }
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, "utf-8");
        return { success: true, filePath };
      },
    }),

    listFiles: tool({
      description:
        "List files in a directory. Use this to understand project structure.",
      parameters: z.object({
        dirPath: z
          .string()
          .describe(
            "Relative path to the directory (use '.' for project root)",
          ),
        recursive: z
          .boolean()
          .optional()
          .describe("If true, list files recursively"),
      }),
      execute: async ({ dirPath, recursive }) => {
        const fullPath = path.resolve(workingDir, dirPath);
        if (!fullPath.startsWith(workingDir)) {
          return { error: "Path traversal detected." };
        }
        try {
          if (recursive) {
            const files: string[] = [];
            const walk = (dir: string) => {
              for (const entry of fs.readdirSync(dir, {
                withFileTypes: true,
              })) {
                if (entry.name === "node_modules" || entry.name === ".git")
                  continue;
                const p = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(p);
                else files.push(path.relative(workingDir, p));
              }
            };
            walk(fullPath);
            return { files: files.slice(0, 200) }; // Cap at 200 files
          }
          const entries = fs.readdirSync(fullPath, { withFileTypes: true });
          return {
            entries: entries.map((e) => ({
              name: e.name,
              type: e.isDirectory() ? "dir" : "file",
            })),
          };
        } catch {
          return { error: `Directory not found: ${dirPath}` };
        }
      },
    }),

    runCommand: tool({
      description:
        "Run a shell command in the project directory. Use for running tests, linting, or checking build status.",
      parameters: z.object({
        command: z.string().describe("The shell command to run"),
      }),
      execute: async ({ command }) => {
        try {
          const result = await execa(command, {
            shell: true,
            cwd: workingDir,
            timeout: 30_000,
            reject: false,
          });
          return {
            stdout: result.stdout.slice(0, 5000), // Cap output
            stderr: result.stderr.slice(0, 2000),
            exitCode: result.exitCode,
          };
        } catch {
          return { error: `Command failed: ${command}` };
        }
      },
    }),

    searchFiles: tool({
      description:
        "Search for a pattern across files in the project. Returns matching file paths and line content.",
      parameters: z.object({
        pattern: z.string().describe("The text pattern to search for"),
        glob: z
          .string()
          .optional()
          .describe(
            "File glob pattern to filter (e.g. '*.ts', 'src/**/*.tsx')",
          ),
      }),
      execute: async ({ pattern, glob: fileGlob }) => {
        try {
          const args = [
            "--no-heading",
            "--line-number",
            "--max-count=5",
            "--max-filesize=1M",
          ];
          if (fileGlob) args.push("--glob", fileGlob);
          args.push(pattern, ".");

          const result = await execa("rg", args, {
            cwd: workingDir,
            timeout: 10_000,
            reject: false,
          });

          const lines = result.stdout.split("\n").slice(0, 50);
          return { matches: lines.filter(Boolean) };
        } catch {
          // Fallback to grep if rg not available
          try {
            const result = await execa(
              "grep",
              [
                "-rn",
                "--include=*.ts",
                "--include=*.tsx",
                "--include=*.js",
                pattern,
                ".",
              ],
              {
                cwd: workingDir,
                timeout: 10_000,
                reject: false,
              },
            );
            const lines = result.stdout.split("\n").slice(0, 50);
            return { matches: lines.filter(Boolean) };
          } catch {
            return { error: "Search failed. Neither rg nor grep available." };
          }
        }
      },
    }),
  };
}
```

**Security considerations:**

- All file operations validate that resolved paths stay within `workingDir` (prevents path traversal)
- Shell commands have a 30-second timeout
- File listings skip `node_modules` and `.git`
- Search output capped at 50 matches
- Command output capped at 5000 chars stdout, 2000 chars stderr

---

### 6. System Prompt Construction

- **Task ID**: system-prompt
- **Depends On**: install-deps-extend-types
- **Assigned To**: tools-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/lib/ai/system-prompt.ts`:

```typescript
import fs from "fs";
import path from "path";

export function buildSystemPrompt(workingDir: string): string {
  const projectName = path.basename(workingDir);

  // Try to detect project context
  let techContext = "";
  const packageJsonPath = path.join(workingDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = Object.keys(pkg.dependencies ?? {})
        .slice(0, 15)
        .join(", ");
      techContext = `\nProject: ${pkg.name ?? projectName} (${pkg.description ?? ""})\nDependencies: ${deps}`;
    } catch {
      // Ignore parse errors
    }
  }

  return `You are an expert software engineer working on the project "${projectName}" in ${workingDir}.
${techContext}

Your job is to complete coding tasks by reading, editing, and creating files. Follow these rules:

1. Always read a file before editing it to understand its current state.
2. Make minimal, focused changes. Do not refactor code you were not asked to change.
3. Preserve existing code style, indentation, and conventions.
4. When editing files, the oldString must match EXACTLY (including whitespace).
5. Do not add unnecessary comments, docstrings, or type annotations to code you did not change.
6. If you need to understand the project structure, use listFiles first.
7. If you need to find where something is defined or used, use searchFiles.
8. After making changes, verify they are correct by reading the modified file.
9. Do not run destructive commands (rm -rf, git reset --hard, etc.).

When you are done with the task, explain what you changed and why.`;
}
```

---

### 7. Cost Recorder (AI SDK Usage -> UsageRecord)

- **Task ID**: cost-recorder
- **Depends On**: install-deps-extend-types
- **Assigned To**: run-command-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/lib/ai/cost-recorder.ts`:

```typescript
import crypto from "crypto";
import type { AiModel, UsageRecord } from "../../types.js";
import { TOKEN_COSTS } from "../constants.js";
import { appendRecords } from "../local-store.js";
import { computeCost } from "../cost-calculator.js";

interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Map an AI SDK model ID (e.g. "claude-sonnet-4-20250514") to our canonical AiModel name.
 */
export function mapSdkModelToCanonical(sdkModelId: string): AiModel {
  const lower = sdkModelId.toLowerCase();
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("gpt-4.1-nano")) return "gpt-4.1-nano" as AiModel;
  if (lower.includes("gpt-4.1-mini")) return "gpt-4.1-mini" as AiModel;
  if (lower.includes("gpt-4.1")) return "gpt-4.1";
  if (lower.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  if (lower.includes("gpt-5-mini")) return "gpt-5-mini";
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("o4-mini")) return "o4-mini" as AiModel;
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("gemini") && lower.includes("flash"))
    return "gemini-flash";
  if (lower.includes("gemini") && lower.includes("pro")) return "gemini-pro";
  return "unknown";
}

/**
 * Record an AI SDK request as a UsageRecord in the local store.
 */
export function recordAiUsage(params: {
  modelId: string; // Full SDK model ID (e.g. "claude-sonnet-4-20250514")
  usage: AiUsage;
  sessionId: string;
  project: string | null;
  durationMs: number;
}): UsageRecord {
  const canonicalModel = mapSdkModelToCanonical(params.modelId);
  const costUsd = computeCost(
    canonicalModel,
    params.usage.inputTokens,
    params.usage.outputTokens,
  );

  const record: UsageRecord = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    tool: "kova_orchestrator",
    model: canonicalModel,
    session_id: params.sessionId,
    project: params.project,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    cost_usd: costUsd,
    timestamp: new Date().toISOString(),
    duration_ms: params.durationMs,
    metadata: { sdk_model_id: params.modelId },
  };

  appendRecords([record]);
  return record;
}
```

---

### 8. The `kova run` Command

- **Task ID**: run-command
- **Depends On**: provider-registry, model-router, ai-tools, system-prompt, cost-recorder
- **Assigned To**: run-command-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Create `src/commands/run.ts`:

```typescript
import crypto from "crypto";
import chalk from "chalk";
import { streamText } from "ai";
import type { AiProvider } from "../types.js";
import { readConfig } from "../lib/config-store.js";
import { readProviderCredentials } from "../lib/credential-manager.js";
import { createKovaRegistry } from "../lib/ai/provider-registry.js";
import {
  classifyComplexity,
  selectModel,
  tierToComplexity,
  getModelDisplayName,
} from "../lib/ai/model-router.js";
import { createCodingTools } from "../lib/ai/tools.js";
import { buildSystemPrompt } from "../lib/ai/system-prompt.js";
import { recordAiUsage } from "../lib/ai/cost-recorder.js";
import * as logger from "../lib/logger.js";
import { colors } from "../lib/constants.js";

export interface RunOptions {
  model?: string;
  provider?: string;
  tier?: string;
  dryRun?: boolean;
  autoApply?: boolean;
}

export async function runCommand(
  prompt: string,
  options: RunOptions,
): Promise<void> {
  const config = readConfig();
  const creds = readProviderCredentials();
  const registry = await createKovaRegistry(creds);

  if (!registry) {
    logger.error("No AI providers configured. Run: kova provider add <name>");
    logger.info("Supported providers: anthropic, openai, google, openrouter");
    process.exitCode = 1;
    return;
  }

  // Determine model
  let modelId: string;
  if (options.model) {
    modelId = options.model; // Direct override: "anthropic:claude-sonnet-4-20250514"
  } else if (options.tier) {
    const complexity = tierToComplexity(options.tier);
    modelId = selectModel(complexity, config.orchestration);
  } else {
    const complexity = classifyComplexity(prompt);
    modelId = selectModel(complexity, config.orchestration);
    logger.info(`Complexity: ${complexity} -> ${getModelDisplayName(modelId)}`);
  }

  if (options.dryRun) {
    logger.header("Dry Run");
    logger.table([
      ["Prompt", prompt],
      ["Model", modelId],
      ["Complexity", classifyComplexity(prompt)],
      ["Working Dir", process.cwd()],
    ]);
    return;
  }

  const workingDir = process.cwd();
  const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const projectName = require("path").basename(workingDir);

  logger.header(`kova run`);
  logger.info(`Model: ${colors.brand(getModelDisplayName(modelId))}`);
  logger.info(`Project: ${projectName}`);
  console.log();

  const startTime = Date.now();

  try {
    const result = streamText({
      model: registry.languageModel(modelId),
      system: buildSystemPrompt(workingDir),
      prompt,
      tools: createCodingTools(workingDir),
      maxSteps: 25, // Allow up to 25 tool calls
      maxTokens: config.orchestration?.max_tokens ?? 8192,
      temperature: config.orchestration?.temperature ?? 0,
      onStepFinish({ toolCalls }) {
        // Log each tool call as it happens
        for (const tc of toolCalls ?? []) {
          const args = tc.args as Record<string, unknown>;
          const filePath = args.filePath ?? args.dirPath ?? args.command ?? "";
          logger.progress("done", tc.toolName, String(filePath));
        }
      },
    });

    // Stream text output to terminal
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log();

    const durationMs = Date.now() - startTime;
    const usage = await result.usage;

    // Record cost
    const record = recordAiUsage({
      modelId: modelId.split(":")[1] ?? modelId,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
      sessionId,
      project: projectName,
      durationMs,
    });

    // Summary
    console.log();
    logger.table([
      ["Cost", colors.brand(`$${record.cost_usd.toFixed(4)}`)],
      [
        "Tokens",
        `${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out`,
      ],
      ["Duration", `${(durationMs / 1000).toFixed(1)}s`],
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Run failed: ${message}`);
    process.exitCode = 1;
  }
}
```

**Register in `src/index.ts`:**

```typescript
// Run command
program
  .command("run <prompt>")
  .description("Execute an AI coding task with intelligent model routing")
  .option(
    "--model <id>",
    "Use specific model (e.g. anthropic:claude-sonnet-4-20250514)",
  )
  .option(
    "--provider <name>",
    "Use specific provider (anthropic, openai, google, openrouter)",
  )
  .option("--tier <tier>", "Use model tier: cheap, mid, or strong")
  .option("--dry-run", "Show what would happen without making changes")
  .option("--auto-apply", "Apply file edits without confirmation")
  .action(
    wrapCommandAction(async (prompt, options) => {
      const { runCommand } = await import("./commands/run.js");
      await runCommand(
        prompt as string,
        options as import("./commands/run.js").RunOptions,
      );
    }),
  );
```

---

### 9. The `kova provider` Command

- **Task ID**: provider-command
- **Depends On**: provider-credentials
- **Assigned To**: commands-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true (can start once Task 2 is done)

Create `src/commands/provider.ts`:

Subcommands:

- `kova provider add <name>` -- Prompt for API key, store in provider-keys.json, test with a small API call
- `kova provider list` -- Show configured providers with masked keys
- `kova provider test <name>` -- Verify API key works by making a minimal `generateText()` call
- `kova provider remove <name>` -- Remove provider key

Follow the pattern of `src/commands/config-cmd.ts` for subcommand routing.

For `provider test`: use `generateText({ model: registry.languageModel(testModelId), prompt: "Say hello", maxTokens: 10 })` and verify it returns without error.

Register in `src/index.ts` as:

```typescript
program
  .command("provider <action> [name]")
  .description("Manage AI provider API keys (add, list, test, remove)")
  .action(...)
```

---

### 10. The `kova models` Command

- **Task ID**: models-command
- **Depends On**: provider-credentials, model-router
- **Assigned To**: commands-engineer
- **Agent Type**: backend-engineer
- **Parallel**: true

Create `src/commands/models.ts`:

Display a formatted table of all available models showing:

- Model name (canonical)
- Provider
- Tier (cheap/mid/strong)
- Input cost (per 1M tokens)
- Output cost (per 1M tokens)
- Whether the provider key is configured (checkmark or X)
- Which models are currently assigned to each routing tier

Use `TOKEN_COSTS` from constants.ts and `MODEL_TIERS` for the data. Use `listConfiguredProviders()` to show availability.

Show the current routing config at the bottom:

```
Current routing:
  simple   -> Claude Haiku 4.5       ($1.00 / $5.00 per 1M)
  moderate -> Claude Sonnet 4        ($3.00 / $15.00 per 1M)
  complex  -> Claude Opus 4          ($5.00 / $25.00 per 1M)
```

Register in `src/index.ts`.

---

### 11. The `kova chat` Command

- **Task ID**: chat-command
- **Depends On**: run-command
- **Assigned To**: commands-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Create `src/commands/chat.ts`:

Interactive REPL chat session using Node.js readline interface:

```typescript
import readline from "readline";
import crypto from "crypto";
import { streamText, type CoreMessage } from "ai";
// ... imports ...

export async function chatCommand(options: ChatOptions): Promise<void> {
  // Setup registry, model selection (same as run command)
  // ...

  const messages: CoreMessage[] = [];
  const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  logger.header("kova chat");
  logger.info(`Model: ${getModelDisplayName(modelId)}`);
  logger.info(
    "Type 'exit' or Ctrl+C to quit. Type '/model <id>' to switch models.",
  );
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.brand("kova> "),
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input === "exit" || input === "quit") {
      rl.close();
      return;
    }

    // Handle /model command to switch models mid-session
    if (input.startsWith("/model ")) {
      modelId = input.slice(7).trim();
      logger.info(`Switched to: ${getModelDisplayName(modelId)}`);
      rl.prompt();
      return;
    }

    messages.push({ role: "user", content: input });

    const startTime = Date.now();
    const result = streamText({
      model: registry.languageModel(modelId),
      system: buildSystemPrompt(workingDir),
      messages,
      tools: createCodingTools(workingDir),
      maxSteps: 15,
      maxTokens: config.orchestration?.max_tokens ?? 8192,
    });

    let fullResponse = "";
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log("\n");

    messages.push({ role: "assistant", content: fullResponse });

    const usage = await result.usage;
    const durationMs = Date.now() - startTime;

    recordAiUsage({
      modelId: modelId.split(":")[1] ?? modelId,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
      sessionId,
      project: require("path").basename(workingDir),
      durationMs,
    });

    logger.info(
      chalk.dim(
        `$${computeCost(mapSdkModelToCanonical(modelId.split(":")[1] ?? modelId), usage.inputTokens, usage.outputTokens).toFixed(4)} | ${usage.inputTokens + usage.outputTokens} tokens | ${(durationMs / 1000).toFixed(1)}s`,
      ),
    );
    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    logger.success("Chat session ended.");
    process.exit(0);
  });
}
```

Features:

- `/model <id>` to switch models mid-conversation
- `/clear` to reset conversation history
- Message history maintained across turns
- Each turn recorded as a UsageRecord
- Cost displayed after each response

Register in `src/index.ts`.

---

### 12. Register All New Commands in index.ts

- **Task ID**: register-commands
- **Depends On**: run-command, provider-command, models-command, chat-command
- **Assigned To**: commands-engineer
- **Agent Type**: backend-engineer
- **Parallel**: false

Update `src/index.ts` to register all 4 new commands following the existing pattern (dynamic imports, wrapCommandAction, typed options).

Also update the program description:

```typescript
program
  .name("kova")
  .description(
    "AI dev tool cost tracker and coding orchestrator - Use AI tools and know what they cost.",
  );
```

---

### 13. Write Tests for All New Modules

- **Task ID**: write-tests
- **Depends On**: register-commands
- **Assigned To**: test-engineer
- **Agent Type**: quality-engineer
- **Parallel**: false

Create test files following the existing pattern (vitest, no external mocking libraries, mock fs and network calls):

**`tests/lib/ai/model-router.test.ts`:**

- Test `classifyComplexity()` with simple, moderate, and complex prompts
- Test keyword detection (COMPLEX_KEYWORDS trigger "complex", SIMPLE_KEYWORDS trigger "simple")
- Test word count heuristics (>100 words = complex, >30 = moderate, <30 = simple)
- Test `selectModel()` with default routing
- Test `selectModel()` with custom routing config
- Test `selectModel()` with `default_model` override
- Test `tierToComplexity()` mapping

**`tests/lib/ai/cost-recorder.test.ts`:**

- Test `mapSdkModelToCanonical()` for all model families (Claude, OpenAI, Google)
- Test `recordAiUsage()` creates correct UsageRecord with tool="kova_orchestrator"
- Test cost calculation matches TOKEN_COSTS values
- Test record is appended to local store

**`tests/lib/ai/edit-applier.test.ts`:** (if edit-applier is separated from tools)

- Test path traversal prevention
- Test exact match requirement
- Test multiple occurrence rejection

**`tests/lib/ai/provider-registry.test.ts`:**

- Test registry creation with single provider
- Test registry creation with multiple providers
- Test returns null when no credentials configured

**`tests/commands/run.test.ts`:**

- Test dry-run mode outputs model and complexity
- Test error when no providers configured
- Test model override via --model flag
- Test tier override via --tier flag
- Mock AI SDK calls to verify tool loop and cost recording

**`tests/commands/provider.test.ts`:**

- Test add/list/remove flow
- Test key masking in list output
- Test error on invalid provider name

**`tests/commands/models.test.ts`:**

- Test output includes all model tiers
- Test provider availability indicators

**`tests/commands/chat.test.ts`:**

- Test /model command switches model
- Test exit command closes session
- Test empty input is handled

Target: **80+ new test cases** across all new modules.

---

### 14. Final Validation

- **Task ID**: validate-all
- **Depends On**: write-tests
- **Assigned To**: phase-validator
- **Agent Type**: quality-engineer
- **Parallel**: false

Operate in read-only inspection mode. Do not modify any files.

**Checklist -- Dependencies:**

- [ ] `grep "\"ai\"" package.json` -- AI SDK installed
- [ ] `grep "@ai-sdk/anthropic" package.json` -- Anthropic provider installed
- [ ] `grep "@ai-sdk/openai" package.json` -- OpenAI provider installed
- [ ] `grep "@ai-sdk/google" package.json` -- Google provider installed
- [ ] `grep "zod" package.json` -- Zod installed

**Checklist -- Types:**

- [ ] `grep "kova_orchestrator" src/types.ts` -- New tool type added
- [ ] `grep "AiProvider" src/types.ts` -- Provider type added
- [ ] `grep "ModelTier" src/types.ts` -- Tier type added
- [ ] `grep "OrchestrationConfig" src/types.ts` -- Config type added

**Checklist -- New modules:**

- [ ] `ls src/lib/ai/provider-registry.ts` -- Provider registry exists
- [ ] `ls src/lib/ai/model-router.ts` -- Model router exists
- [ ] `ls src/lib/ai/tools.ts` -- AI tools exist
- [ ] `ls src/lib/ai/system-prompt.ts` -- System prompt exists
- [ ] `ls src/lib/ai/cost-recorder.ts` -- Cost recorder exists

**Checklist -- New commands:**

- [ ] `ls src/commands/run.ts` -- Run command exists
- [ ] `ls src/commands/chat.ts` -- Chat command exists
- [ ] `ls src/commands/models.ts` -- Models command exists
- [ ] `ls src/commands/provider.ts` -- Provider command exists
- [ ] `grep "\"run\"" src/index.ts` -- Run registered
- [ ] `grep "\"chat\"" src/index.ts` -- Chat registered
- [ ] `grep "\"models\"" src/index.ts` -- Models registered
- [ ] `grep "\"provider\"" src/index.ts` -- Provider registered

**Checklist -- Security:**

- [ ] `grep "startsWith(workingDir)" src/lib/ai/tools.ts` -- Path traversal prevention
- [ ] `grep "0o600" src/lib/credential-manager.ts` -- Provider keys stored securely
- [ ] `grep "timeout" src/lib/ai/tools.ts` -- Shell command timeout exists

**Checklist -- Tests:**

- [ ] `ls tests/lib/ai/model-router.test.ts` -- Router tests exist
- [ ] `ls tests/lib/ai/cost-recorder.test.ts` -- Cost recorder tests exist
- [ ] `ls tests/commands/run.test.ts` -- Run tests exist
- [ ] `ls tests/commands/provider.test.ts` -- Provider tests exist
- [ ] `ls tests/commands/models.test.ts` -- Models tests exist

**Checklist -- Build health:**

- [ ] `npm run build` -- Builds without errors
- [ ] `npm test` -- All tests pass (553 existing + 80+ new)
- [ ] `npx tsc --noEmit` -- No TypeScript errors

Report: PASS or FAIL for each item with specific failure details.

## Acceptance Criteria

1. **`kova run` works end-to-end**: `kova run "add error handling to src/lib/uploader.ts"` classifies complexity, picks model, streams response, applies file edits, and records usage as a UsageRecord with `tool: "kova_orchestrator"`.

2. **Model override works**: `kova run --model anthropic:claude-haiku-4-5-20251001 "fix typo"` uses the exact specified model, ignoring auto-routing.

3. **Tier override works**: `kova run --tier strong "redesign the sync architecture"` routes to Opus/o3 regardless of heuristic classification.

4. **Dry run works**: `kova run --dry-run "task"` shows model selection and complexity without making API calls or file changes.

5. **`kova chat` works**: Opens interactive REPL with streaming responses. `/model` command switches models mid-session. Each turn is cost-tracked.

6. **`kova models` works**: Lists all models with pricing, tier, provider, and availability status. Shows current routing config.

7. **`kova provider` works**: `kova provider add anthropic` prompts for key, stores at `~/.kova/provider-keys.json` with 0o600 permissions. `kova provider list` shows configured providers with masked keys. `kova provider remove` deletes key.

8. **Cost tracking integration**: Every `kova run` and `kova chat` turn creates a UsageRecord in `~/.kova/usage.json` with `tool: "kova_orchestrator"`, correct model name, token counts, and cost. `kova costs` displays orchestration costs alongside collector costs.

9. **Model routing correctness**: Simple prompts ("fix typo", "rename variable") route to cheap models. Complex prompts ("redesign the authentication architecture for multi-tenant support") route to strong models. Moderate prompts route to mid-tier.

10. **Security**: File operations prevent path traversal. Shell commands have timeouts. API keys stored with mode 0o600.

11. **Test coverage**: All new modules have test files. Model router, cost recorder, and all commands are tested. 80+ new test cases. Total test suite (existing 553 + new) passes.

12. **Build health**: `npm run build` succeeds. `tsc --noEmit` reports zero errors.

## Validation Commands

```bash
# Build
npm run build

# Type check
npx tsc --noEmit

# Run all tests (existing + new)
npm test

# Verify new command registration
node dist/index.js --help | grep -E "run|chat|models|provider"

# Verify provider management
node dist/index.js provider list

# Verify models listing
node dist/index.js models

# Verify dry run
node dist/index.js run --dry-run "fix a typo in README.md"

# Verify new test files exist
ls tests/lib/ai/ tests/commands/run.test.ts tests/commands/provider.test.ts tests/commands/models.test.ts

# Count total tests
npx vitest run 2>&1 | tail -5
```

## Notes

**On the Vercel AI SDK provider imports:**
Provider packages (`@ai-sdk/anthropic`, `@ai-sdk/openai`, etc.) should be dynamically imported in `provider-registry.ts` so they are only loaded when the provider is configured. This keeps CLI startup fast for non-orchestration commands. The `ai` core package itself is lightweight.

**On `maxSteps` in streamText:**
The AI SDK's `maxSteps` parameter controls how many tool-call/response cycles the model can perform. Set to 25 for `kova run` (complex tasks) and 15 for `kova chat` (interactive turns). Each step that involves tool calls generates additional token usage, all of which is captured by `result.usage`.

**On model ID format:**
The Vercel AI SDK uses `provider:model` format (e.g., `anthropic:claude-sonnet-4-20250514`). The provider prefix must match a key in the provider registry. When recording costs, strip the provider prefix to get the raw model ID for `mapSdkModelToCanonical()`.

**On the `kova_orchestrator` tool type:**
Adding this to the `AiTool` union means all existing cost aggregation (`by_tool` breakdowns, filters, etc.) automatically work for orchestration usage. No changes needed to `costs`, `report`, `compare`, or `sync` commands.

**On existing TOKEN_COSTS accuracy:**
The constants.ts file already has pricing for most models, but some prices may be outdated. Task 1 updates the pricing to match current 2026 rates. The `computeCost()` function in cost-calculator.ts already handles unknown models by returning 0, so new model names added to `AiModel` that aren't in TOKEN_COSTS will gracefully degrade.

**On tsup bundling:**
The project uses tsup with `noExternal: undefined` (default), which means dependencies are NOT bundled -- they are kept as external imports resolved at runtime from node_modules. This is correct for a CLI tool installed via npm. The new AI SDK packages will be listed in `dependencies` (not devDependencies) so they are installed when users run `npm install -g kova-cli`.

**On version bump:**
This feature warrants a major version bump from 1.0.0 to 2.0.0. However, do NOT bump the version as part of this plan -- that will be done in a separate release preparation step after all features are validated.

**Priority if time-constrained:**

1. Tasks 1-3 (foundation -- deps, types, registry)
2. Tasks 4-7 (core -- router, tools, prompt, recorder)
3. Task 8 (kova run -- the key command)
4. Task 9 (kova provider -- needed for setup)
5. Task 10 (kova models -- quick win)
6. Task 13 (tests)
7. Tasks 11-12 (chat + registration -- nice-to-have)

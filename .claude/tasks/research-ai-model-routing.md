# Research: Intelligent AI Model Routing for CLI Orchestrator

## Session Overview

**Research Question**: How to implement intelligent AI model routing/switching for a CLI tool that orchestrates AI coding tasks
**Session Type**: Research
**Status**: `COMPLETE`
**Date**: 2026-03-20

---

## 1. Model APIs and Pricing

### Anthropic (Claude)

**API Endpoint**: `https://api.anthropic.com/v1/messages`
**Authentication**: `x-api-key` header or `ANTHROPIC_API_KEY` environment variable
**SDK**: `@anthropic-ai/sdk` (npm)

| Model             | Model ID                     | Input $/MTok | Output $/MTok | Cache Read | Context Window |
| ----------------- | ---------------------------- | ------------ | ------------- | ---------- | -------------- |
| Claude Opus 4.6   | `claude-opus-4-6-20260301`   | $5.00        | $25.00        | $0.50      | 1M tokens      |
| Claude Opus 4.5   | `claude-opus-4-5-20250929`   | $5.00        | $25.00        | $0.50      | 1M tokens      |
| Claude Sonnet 4.6 | `claude-sonnet-4-6-20260301` | $3.00        | $15.00        | $0.30      | 1M tokens      |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | $3.00        | $15.00        | $0.30      | 200K (1M beta) |
| Claude Haiku 4.5  | `claude-haiku-4-5-20250929`  | $1.00        | $5.00         | $0.10      | 200K tokens    |
| Claude Haiku 3.5  | `claude-haiku-3-5-20241022`  | $0.80        | $4.00         | $0.08      | 200K tokens    |

**Batch API**: 50% discount on all models (async, 24h window).
**Prompt Caching**: 5-min cache write = 1.25x input; 1-hour cache write = 2x input; cache read = 0.1x input.
**Fast Mode (Opus 4.6 only)**: 6x standard rates ($30/$150 per MTok).

**Messages API Format**:

```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024, // REQUIRED (unlike OpenAI)
  system: "You are a coding assistant.",
  messages: [{ role: "user", content: "Fix this bug..." }],
  tools: [
    {
      name: "edit_file",
      description: "Edit a file",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  ],
});

// Tool use response: message.stop_reason === 'tool_use'
// Tool calls are in message.content as { type: 'tool_use', id, name, input }
// Send results back as { type: 'tool_result', tool_use_id, content }
```

**Streaming**:

```typescript
const stream = await client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [{ role: "user", content: "..." }],
});
for await (const event of stream) {
  // event types: content_block_start, content_block_delta, content_block_stop
}
```

**Key differences from OpenAI**:

- `max_tokens` is required
- System message is a separate top-level field, not a message role
- Tool definitions use `input_schema` (not `parameters`)
- Tool calls are content blocks in the response, not a separate `tool_calls` array
- Streaming uses `content_block_delta` events (not `chat.completion.chunk`)

---

### OpenAI

**API Endpoint**: `https://api.openai.com/v1/chat/completions`
**Authentication**: `Authorization: Bearer $OPENAI_API_KEY`
**SDK**: `openai` (npm)

| Model        | Model ID       | Input $/MTok | Output $/MTok | Cache Read | Context Window |
| ------------ | -------------- | ------------ | ------------- | ---------- | -------------- |
| GPT-4.1      | `gpt-4.1`      | $2.00        | $8.00         | $0.50      | 1M tokens      |
| GPT-4.1 Mini | `gpt-4.1-mini` | $0.20        | $0.80         | $0.10      | 1M tokens      |
| GPT-4.1 Nano | `gpt-4.1-nano` | $0.10        | $0.40         | $0.025     | 1M tokens      |
| GPT-4o       | `gpt-4o`       | $2.50        | $10.00        | $1.25      | 128K tokens    |
| GPT-4o Mini  | `gpt-4o-mini`  | $0.15        | $0.60         | $0.075     | 128K tokens    |
| o3           | `o3`           | $2.00        | $8.00         | $0.50      | 200K tokens    |
| o4-mini      | `o4-mini`      | $0.55        | $2.20         | $0.275     | 200K tokens    |

**Note on reasoning models (o3, o4-mini)**: These use internal chain-of-thought "reasoning tokens" billed as output tokens but not shown in response. A simple query might use 500 visible output tokens but 5,000 reasoning tokens -- you pay for all 5,500.

**Batch API**: 50% discount, async within 24 hours.

**Chat Completions API Format**:

```typescript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.chat.completions.create({
  model: "gpt-4.1",
  messages: [
    { role: "system", content: "You are a coding assistant." },
    { role: "user", content: "Fix this bug..." },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "edit_file",
        description: "Edit a file",
        parameters: {
          // NOT input_schema
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    },
  ],
});

// Tool calls in: response.choices[0].message.tool_calls[]
// Each: { id, type: 'function', function: { name, arguments } }
// Send results back as: { role: 'tool', tool_call_id, content }
```

**Key differences from Anthropic**:

- `max_tokens` is optional (defaults to model max)
- System message is a message with `role: 'system'`
- Tools are nested under `type: 'function'` with `parameters` key
- Tool calls are a separate `tool_calls` array on the message
- Streaming uses `chat.completion.chunk` SSE events

---

### Google (Gemini)

**API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
**Authentication**: API key as query parameter or OAuth2
**SDK**: `@google/genai` (npm)

| Model            | Input $/MTok                   | Output $/MTok   | Context Window |
| ---------------- | ------------------------------ | --------------- | -------------- |
| Gemini 2.5 Pro   | $1.25 (<=200K) / $2.50 (>200K) | $10.00 / $15.00 | 1M tokens      |
| Gemini 2.5 Flash | $0.30                          | $2.50           | 1M tokens      |

**Batch API**: 50% discount.
**Cache reads**: 10% of base input price.

**API Format**:

```typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-pro",
  contents: [{ role: "user", parts: [{ text: "Fix this bug..." }] }],
  tools: [
    {
      functionDeclarations: [
        {
          name: "edit_file",
          description: "Edit a file",
          parametersJsonSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      ],
    },
  ],
});
// Function calls in response.candidates[0].content.parts[] as { functionCall: { name, args } }
// Return results as { functionResponse: { name, response } }
```

---

### Groq (Fast Inference)

**API Endpoint**: `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible)
**Authentication**: Bearer token

| Model            | Input $/MTok | Output $/MTok | Speed       |
| ---------------- | ------------ | ------------- | ----------- |
| Llama 3.1 8B     | $0.06        | $0.06         | ~1000 tok/s |
| Llama 3.3 70B    | $0.59        | $0.79         | ~500 tok/s  |
| Llama 4 Maverick | ~$0.30       | ~$0.90        | ~500 tok/s  |

**Key advantage**: 5-10x faster inference than GPU-based providers. OpenAI-compatible API format.

---

### Together AI

**API Endpoint**: `https://api.together.xyz/v1/chat/completions` (OpenAI-compatible)
**Authentication**: Bearer token

| Model                   | Input $/MTok | Output $/MTok |
| ----------------------- | ------------ | ------------- |
| DeepSeek-V3.1           | $0.60        | $1.70         |
| Llama 4 Maverick (400B) | $0.27        | $0.85         |
| Llama 3.3 8B            | $0.18        | $0.18         |

**Key advantage**: Wide model selection, competitive pricing for open-source models, OpenAI-compatible API.

---

## 2. Existing Model Routing Solutions

### OpenRouter

**How it works**: Unified API gateway providing access to 300+ AI models from 60+ providers through a single OpenAI-compatible endpoint (`https://openrouter.ai/api/v1/chat/completions`).

**Key features**:

- Drop-in replacement for OpenAI API -- same request format
- Automatic failover: if a provider is down, routes to the next available
- Load-balancing across providers ordered by price
- Pass-through pricing (same as underlying provider, no markup for most models)
- Single billing across all providers

**API format**: Standard OpenAI Chat Completions format. Just change `base_url` and use OpenRouter model IDs (e.g., `anthropic/claude-sonnet-4.5`, `openai/gpt-4.1`).

**Verdict**: Best option for a CLI tool that wants instant access to many models without managing individual provider SDKs. No routing intelligence -- you pick the model, it handles availability.

---

### LiteLLM

**What it is**: Open-source Python library + proxy server providing unified OpenAI-format interface to 100+ LLMs.

**Key features**:

- Unified `completion()` call across all providers
- Load balancing with fallback chains
- Cost tracking per key/team/user
- Budget enforcement (auto-cutoff)
- Can run as a proxy server (any language can call it via HTTP)
- Observability: logs to MLflow, Langfuse, Helicone, OpenTelemetry

**Routing capabilities**:

- Round-robin, least-busy, cost-based, latency-based routing
- Automatic fallback on provider errors
- Custom routing rules (geography, model capability)

**Limitations**: Python-only SDK (though proxy is language-agnostic). Performance degrades under high concurrency due to Python GIL. Database logging slows at >1M logs.

**Verdict**: Great if you want a proxy server approach. Not ideal for a TypeScript CLI tool that needs to be self-contained.

---

### Portkey

**What it is**: AI gateway routing to 200+ LLMs with 50+ guardrails.

**Key features**:

- Automatic retries, fallbacks, load balancing
- Prompt management (store, version, A/B test outside codebase)
- Node.js SDK available
- OpenAI-compatible API
- Gateway 2.0 merging enterprise core into open-source

**Verdict**: Enterprise-focused. Good for production services, potentially overkill for a CLI tool.

---

### Martian Model Router

**What it is**: Automatic LLM selection that routes prompts to the "best" model based on prompt content.

**Key features**:

- Estimates model performance without running the prompt
- OpenAI-compatible, drop-in endpoint
- Controls for max cost and willingness-to-pay
- Automatic failover across providers
- Claims up to 98% cost savings

**How it routes**: Analyzes prompt content and automatically selects model with best uptime, skillset match, and cost-to-performance ratio. Routes cheaper models for simple requests, expensive models only when necessary.

**Verdict**: Interesting for automatic routing, but adds a dependency and latency. Better to build your own heuristic router for a CLI tool.

---

### Not Diamond

**What it is**: Predictive model recommendation framework that trains custom routers.

**Key features**:

- Determines which LLM will give highest quality response per query
- TypeScript client, Python SDK, and REST API
- Open-source RoRF (Routing on Random Forests) for pairwise routing
- Can train custom routers on your own evaluation data

**Verdict**: Best open-source option for building a custom router. RoRF approach is proven to outperform other open-source routers.

---

### Vercel AI SDK (Recommended for TypeScript CLI)

**What it is**: Open-source TypeScript library with 20M+ monthly downloads providing unified interface across providers.

**Key features**:

- `generateText()`, `streamText()` -- unified across all providers
- Tool calling with `tool()` helper -- works identically across OpenAI, Anthropic, Google, etc.
- Provider registry for managing multiple providers
- AI SDK 6 unifies structured output with multi-step tool loops
- 20+ provider packages available

**Provider registry pattern**:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createProviderRegistry, gateway } from "ai";

const registry = createProviderRegistry({
  gateway,
  anthropic,
  openai,
  google,
});

// Use any model with the same interface:
const result = await generateText({
  model: registry.languageModel("anthropic:claude-sonnet-4.5"),
  prompt: "Fix this bug...",
});

// Switch model with one line:
const result2 = await generateText({
  model: registry.languageModel("openai:gpt-4.1"),
  prompt: "Fix this bug...",
});
```

**Streaming with tool calling**:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

const result = streamText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  tools: {
    editFile: tool({
      description: "Edit a file",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) => {
        // apply edit
        return { success: true };
      },
    }),
  },
  prompt: "Fix the authentication bug in auth.ts",
});
```

**Verdict**: STRONGLY RECOMMENDED. Best-in-class TypeScript library for unified LLM access. Handles streaming, tool calling, and provider switching with zero code changes. Active development, huge community.

---

## 3. Task Complexity Classification

### Academic Research on LLM Routing (2025-2026)

**Key papers and frameworks**:

1. **RouterEval (EMNLP 2025)**: Comprehensive benchmark for routing LLMs with 36,497 prompts spanning 11 benchmarks. Evaluates routers on quality-cost tradeoff.

2. **LLMRank**: Uses human-readable features including task type, reasoning patterns, complexity indicators, and syntactic cues for routing decisions.

3. **EquiRouter**: Fairness-aware routing that reduced costs by up to 17% while maintaining quality.

4. **GreenServ**: Multi-armed bandit algorithm using lightweight contextual features (task type, semantic cluster, text complexity) for online routing. Achieved 31% energy reduction.

5. **vLLM Iris**: Plugin-based router processing 6 signal types: domain, keyword, embedding, factual, feedback, and preference signals.

6. **Cascade Routing (ICLR 2025)**: Unified framework integrating routing and cascading into theoretically optimal strategy -- try cheap model first, escalate if quality insufficient.

### Practical Complexity Signals

**Simple task indicators** (route to Haiku/GPT-4.1-nano/Flash):

- Short prompts (<500 tokens)
- Single-file operations
- Straightforward transformations (formatting, renaming)
- Code completion / autocomplete
- Simple Q&A about code
- Linting, syntax fixes
- Test generation for simple functions
- File reading / summarization

**Complex task indicators** (route to Sonnet/GPT-4.1/Gemini Pro):

- Multi-file coordination
- Architectural decisions
- Bug diagnosis requiring reasoning chains
- Refactoring with dependency analysis
- API design
- Security analysis
- Performance optimization

**Very complex task indicators** (route to Opus/o3):

- Multi-step planning across system
- Novel algorithm design
- Complex debugging with no obvious cause
- Architectural migration
- Cross-domain integration

### How Claude Code Routes Models

Claude Code uses a tiered approach:

- **Haiku**: "Easier tasks" to save tokens (configured via `ANTHROPIC_DEFAULT_HAIKU_MODEL`)
- **Sonnet**: Default for most coding tasks
- **Opus**: Complex planning and multi-step reasoning (via `opusplan` alias -- Opus for planning, Sonnet for execution)
- **Adaptive reasoning**: Effort levels on Opus 4.6 and Sonnet 4.6 adjust thinking depth per query

### Cost Savings from Routing

Based on research evidence:

- **70%+ cost reduction** from routing simple queries to cheaper models (multiple sources)
- **17% cost reduction** with quality-aware routing (EquiRouter)
- **25% support cost reduction** in customer service (case study)
- **Cascade pattern**: Try cheap model first, only escalate ~20-30% of queries to expensive models

### Recommended Classification Approach for CLI Tool

```typescript
interface TaskComplexity {
  level: "simple" | "moderate" | "complex" | "expert";
  confidence: number;
  signals: string[];
}

function classifyTask(prompt: string, context: TaskContext): TaskComplexity {
  const signals: string[] = [];
  let score = 0;

  // Token count
  const tokenCount = estimateTokens(prompt);
  if (tokenCount < 500) {
    signals.push("short_prompt");
    score -= 1;
  }
  if (tokenCount > 5000) {
    signals.push("long_prompt");
    score += 1;
  }

  // File count
  if (context.fileCount === 1) {
    signals.push("single_file");
    score -= 1;
  }
  if (context.fileCount > 3) {
    signals.push("multi_file");
    score += 1;
  }
  if (context.fileCount > 8) {
    signals.push("many_files");
    score += 2;
  }

  // Keywords indicating complexity
  const complexKeywords = [
    "architect",
    "refactor",
    "migrate",
    "security",
    "performance",
    "debug",
  ];
  const simpleKeywords = [
    "rename",
    "format",
    "typo",
    "lint",
    "complete",
    "add comment",
  ];

  // Task type detection
  if (context.isPlanning) {
    signals.push("planning");
    score += 2;
  }
  if (context.requiresReasoning) {
    signals.push("reasoning");
    score += 1;
  }
  if (context.isCodeCompletion) {
    signals.push("completion");
    score -= 2;
  }

  // Map score to level
  if (score <= -1) return { level: "simple", confidence: 0.8, signals };
  if (score <= 1) return { level: "moderate", confidence: 0.7, signals };
  if (score <= 3) return { level: "complex", confidence: 0.7, signals };
  return { level: "expert", confidence: 0.6, signals };
}

function selectModel(complexity: TaskComplexity): string {
  switch (complexity.level) {
    case "simple":
      return "anthropic:claude-haiku-4.5"; // $1/$5
    case "moderate":
      return "anthropic:claude-sonnet-4.5"; // $3/$15
    case "complex":
      return "anthropic:claude-sonnet-4.6"; // $3/$15
    case "expert":
      return "anthropic:claude-opus-4.6"; // $5/$25
  }
}
```

---

## 4. Implementation Patterns

### Recommended Architecture: Vercel AI SDK + Custom Router

**Why Vercel AI SDK over alternatives**:

- TypeScript-native (no Python dependency)
- 20M+ monthly downloads, very active development
- Unified streaming, tool calling, structured output
- Provider registry for multi-model management
- AI SDK 6 adds agent loop patterns
- No external proxy needed (self-contained in CLI)

**Why NOT LangChain.js**: Heavier abstraction, more opinionated, adds significant bundle size. Better for complex agent frameworks, overkill for model routing.

**Why NOT raw provider SDKs**: Must handle format differences manually (Anthropic vs OpenAI vs Gemini). Must implement streaming adapters per provider. Tool calling normalization is complex.

**Why NOT OpenRouter/LiteLLM proxy**: Adds network hop and external dependency. CLI tool should be self-contained.

### Implementation Architecture

```
CLI Tool
  |
  +-- TaskClassifier (complexity analysis)
  |     |
  |     +-- Prompt length analysis
  |     +-- File count / scope detection
  |     +-- Keyword/intent classification
  |     +-- History-based learning (optional)
  |
  +-- ModelRouter (model selection)
  |     |
  |     +-- Complexity -> model mapping
  |     +-- User overrides (--model flag)
  |     +-- Cost budget enforcement
  |     +-- Provider availability check
  |
  +-- Vercel AI SDK (unified execution)
  |     |
  |     +-- Provider Registry
  |     |     +-- @ai-sdk/anthropic
  |     |     +-- @ai-sdk/openai
  |     |     +-- @ai-sdk/google
  |     |     +-- @ai-sdk/openrouter (fallback)
  |     |
  |     +-- streamText() / generateText()
  |     +-- tool() definitions
  |     +-- Streaming response handler
  |
  +-- ToolExecutor (code operations)
        |
        +-- read_file
        +-- edit_file (search/replace)
        +-- run_command
        +-- list_files
```

### Handling Streaming Across Providers

With AI SDK, streaming is unified:

```typescript
import { streamText } from "ai";

// Same code works for ANY provider
const result = streamText({
  model: selectedModel, // anthropic, openai, or google
  messages,
  tools,
  onChunk: ({ chunk }) => {
    if (chunk.type === "text-delta") {
      process.stdout.write(chunk.textDelta);
    }
  },
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case "text-delta":
      process.stdout.write(part.textDelta);
      break;
    case "tool-call":
      const toolResult = await executeToolCall(part.toolName, part.args);
      break;
    case "finish":
      console.log(`\nTokens: ${part.usage.totalTokens}`);
      break;
  }
}
```

### Handling Tool Use Across Providers

With AI SDK, tool definitions are provider-agnostic:

```typescript
import { tool } from "ai";
import { z } from "zod";

const tools = {
  readFile: tool({
    description: "Read contents of a file",
    parameters: z.object({
      path: z.string().describe("Absolute file path"),
    }),
    execute: async ({ path }) => {
      return fs.readFileSync(path, "utf-8");
    },
  }),

  editFile: tool({
    description: "Replace text in a file using search/replace",
    parameters: z.object({
      path: z.string(),
      oldText: z.string().describe("Exact text to find"),
      newText: z.string().describe("Replacement text"),
    }),
    execute: async ({ path, oldText, newText }) => {
      const content = fs.readFileSync(path, "utf-8");
      const updated = content.replace(oldText, newText);
      fs.writeFileSync(path, updated);
      return { success: true, path };
    },
  }),

  runCommand: tool({
    description: "Run a shell command",
    parameters: z.object({
      command: z.string(),
      cwd: z.string().optional(),
    }),
    execute: async ({ command, cwd }) => {
      const { stdout, stderr } = await exec(command, { cwd });
      return { stdout, stderr };
    },
  }),
};
```

---

## 5. The "AI Coding Orchestrator" Pattern

### Common Architecture Across Tools

All major AI coding tools follow this pattern:

```
1. CONTEXT GATHERING
   - Read relevant files
   - Build repository map (AST-based function signatures)
   - Identify dependencies and related files

2. PROMPT CONSTRUCTION
   - System prompt with tool definitions
   - Repository context (file map, relevant code)
   - User request
   - Conversation history

3. LLM CALL (with tools)
   - Stream response
   - Detect tool calls
   - Execute tools (read/write files, run commands)
   - Send results back to LLM
   - Repeat until LLM stops calling tools

4. CHANGE APPLICATION
   - Parse edit format (diff, search/replace, whole file)
   - Apply changes to local files
   - Auto-commit with descriptive messages (optional)
   - Validate (syntax check, run tests)
```

### Aider's Architecture (Key Insights)

**Repository Map**: Creates a structured index using ASTs showing file names, function signatures, and class methods -- reduces token usage by ~98% compared to full source files.

**Context Tiers**:

1. Always: System instructions + repository map
2. Dynamic: Relevant file contents (based on task + dependency analysis)
3. Low priority: Chat history, unrelated docs

**Edit Formats** (4 variants):

1. **Search/Replace (diff)**: LLM returns `<<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE` blocks. Most reliable, used by default.
2. **Unified Diff (udiff)**: Modified unified diff format. Made GPT-4 Turbo 3x less lazy. Encourages rigor.
3. **Whole File**: LLM returns entire file content. Simple but inefficient for large files.
4. **Diff-Fenced**: Variant for Gemini models that struggle with standard fencing.

**Architect/Editor Pattern**:

- Architect model (strong, e.g., Opus/o3): Focuses on problem-solving, produces plain text instructions
- Editor model (fast, e.g., Sonnet/GPT-4.1-mini): Translates instructions into syntactically correct diffs
- Achieved 85% benchmark score (highest at time of publication)
- This is the pattern Claude Code uses with `opusplan` (Opus plans, Sonnet executes)

### Claude Code's Architecture

- **Model tiers**: Haiku for easy tasks, Sonnet for standard coding, Opus for planning
- **opusplan alias**: Opus handles architecture/planning, Sonnet handles code generation
- **Adaptive reasoning**: Effort levels on Opus 4.6 and Sonnet 4.6 adjust thinking depth
- **Tool set**: text_editor, bash, file operations
- **Configuration**: `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `modelOverrides` for custom routing

### Continue.dev's Architecture

- **ILLM interface + BaseLLM**: Unified abstraction layer across 40+ providers
- **Model roles**: Separate models for chat, edit, apply, embed, rerank
- **Configuration-driven**: JSON config file defines model list per role
- **Capability detection**: Automatically detects provider capabilities

### Sourcegraph Cody's Architecture

- **Multi-provider support**: Anthropic, OpenAI, Google, Mistral
- **Enterprise routing**: Azure OpenAI, AWS Bedrock, Vertex AI options
- **Cody Gateway**: Centralized model access and routing for enterprise

### Recommended Edit Format for CLI Tool

**Search/Replace blocks** (Aider-style) are the most reliable:

```
path/to/file.ts
<<<<<<< SEARCH
const oldCode = 'original';
=======
const newCode = 'updated';
>>>>>>> REPLACE
```

**Why this format**:

- Most LLMs can produce it reliably
- Unambiguous -- exact text matching
- Works for any file type
- Easy to validate (does the SEARCH text exist in the file?)
- Easy to apply programmatically
- Git-friendly (looks like merge conflicts, familiar to developers)

---

## 6. Pricing Comparison Matrix (Cost per 1M tokens, input/output)

| Provider/Model              | Input | Output | Best For                         |
| --------------------------- | ----- | ------ | -------------------------------- |
| Claude Haiku 4.5            | $1.00 | $5.00  | Simple tasks, fast               |
| GPT-4.1 Nano                | $0.10 | $0.40  | Cheapest capable model           |
| GPT-4.1 Mini                | $0.20 | $0.80  | Budget coding tasks              |
| Gemini 2.5 Flash            | $0.30 | $2.50  | Fast, affordable                 |
| Claude Sonnet 4.5/4.6       | $3.00 | $15.00 | Standard coding                  |
| GPT-4.1                     | $2.00 | $8.00  | Standard coding                  |
| Gemini 2.5 Pro              | $1.25 | $10.00 | Standard coding (cheapest input) |
| o4-mini                     | $0.55 | $2.20  | Reasoning tasks (budget)         |
| o3                          | $2.00 | $8.00  | Reasoning tasks                  |
| Claude Opus 4.6             | $5.00 | $25.00 | Complex planning                 |
| DeepSeek-V3.1 (Together)    | $0.60 | $1.70  | Coding (value)                   |
| Llama 4 Maverick (Together) | $0.27 | $0.85  | Budget coding                    |

**Cost optimization with routing**: Routing 70% of tasks to Haiku ($1/$5) and 30% to Sonnet ($3/$15) instead of using Sonnet for everything saves ~58% on input costs and ~67% on output costs.

---

## 7. Recommendations

### Primary Recommendation: Vercel AI SDK + Custom Heuristic Router

**Confidence level**: HIGH (based on multiple converging sources)

**Architecture**:

1. Use **Vercel AI SDK** (`ai` package) as the unified LLM interface
2. Build a **heuristic task classifier** based on prompt length, file count, keyword analysis
3. Default to **Anthropic Claude** as primary provider (best coding quality per benchmarks)
4. Support **OpenAI and Google** as alternatives via provider registry
5. Use **Architect/Editor pattern** for complex tasks (Opus plans, Sonnet executes)
6. Implement **search/replace edit format** for reliable code changes

**Model routing strategy**:

- Simple tasks: Claude Haiku 4.5 or GPT-4.1 Nano ($0.10-$1.00/MTok input)
- Standard coding: Claude Sonnet 4.6 or GPT-4.1 ($2-$3/MTok input)
- Complex planning: Claude Opus 4.6 ($5/MTok input)
- User override: `--model` flag for explicit selection

**Estimated cost savings**: 50-70% compared to using a single expensive model for all tasks.

### Alternative Options

1. **OpenRouter as backend**: Simpler to implement (single endpoint), but adds latency and external dependency
2. **LiteLLM proxy**: Powerful routing but requires Python runtime
3. **Martian router**: Automatic selection but black-box, adds API dependency

### Risk Mitigation

- **Provider outage**: Use OpenRouter as fallback provider (built-in failover)
- **Model deprecation**: Abstract model IDs behind config, easy to update
- **Cost overrun**: Implement per-session budget tracking with AI SDK usage metrics
- **Quality regression**: Log model selections and outcomes for iterative improvement

---

## Sources

- [Anthropic Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [OpenAI API Pricing](https://pricepertoken.com/pricing-page/provider/openai)
- [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Groq Pricing](https://groq.com/pricing)
- [Together AI Pricing](https://www.together.ai/pricing)
- [OpenRouter Documentation](https://openrouter.ai/docs/guides/overview/models)
- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [Portkey AI Gateway](https://portkey.ai/features/ai-gateway)
- [Martian Model Router](https://route.withmartian.com/)
- [Not Diamond Router](https://docs.notdiamond.ai/docs/quickstart)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
- [Vercel AI SDK Provider Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
- [Multi-Model Routing: Choosing the Best LLM per Task](https://dasroot.net/posts/2026/03/multi-model-routing-llm-selection/)
- [RouterEval EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.208.pdf)
- [Unified Approach to Routing and Cascading (ICLR 2025)](https://openreview.net/forum?id=AAl89VNNy1)
- [LLMRank: Understanding LLM Strengths](https://arxiv.org/html/2510.01234v1)
- [Aider Architecture Deep Dive](https://simranchawla.com/understanding-ai-coding-agents-through-aiders-architecture/)
- [Aider Edit Formats](https://aider.chat/docs/more/edit-formats.html)
- [Aider Architect/Editor Pattern](https://aider.chat/2024/09/26/architect.html)
- [Claude Code Model Configuration](https://code.claude.com/docs/en/model-config)
- [Continue.dev LLM Abstraction Layer](https://deepwiki.com/continuedev/continue/4.1-extension-architecture)
- [Sourcegraph Cody Models](https://sourcegraph.com/changelog/new-models-available)
- [OpenAI vs Anthropic API Comparison](https://portkey.ai/blog/open-ai-responses-api-vs-chat-completions-vs-anthropic-anthropic-messages-api/)
- [Anthropic SDK TypeScript](https://github.com/anthropics/anthropic-sdk-typescript)
- [RoRF Open Source LLM Router](https://www.notdiamond.ai/blog/rorf)
- [LLM Routing Optimization](https://www.emergentmind.com/topics/llm-routing)

import { describe, expect, it } from "vitest";
import {
  classifyComplexity,
  getModelDisplayName,
  selectModel,
  tierToComplexity,
} from "../../../src/lib/ai/model-router.js";
import { DEFAULT_ROUTING } from "../../../src/lib/constants.js";

// ---------------------------------------------------------------------------
// classifyComplexity
// ---------------------------------------------------------------------------

describe("classifyComplexity", () => {
  describe("simple keywords", () => {
    it('returns "simple" for "fix typo"', () => {
      expect(classifyComplexity("fix typo in readme")).toBe("simple");
    });

    it('returns "simple" for "rename"', () => {
      expect(classifyComplexity("rename the variable foo")).toBe("simple");
    });

    it('returns "simple" for "format"', () => {
      expect(classifyComplexity("format the file")).toBe("simple");
    });

    it('returns "simple" for "add comment"', () => {
      expect(classifyComplexity("add comment to the function")).toBe("simple");
    });

    it('returns "simple" for "update import"', () => {
      expect(classifyComplexity("update import paths")).toBe("simple");
    });

    it('returns "simple" for "fix lint"', () => {
      expect(classifyComplexity("fix lint errors")).toBe("simple");
    });

    it('returns "simple" for "remove unused"', () => {
      expect(classifyComplexity("remove unused imports")).toBe("simple");
    });
  });

  describe("complex keywords", () => {
    it('returns "complex" for "architect"', () => {
      expect(classifyComplexity("architect the new system")).toBe("complex");
    });

    it('returns "complex" for "redesign"', () => {
      expect(classifyComplexity("redesign the entire UI")).toBe("complex");
    });

    it('returns "complex" for "migrate"', () => {
      expect(classifyComplexity("migrate the database schema")).toBe("complex");
    });

    it('returns "complex" for "refactor entire"', () => {
      expect(classifyComplexity("refactor entire authentication module")).toBe(
        "complex",
      );
    });

    it('returns "complex" for "rewrite"', () => {
      expect(classifyComplexity("rewrite the parser from scratch")).toBe(
        "complex",
      );
    });

    it('returns "complex" for "implement from scratch"', () => {
      expect(classifyComplexity("implement from scratch a new queue")).toBe(
        "complex",
      );
    });

    it('returns "complex" for "security audit"', () => {
      expect(classifyComplexity("perform a security audit")).toBe("complex");
    });

    it('returns "complex" for "multi-file"', () => {
      expect(classifyComplexity("multi-file refactoring needed")).toBe(
        "complex",
      );
    });
  });

  describe("word count heuristic", () => {
    it('returns "complex" for prompts with >100 words', () => {
      const longPrompt = Array(110).fill("word").join(" ");
      expect(classifyComplexity(longPrompt)).toBe("complex");
    });

    it('returns "moderate" for prompts with 31-100 words', () => {
      const mediumPrompt = Array(50).fill("word").join(" ");
      expect(classifyComplexity(mediumPrompt)).toBe("moderate");
    });

    it('returns "simple" for prompts with <=30 words and no keywords', () => {
      const shortPrompt = "please change the color to blue";
      expect(classifyComplexity(shortPrompt)).toBe("simple");
    });
  });

  describe("edge cases", () => {
    it("is case-insensitive for keyword matching", () => {
      expect(classifyComplexity("REDESIGN the whole thing")).toBe("complex");
    });

    it('returns "simple" for empty string', () => {
      expect(classifyComplexity("")).toBe("simple");
    });

    it("complex keywords take priority over simple keywords", () => {
      expect(classifyComplexity("rename and migrate the module")).toBe(
        "complex",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// selectModel
// ---------------------------------------------------------------------------

describe("selectModel", () => {
  it("returns default simple model for simple complexity", () => {
    expect(selectModel("simple")).toBe(DEFAULT_ROUTING.simple);
  });

  it("returns default moderate model for moderate complexity", () => {
    expect(selectModel("moderate")).toBe(DEFAULT_ROUTING.moderate);
  });

  it("returns default complex model for complex complexity", () => {
    expect(selectModel("complex")).toBe(DEFAULT_ROUTING.complex);
  });

  it("uses custom routing from OrchestrationConfig", () => {
    const config = {
      default_provider: "anthropic" as const,
      routing: {
        simple: "openai:gpt-4o-mini",
        moderate: "openai:gpt-4o",
        complex: "anthropic:claude-opus-4-20250115",
      },
      auto_apply: false,
      max_tokens: 8192,
      temperature: 0,
    };
    expect(selectModel("simple", config)).toBe("openai:gpt-4o-mini");
    expect(selectModel("moderate", config)).toBe("openai:gpt-4o");
  });

  it("returns default_model when set, ignoring complexity", () => {
    const config = {
      default_provider: "anthropic" as const,
      default_model: "anthropic:claude-sonnet-4-20250514",
      routing: DEFAULT_ROUTING,
      auto_apply: false,
      max_tokens: 8192,
      temperature: 0,
    };
    expect(selectModel("simple", config)).toBe(
      "anthropic:claude-sonnet-4-20250514",
    );
    expect(selectModel("complex", config)).toBe(
      "anthropic:claude-sonnet-4-20250514",
    );
  });

  it("falls back to DEFAULT_ROUTING when config has no routing", () => {
    expect(selectModel("moderate", undefined)).toBe(DEFAULT_ROUTING.moderate);
  });
});

// ---------------------------------------------------------------------------
// tierToComplexity
// ---------------------------------------------------------------------------

describe("tierToComplexity", () => {
  it('maps "cheap" to "simple"', () => {
    expect(tierToComplexity("cheap")).toBe("simple");
  });

  it('maps "mid" to "moderate"', () => {
    expect(tierToComplexity("mid")).toBe("moderate");
  });

  it('maps "strong" to "complex"', () => {
    expect(tierToComplexity("strong")).toBe("complex");
  });

  it('maps unknown tier to "moderate"', () => {
    expect(tierToComplexity("unknown")).toBe("moderate");
  });

  it('maps empty string to "moderate"', () => {
    expect(tierToComplexity("")).toBe("moderate");
  });
});

// ---------------------------------------------------------------------------
// getModelDisplayName
// ---------------------------------------------------------------------------

describe("getModelDisplayName", () => {
  it("strips provider prefix and date suffix, title-cases", () => {
    expect(getModelDisplayName("anthropic:claude-sonnet-4-20250514")).toBe(
      "Claude Sonnet 4",
    );
  });

  it("handles two-part version like Haiku 4.5", () => {
    expect(getModelDisplayName("anthropic:claude-haiku-4-5-20251001")).toBe(
      "Claude Haiku 4.5",
    );
  });

  it("handles Opus 4 with date suffix", () => {
    expect(getModelDisplayName("anthropic:claude-opus-4-20250115")).toBe(
      "Claude Opus 4",
    );
  });

  it("handles model ID without provider prefix", () => {
    expect(getModelDisplayName("claude-haiku-4-5-20251001")).toBe(
      "Claude Haiku 4.5",
    );
  });

  it("handles model ID with no date suffix", () => {
    expect(getModelDisplayName("openai:gpt-4o")).toBe("Gpt 4o");
  });

  it("handles single-segment model ID", () => {
    expect(getModelDisplayName("gpt-4o-mini")).toBe("Gpt 4o Mini");
  });

  it("preserves dots in model names like gpt-4.1-nano", () => {
    expect(getModelDisplayName("gpt-4.1-nano")).toBe("Gpt 4.1 Nano");
  });

  it("handles gemini-2.5-flash", () => {
    expect(getModelDisplayName("gemini-2.5-flash")).toBe("Gemini 2.5 Flash");
  });
});

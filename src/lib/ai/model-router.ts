import type { OrchestrationConfig, TaskComplexity } from "../../types.js";
import { DEFAULT_ROUTING } from "../constants.js";

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

  if (COMPLEX_KEYWORDS.some((kw) => lower.includes(kw))) return "complex";
  if (SIMPLE_KEYWORDS.some((kw) => lower.includes(kw))) return "simple";

  if (wordCount > 100) return "complex";
  if (wordCount > 30) return "moderate";

  return "simple";
}

export function selectModel(
  complexity: TaskComplexity,
  config?: OrchestrationConfig,
): string {
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
  const parts = sdkModelId.split(":");
  const modelPart = parts[1] ?? parts[0] ?? sdkModelId;
  return modelPart
    .replace(/-\d{8}$/, "") // strip date suffix like -20250514
    .replace(/-(\d+)-(\d+)$/, " $1.$2") // "haiku-4-5" -> "haiku 4.5"
    .replace(/-(\d+)$/, " $1") // "sonnet-4" -> "sonnet 4"
    .replace(/-/g, " ") // remaining dashes to spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}

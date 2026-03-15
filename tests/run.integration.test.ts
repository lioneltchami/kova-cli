import { describe, expect, it } from "vitest";
import { PLAN_TEMPLATE_NAMES } from "../src/lib/constants.js";
import {
  buildTemplatedPrompt,
  isValidTemplate,
  listTemplates,
} from "../src/lib/plan-templates.js";

describe("run + template integration", () => {
  it("all 6 templates produce valid prompts when combined with user input", () => {
    const userInput = "build something great";
    for (const templateName of PLAN_TEMPLATE_NAMES) {
      const prompt = buildTemplatedPrompt(templateName, userInput);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("buildTemplatedPrompt for each template produces string longer than user prompt alone", () => {
    const userPrompt = "short input";
    for (const templateName of PLAN_TEMPLATE_NAMES) {
      const result = buildTemplatedPrompt(templateName, userPrompt);
      expect(result.length).toBeGreaterThan(userPrompt.length);
    }
  });

  it("listTemplates() count matches PLAN_TEMPLATE_NAMES length", () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(PLAN_TEMPLATE_NAMES.length);
  });

  it("listTemplates() names are exactly PLAN_TEMPLATE_NAMES values", () => {
    const templates = listTemplates();
    const names = templates.map((t) => t.name);
    // Every PLAN_TEMPLATE_NAMES entry appears in listTemplates
    for (const expectedName of PLAN_TEMPLATE_NAMES) {
      expect(names).toContain(expectedName);
    }
    // No extra names beyond PLAN_TEMPLATE_NAMES
    for (const actualName of names) {
      expect(isValidTemplate(actualName)).toBe(true);
    }
  });

  it("each template prompt contains the user's original prompt text at the end", () => {
    const userPrompt = "add payment processing";
    for (const templateName of PLAN_TEMPLATE_NAMES) {
      const result = buildTemplatedPrompt(templateName, userPrompt);
      expect(result.endsWith(userPrompt)).toBe(true);
    }
  });

  it('template prompts contain "## Recommended Phases" section', () => {
    const userPrompt = "sample task";
    for (const templateName of PLAN_TEMPLATE_NAMES) {
      const result = buildTemplatedPrompt(templateName, userPrompt);
      expect(result).toContain("## Recommended Phases");
    }
  });

  it('template prompts contain "## Recommended Agents" section', () => {
    const userPrompt = "sample task";
    for (const templateName of PLAN_TEMPLATE_NAMES) {
      const result = buildTemplatedPrompt(templateName, userPrompt);
      expect(result).toContain("## Recommended Agents");
    }
  });
});

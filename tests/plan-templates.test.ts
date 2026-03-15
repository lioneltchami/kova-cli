import { describe, expect, it } from "vitest";
import { PLAN_TEMPLATE_NAMES } from "../src/lib/constants.js";
import {
	buildTemplatedPrompt,
	isValidTemplate,
	listTemplates,
	loadPlanTemplate,
} from "../src/lib/plan-templates.js";

describe("isValidTemplate", () => {
	it('returns true for "feature"', () => {
		expect(isValidTemplate("feature")).toBe(true);
	});

	it('returns true for "bugfix"', () => {
		expect(isValidTemplate("bugfix")).toBe(true);
	});

	it('returns true for "refactor"', () => {
		expect(isValidTemplate("refactor")).toBe(true);
	});

	it('returns true for "migration"', () => {
		expect(isValidTemplate("migration")).toBe(true);
	});

	it('returns true for "security"', () => {
		expect(isValidTemplate("security")).toBe(true);
	});

	it('returns true for "performance"', () => {
		expect(isValidTemplate("performance")).toBe(true);
	});

	it('returns false for "invalid"', () => {
		expect(isValidTemplate("invalid")).toBe(false);
	});

	it('returns false for empty string ""', () => {
		expect(isValidTemplate("")).toBe(false);
	});
});

describe("loadPlanTemplate", () => {
	it('"feature" returns non-empty string containing "Feature"', () => {
		const content = loadPlanTemplate("feature");
		expect(content.length).toBeGreaterThan(0);
		expect(content).toContain("Feature");
	});

	it('"bugfix" returns string containing "Bug Fix"', () => {
		const content = loadPlanTemplate("bugfix");
		expect(content).toContain("Bug Fix");
	});

	it('"refactor" returns string containing "Refactor"', () => {
		const content = loadPlanTemplate("refactor");
		expect(content).toContain("Refactor");
	});

	it('"migration" returns string containing "Migration"', () => {
		const content = loadPlanTemplate("migration");
		expect(content).toContain("Migration");
	});

	it('"security" returns string containing "Security"', () => {
		const content = loadPlanTemplate("security");
		expect(content).toContain("Security");
	});

	it('"performance" returns string containing "Performance"', () => {
		const content = loadPlanTemplate("performance");
		expect(content).toContain("Performance");
	});
});

describe("buildTemplatedPrompt", () => {
	it('combines feature template with user prompt "add user profiles"', () => {
		const userPrompt = "add user profiles";
		const result = buildTemplatedPrompt("feature", userPrompt);
		// Starts with template content (template begins with "# Plan Template:")
		expect(result.startsWith("#")).toBe(true);
		// Ends with the user prompt
		expect(result.endsWith(userPrompt)).toBe(true);
	});

	it('bugfix prompt contains both template markers and "login fails" user prompt', () => {
		const userPrompt = "login fails";
		const result = buildTemplatedPrompt("bugfix", userPrompt);
		// Template marker present
		expect(result).toContain("## Recommended Phases");
		// User prompt appended
		expect(result).toContain(userPrompt);
	});
});

describe("listTemplates", () => {
	it("returns array of 6 entries", () => {
		const templates = listTemplates();
		expect(templates).toHaveLength(6);
	});

	it("each entry has name and description properties", () => {
		const templates = listTemplates();
		for (const entry of templates) {
			expect(entry).toHaveProperty("name");
			expect(entry).toHaveProperty("description");
			expect(typeof entry.name).toBe("string");
			expect(typeof entry.description).toBe("string");
		}
	});

	it("names match PLAN_TEMPLATE_NAMES", () => {
		const templates = listTemplates();
		const names = templates.map((t) => t.name);
		for (const expectedName of PLAN_TEMPLATE_NAMES) {
			expect(names).toContain(expectedName);
		}
	});
});

import fs from "fs";
import path from "path";
import type { PlanTemplateName } from "./constants.js";
import { PLAN_TEMPLATE_NAMES } from "./constants.js";
import { getTemplatesDir } from "./scaffold.js";

export function isValidTemplate(name: string): name is PlanTemplateName {
  return (PLAN_TEMPLATE_NAMES as readonly string[]).includes(name);
}

export function loadPlanTemplate(templateName: PlanTemplateName): string {
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(
    templatesDir,
    "plan-templates",
    `${templateName}.md`,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Plan template not found: ${templateName}. Available: ${PLAN_TEMPLATE_NAMES.join(", ")}`,
    );
  }

  return fs.readFileSync(templatePath, "utf-8");
}

export function buildTemplatedPrompt(
  templateName: PlanTemplateName,
  userPrompt: string,
): string {
  const template = loadPlanTemplate(templateName);
  return `${template}\n${userPrompt}`;
}

export function listTemplates(): Array<{ name: string; description: string }> {
  return [
    {
      name: "feature",
      description:
        "New feature development (3 phases: Foundation, Core, Polish)",
    },
    {
      name: "bugfix",
      description: "Bug investigation and fix (2 phases: Investigate, Fix)",
    },
    {
      name: "refactor",
      description:
        "Code improvement and cleanup (3 phases: Analyze, Refactor, Validate)",
    },
    {
      name: "migration",
      description:
        "Database schema migration (3 phases: Schema, Data, Cleanup)",
    },
    {
      name: "security",
      description: "Security audit and hardening (2 phases: Audit, Remediate)",
    },
    {
      name: "performance",
      description:
        "Performance profiling and optimization (2 phases: Profile, Optimize)",
    },
  ];
}

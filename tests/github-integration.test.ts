import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCommandRegistry } from "../src/lib/completions.js";
import {
  buildIssueContext,
  generatePrBody,
  generatePrTitle,
  isMainBranch,
  planNameToBranch,
} from "../src/lib/github.js";
import type { GitHubIssue } from "../src/lib/github.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-gh-int-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ==================== Full Issue Context Injection ====================

describe("buildIssueContext - full integration", () => {
  it("includes issue number, title, body, and Closes in combined output", () => {
    const issue: GitHubIssue = {
      number: 99,
      title: "Dark mode for settings screen",
      body: "The settings screen should support dark mode.\nIt should follow the design system tokens.",
      labels: ["enhancement", "accessibility"],
    };

    const context = buildIssueContext(issue);

    expect(context).toContain("## GitHub Issue #99");
    expect(context).toContain("Dark mode for settings screen");
    expect(context).toContain("The settings screen should support dark mode.");
    expect(context).toContain("Closes #99");
  });

  it("includes labels section when labels present", () => {
    const issue: GitHubIssue = {
      number: 5,
      title: "Fix crash on startup",
      body: "App crashes on cold start.",
      labels: ["bug", "critical"],
    };

    const context = buildIssueContext(issue);

    expect(context).toContain("Labels: bug, critical");
  });

  it("does not include Labels line when labels array is empty", () => {
    const issue: GitHubIssue = {
      number: 3,
      title: "Add pagination",
      body: "Need pagination on the list view.",
      labels: [],
    };

    const context = buildIssueContext(issue);

    expect(context).not.toContain("Labels:");
  });

  it("handles empty body without crashing or adding blank body section", () => {
    const issue: GitHubIssue = {
      number: 7,
      title: "Update docs",
      body: "",
      labels: [],
    };

    const context = buildIssueContext(issue);

    expect(context).toContain("## GitHub Issue #7");
    expect(context).toContain("Closes #7");
    // Body should not produce blank lines in unexpected ways
    expect(context.includes("undefined")).toBe(false);
  });
});

// ==================== Branch Name from Plan Names ====================

describe("planNameToBranch - various input formats", () => {
  it("converts space-separated plan names", () => {
    expect(planNameToBranch("add dark mode")).toBe("feat/add-dark-mode");
  });

  it("strips .md extension and converts to branch slug", () => {
    expect(planNameToBranch("fix-login-bug.md")).toBe("feat/fix-login-bug");
  });

  it("converts uppercase words to lowercase slug", () => {
    expect(planNameToBranch("Add User Authentication")).toBe(
      "feat/add-user-authentication",
    );
  });

  it("handles already kebab-case plan names", () => {
    expect(planNameToBranch("add-oauth2-support")).toBe(
      "feat/add-oauth2-support",
    );
  });

  it("replaces special characters with hyphens", () => {
    expect(planNameToBranch("add: user profiles!")).toBe(
      "feat/add-user-profiles",
    );
  });

  it("trims leading and trailing hyphens from slug", () => {
    const result = planNameToBranch("  my plan  ");
    expect(result).toBe("feat/my-plan");
    expect(result).not.toMatch(/feat\/[-]/);
  });
});

// ==================== isMainBranch edge cases ====================

describe("isMainBranch - edge cases", () => {
  it('returns true for "Main" (case insensitive)', () => {
    expect(isMainBranch("Main")).toBe(true);
  });

  it('returns false for "main-feature" (partial match should not count)', () => {
    expect(isMainBranch("main-feature")).toBe(false);
  });

  it('returns false for "release/main" (main in path should not count)', () => {
    expect(isMainBranch("release/main")).toBe(false);
  });

  it('returns false for "feature/develop" (develop in path)', () => {
    expect(isMainBranch("feature/develop")).toBe(false);
  });

  it('returns true for "MASTER" (uppercase)', () => {
    expect(isMainBranch("MASTER")).toBe(true);
  });

  it('returns true for "DEVELOP" (uppercase)', () => {
    expect(isMainBranch("DEVELOP")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isMainBranch("")).toBe(false);
  });
});

// ==================== PR Body end-to-end ====================

describe("generatePrBody - end-to-end with realistic plan markdown", () => {
  const realisticPlan = [
    "# Add OAuth2 Authentication",
    "",
    "## Objective",
    "Implement OAuth2 authentication with Google and Apple providers.",
    "This enables social login for all users.",
    "",
    "## Architecture",
    "Use Supabase Auth with expo-auth-session.",
    "",
    "## Tasks",
    "",
    "### 1. Configure Supabase OAuth providers",
    "**Task ID**: task-oauth-config",
    "**Assigned To**: backend-engineer",
    "",
    "### 2. Build OAuth redirect screen",
    "**Task ID**: task-oauth-screen",
    "**Assigned To**: frontend-specialist",
    "",
    "### 3. Wire auth callbacks",
    "**Task ID**: task-auth-callbacks",
    "**Assigned To**: backend-engineer",
  ].join("\n");

  it("extracts objective from realistic plan markdown", () => {
    const body = generatePrBody({
      planContent: realisticPlan,
      planName: "add-oauth2-authentication",
      checkpointPath: null,
    });
    expect(body).toContain(
      "Implement OAuth2 authentication with Google and Apple providers.",
    );
  });

  it("includes all three tasks from the realistic plan", () => {
    const body = generatePrBody({
      planContent: realisticPlan,
      planName: "add-oauth2-authentication",
      checkpointPath: null,
    });
    expect(body).toContain("Configure Supabase OAuth providers");
    expect(body).toContain("Build OAuth redirect screen");
    expect(body).toContain("Wire auth callbacks");
  });

  it("includes ## Tasks section header", () => {
    const body = generatePrBody({
      planContent: realisticPlan,
      planName: "add-oauth2-authentication",
      checkpointPath: null,
    });
    expect(body).toContain("## Tasks");
  });

  it("includes Generated with Kova footer", () => {
    const body = generatePrBody({
      planContent: realisticPlan,
      planName: "add-oauth2-authentication",
      checkpointPath: null,
    });
    expect(body).toContain("Generated with");
    expect(body).toContain("Kova");
  });
});

describe("generatePrBody - with checkpoint data", () => {
  it("includes Build Status section with correct task counts", () => {
    const checkpointPath = path.join(tmpDir, "oauth.progress.json");
    const checkpoint = {
      plan: "oauth.md",
      started_at: new Date().toISOString(),
      status: "in_progress",
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: null,
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-2": {
          status: "completed",
          agent_type: null,
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-3": {
          status: "pending",
          agent_type: null,
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
      },
      token_usage: null,
      validation: null,
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));

    const body = generatePrBody({
      planContent: "",
      planName: "oauth",
      checkpointPath,
    });

    expect(body).toContain("## Build Status");
    expect(body).toContain("2/3 completed");
  });
});

// ==================== Completions registry includes pr command ====================

describe("getCommandRegistry - PR command inclusion", () => {
  it('includes "pr" command in the registry', () => {
    const registry = getCommandRegistry();
    const names = registry.map((c) => c.name);
    expect(names).toContain("pr");
  });

  it("pr command has exactly 4 options", () => {
    const registry = getCommandRegistry();
    const prCmd = registry.find((c) => c.name === "pr");
    expect(prCmd).toBeDefined();
    expect(prCmd?.options).toHaveLength(4);
  });

  it("pr command options include --title, --body, --draft, --base", () => {
    const registry = getCommandRegistry();
    const prCmd = registry.find((c) => c.name === "pr");
    const flags = prCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--title");
    expect(flags).toContain("--body");
    expect(flags).toContain("--draft");
    expect(flags).toContain("--base");
  });
});

describe("getCommandRegistry - plan command includes --issue and --no-branch", () => {
  it('plan command includes "--issue" option', () => {
    const registry = getCommandRegistry();
    const planCmd = registry.find((c) => c.name === "plan");
    const flags = planCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--issue");
  });

  it('plan command includes "--no-branch" option', () => {
    const registry = getCommandRegistry();
    const planCmd = registry.find((c) => c.name === "plan");
    const flags = planCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--no-branch");
  });
});

describe("getCommandRegistry - run command includes --issue, --branch, --no-branch", () => {
  it('run command includes "--issue" option', () => {
    const registry = getCommandRegistry();
    const runCmd = registry.find((c) => c.name === "run");
    const flags = runCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--issue");
  });

  it('run command includes "--branch" option', () => {
    const registry = getCommandRegistry();
    const runCmd = registry.find((c) => c.name === "run");
    const flags = runCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--branch");
  });

  it('run command includes "--no-branch" option', () => {
    const registry = getCommandRegistry();
    const runCmd = registry.find((c) => c.name === "run");
    const flags = runCmd?.options.map((o) => o.flags) ?? [];
    expect(flags).toContain("--no-branch");
  });
});

// ==================== generatePrTitle edge cases ====================

describe("generatePrTitle - all edge cases", () => {
  it('returns "Pull Request" fallback for empty string', () => {
    expect(generatePrTitle("")).toBe("Pull Request");
  });

  it("handles single word", () => {
    expect(generatePrTitle("authentication")).toBe("Authentication");
  });

  it("handles hyphenated words", () => {
    expect(generatePrTitle("add-feature-flags")).toBe("Add Feature Flags");
  });

  it("handles underscore-separated words", () => {
    expect(generatePrTitle("add_feature_flags")).toBe("Add Feature Flags");
  });

  it("strips .md extension", () => {
    expect(generatePrTitle("my-plan.md")).toBe("My Plan");
  });

  it("strips .MD extension case-insensitively", () => {
    expect(generatePrTitle("my-plan.MD")).toBe("My Plan");
  });

  it("handles mixed hyphens and spaces", () => {
    expect(generatePrTitle("add user-profiles")).toBe("Add User Profiles");
  });

  it("handles branch name format from planNameToBranch output", () => {
    // planNameToBranch produces "feat/add-user-profiles"
    // generatePrTitle used with the basename (without the feat/ prefix)
    expect(generatePrTitle("add-user-profiles")).toBe("Add User Profiles");
  });
});

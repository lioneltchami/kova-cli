import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import type { GitHubIssue } from "../src/lib/github.js";
import {
  buildIssueContext,
  createBranch,
  createPullRequest,
  fetchIssue,
  generatePrBody,
  generatePrTitle,
  getCurrentBranch,
  isGhAuthenticated,
  isGhInstalled,
  isGitRepo,
  isMainBranch,
  planNameToBranch,
} from "../src/lib/github.js";

const mockExeca = vi.mocked(execa);

// Helper to build a minimal execa result shape
function execaResult(
  exitCode: number,
  stdout = "",
  stderr = "",
): Parameters<typeof mockExeca.mockResolvedValueOnce>[0] {
  return {
    exitCode,
    stdout,
    stderr,
    failed: exitCode !== 0,
  } as any;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-github-test-"));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ==================== Git Helpers ====================

describe("isGitRepo", () => {
  it("returns true when git succeeds with exitCode 0", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(0, "true"));
    const result = await isGitRepo(tmpDir);
    expect(result).toBe(true);
  });

  it("returns false when git exits with exitCode 1", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(1, "", "not a git repo"));
    const result = await isGitRepo(tmpDir);
    expect(result).toBe(false);
  });

  it("returns false when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("command not found: git"));
    const result = await isGitRepo(tmpDir);
    expect(result).toBe(false);
  });
});

describe("getCurrentBranch", () => {
  it("returns branch name from stdout", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(0, "feat/my-feature\n"));
    const result = await getCurrentBranch(tmpDir);
    expect(result).toBe("feat/my-feature");
  });

  it("returns null when git exits with non-zero code", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(128, "", "fatal: not a repo"));
    const result = await getCurrentBranch(tmpDir);
    expect(result).toBe(null);
  });

  it("returns null when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("git not found"));
    const result = await getCurrentBranch(tmpDir);
    expect(result).toBe(null);
  });
});

describe("isMainBranch", () => {
  it('returns true for "main"', () => {
    expect(isMainBranch("main")).toBe(true);
  });

  it('returns true for "master"', () => {
    expect(isMainBranch("master")).toBe(true);
  });

  it('returns true for "develop"', () => {
    expect(isMainBranch("develop")).toBe(true);
  });

  it('returns false for "feat/my-feature"', () => {
    expect(isMainBranch("feat/my-feature")).toBe(false);
  });

  it('returns false for "fix/bug-123"', () => {
    expect(isMainBranch("fix/bug-123")).toBe(false);
  });

  it('returns false for "release/1.0"', () => {
    expect(isMainBranch("release/1.0")).toBe(false);
  });

  it("is case-insensitive for main branches", () => {
    expect(isMainBranch("Main")).toBe(true);
    expect(isMainBranch("MASTER")).toBe(true);
    expect(isMainBranch("Develop")).toBe(true);
  });
});

describe("planNameToBranch", () => {
  it('converts "add-user-profiles" to "feat/add-user-profiles"', () => {
    expect(planNameToBranch("add-user-profiles")).toBe(
      "feat/add-user-profiles",
    );
  });

  it('converts "Fix Login Bug" to "feat/fix-login-bug"', () => {
    expect(planNameToBranch("Fix Login Bug")).toBe("feat/fix-login-bug");
  });

  it('strips .md extension from "my plan.md"', () => {
    expect(planNameToBranch("my plan.md")).toBe("feat/my-plan");
  });

  it("handles edge cases with extra spaces and dots", () => {
    // Note: .md must be the final non-whitespace chars for the regex to strip it
    // The implementation uses /\.md$/i which requires .md at end of string
    const result = planNameToBranch("  spaces  and  dots.md");
    expect(result).toBe("feat/spaces-and-dots");
  });

  it("strips .md case-insensitively", () => {
    expect(planNameToBranch("plan-name.MD")).toBe("feat/plan-name");
  });
});

describe("createBranch", () => {
  it("returns true on success (exitCode 0)", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(0));
    const result = await createBranch(tmpDir, "feat/new-feature");
    expect(result).toBe(true);
  });

  it("returns false on failure (exitCode 1)", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(1, "", "branch already exists"),
    );
    const result = await createBranch(tmpDir, "feat/exists");
    expect(result).toBe(false);
  });

  it("returns false when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("git checkout failed"));
    const result = await createBranch(tmpDir, "feat/boom");
    expect(result).toBe(false);
  });
});

// ==================== GH CLI Helpers ====================

describe("isGhInstalled", () => {
  it("returns true when gh --version succeeds", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(0, "gh version 2.40.0"));
    const result = await isGhInstalled(tmpDir);
    expect(result).toBe(true);
  });

  it("returns false when gh is not found", async () => {
    mockExeca.mockRejectedValueOnce(new Error("command not found: gh"));
    const result = await isGhInstalled(tmpDir);
    expect(result).toBe(false);
  });

  it("returns false when exitCode is non-zero", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(1));
    const result = await isGhInstalled(tmpDir);
    expect(result).toBe(false);
  });
});

describe("isGhAuthenticated", () => {
  it("returns true when gh auth status succeeds", async () => {
    mockExeca.mockResolvedValueOnce(execaResult(0));
    const result = await isGhAuthenticated(tmpDir);
    expect(result).toBe(true);
  });

  it("returns false when not authenticated", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(1, "", "You are not logged into any GitHub hosts."),
    );
    const result = await isGhAuthenticated(tmpDir);
    expect(result).toBe(false);
  });

  it("returns false when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("gh not found"));
    const result = await isGhAuthenticated(tmpDir);
    expect(result).toBe(false);
  });
});

describe("fetchIssue", () => {
  it("parses JSON output correctly", async () => {
    const issueJson = JSON.stringify({
      number: 42,
      title: "Fix the login bug",
      body: "When clicking login, it crashes.",
      labels: [{ name: "bug" }, { name: "high-priority" }],
    });
    mockExeca.mockResolvedValueOnce(execaResult(0, issueJson));
    const result = await fetchIssue(tmpDir, 42);
    expect(result).not.toBeNull();
    expect(result?.number).toBe(42);
    expect(result?.title).toBe("Fix the login bug");
    expect(result?.body).toBe("When clicking login, it crashes.");
    expect(result?.labels).toEqual(["bug", "high-priority"]);
  });

  it("returns null on failure (non-zero exit)", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(1, "", "issue not found: 9999"),
    );
    const result = await fetchIssue(tmpDir, 9999);
    expect(result).toBeNull();
  });

  it("returns null when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("gh not found"));
    const result = await fetchIssue(tmpDir, 1);
    expect(result).toBeNull();
  });

  it("handles missing labels gracefully (empty array)", async () => {
    const issueJson = JSON.stringify({
      number: 10,
      title: "No labels issue",
      body: "Some body",
      labels: [],
    });
    mockExeca.mockResolvedValueOnce(execaResult(0, issueJson));
    const result = await fetchIssue(tmpDir, 10);
    expect(result?.labels).toEqual([]);
  });

  it("uses issueNumber as fallback when number field missing in JSON", async () => {
    const issueJson = JSON.stringify({
      title: "No number field",
      body: "Body",
      labels: [],
    });
    mockExeca.mockResolvedValueOnce(execaResult(0, issueJson));
    const result = await fetchIssue(tmpDir, 77);
    expect(result?.number).toBe(77);
  });
});

describe("buildIssueContext", () => {
  const baseIssue: GitHubIssue = {
    number: 15,
    title: "Add dark mode support",
    body: "Users want dark mode.",
    labels: ["enhancement", "ui"],
  };

  it('includes "## GitHub Issue #N" heading', () => {
    const context = buildIssueContext(baseIssue);
    expect(context).toContain("## GitHub Issue #15");
  });

  it("includes the issue title in the heading", () => {
    const context = buildIssueContext(baseIssue);
    expect(context).toContain("Add dark mode support");
  });

  it('includes "Closes #N" footer', () => {
    const context = buildIssueContext(baseIssue);
    expect(context).toContain("Closes #15");
  });

  it("includes labels when present", () => {
    const context = buildIssueContext(baseIssue);
    expect(context).toContain("Labels: enhancement, ui");
  });

  it("handles empty body gracefully", () => {
    const issue: GitHubIssue = { ...baseIssue, body: "" };
    const context = buildIssueContext(issue);
    expect(context).toContain("## GitHub Issue #15");
    expect(context).toContain("Closes #15");
    // body section should be omitted
    expect(context).not.toContain("Users want dark mode.");
  });

  it("omits labels section when labels array is empty", () => {
    const issue: GitHubIssue = { ...baseIssue, labels: [] };
    const context = buildIssueContext(issue);
    expect(context).not.toContain("Labels:");
  });
});

// ==================== PR Helpers ====================

describe("generatePrTitle", () => {
  it('converts "add-user-profiles" to "Add User Profiles"', () => {
    expect(generatePrTitle("add-user-profiles")).toBe("Add User Profiles");
  });

  it('converts "fix-login-bug" to "Fix Login Bug"', () => {
    expect(generatePrTitle("fix-login-bug")).toBe("Fix Login Bug");
  });

  it('converts single char "a" to "A"', () => {
    expect(generatePrTitle("a")).toBe("A");
  });

  it("strips .md extension", () => {
    expect(generatePrTitle("my-plan.md")).toBe("My Plan");
  });

  it('returns "Pull Request" for empty string', () => {
    expect(generatePrTitle("")).toBe("Pull Request");
  });

  it("handles underscores as word separators", () => {
    expect(generatePrTitle("add_new_feature")).toBe("Add New Feature");
  });
});

describe("generatePrBody", () => {
  it('includes "## Summary" heading', () => {
    const body = generatePrBody({
      planContent: "",
      planName: "my-plan",
      checkpointPath: null,
    });
    expect(body).toContain("## Summary");
  });

  it('includes "Generated with Kova" footer', () => {
    const body = generatePrBody({
      planContent: "",
      planName: "my-plan",
      checkpointPath: null,
    });
    expect(body).toContain("Generated with");
    expect(body).toContain("Kova");
  });

  it("handles empty plan content gracefully", () => {
    const body = generatePrBody({
      planContent: "",
      planName: "my-plan",
      checkpointPath: null,
    });
    expect(typeof body).toBe("string");
    expect(body.length).toBeGreaterThan(0);
    // Should fall back to plan name based description
    expect(body).toContain("my plan");
  });

  it("includes tasks when ### N. headers present in plan content", () => {
    const planContent = `## Objective\nBuild a great feature.\n\n### 1. Setup database\n\n### 2. Create API\n\n### 3. Build UI\n`;
    const body = generatePrBody({
      planContent,
      planName: "great-feature",
      checkpointPath: null,
    });
    expect(body).toContain("## Tasks");
    expect(body).toContain("Setup database");
    expect(body).toContain("Create API");
    expect(body).toContain("Build UI");
  });

  it("includes objective when ## Objective section present", () => {
    const planContent = `## Objective\nImplement user authentication with OAuth.\n\n## Tasks\n\n### 1. Setup OAuth\n`;
    const body = generatePrBody({
      planContent,
      planName: "user-auth",
      checkpointPath: null,
    });
    expect(body).toContain("Implement user authentication with OAuth.");
  });

  it("includes Build Status section when checkpoint exists", () => {
    // Write a mock checkpoint file
    const checkpointPath = path.join(tmpDir, "plan.progress.json");
    const checkpoint = {
      plan: "plan.md",
      started_at: new Date().toISOString(),
      status: "completed",
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
      },
      token_usage: null,
      validation: null,
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));

    const body = generatePrBody({
      planContent: "",
      planName: "plan",
      checkpointPath,
    });
    expect(body).toContain("## Build Status");
    expect(body).toContain("completed");
  });
});

describe("createPullRequest", () => {
  it("returns success with URL on exitCode 0", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(0, "https://github.com/org/repo/pull/42"),
    );
    const result = await createPullRequest({
      cwd: tmpDir,
      title: "My PR",
      body: "Description",
    });
    expect(result.success).toBe(true);
    expect(result.url).toBe("https://github.com/org/repo/pull/42");
    expect(result.error).toBeNull();
  });

  it("returns failure with error message on non-zero exit", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(1, "", "GraphQL: No commits between main and feat/test"),
    );
    const result = await createPullRequest({
      cwd: tmpDir,
      title: "My PR",
      body: "Description",
    });
    expect(result.success).toBe(false);
    expect(result.url).toBeNull();
    expect(result.error).toContain("No commits");
  });

  it("returns failure when execa throws", async () => {
    mockExeca.mockRejectedValueOnce(new Error("gh: command not found"));
    const result = await createPullRequest({
      cwd: tmpDir,
      title: "My PR",
      body: "Description",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("gh: command not found");
  });

  it("passes --draft when draft=true", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(0, "https://github.com/org/repo/pull/7"),
    );
    await createPullRequest({
      cwd: tmpDir,
      title: "Draft PR",
      body: "WIP",
      draft: true,
    });
    const callArgs = mockExeca.mock.calls[0];
    expect(callArgs).toBeDefined();
    const args = callArgs![1] as string[];
    expect(args).toContain("--draft");
  });

  it("passes --base when base is provided", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(0, "https://github.com/org/repo/pull/8"),
    );
    await createPullRequest({
      cwd: tmpDir,
      title: "Base PR",
      body: "Body",
      base: "release/1.0",
    });
    const callArgs = mockExeca.mock.calls[0];
    expect(callArgs).toBeDefined();
    const args = callArgs![1] as string[];
    const baseIdx = args.indexOf("--base");
    expect(baseIdx).not.toBe(-1);
    expect(args[baseIdx + 1]).toBe("release/1.0");
  });

  it("does not pass --draft when draft is not set", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(0, "https://github.com/org/repo/pull/9"),
    );
    await createPullRequest({
      cwd: tmpDir,
      title: "Normal PR",
      body: "Body",
    });
    const callArgs = mockExeca.mock.calls[0];
    const args = callArgs![1] as string[];
    expect(args).not.toContain("--draft");
  });

  it("does not pass --base when base is not set", async () => {
    mockExeca.mockResolvedValueOnce(
      execaResult(0, "https://github.com/org/repo/pull/10"),
    );
    await createPullRequest({
      cwd: tmpDir,
      title: "Normal PR",
      body: "Body",
    });
    const callArgs = mockExeca.mock.calls[0];
    const args = callArgs![1] as string[];
    expect(args).not.toContain("--base");
  });
});

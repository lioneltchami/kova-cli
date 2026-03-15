import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePrBody, generatePrTitle } from "../src/lib/github.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-pr-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ==================== PR Title Tests ====================

describe("generatePrTitle - PR command helper logic", () => {
  it("converts kebab-case plan name to title case", () => {
    expect(generatePrTitle("add-user-profiles")).toBe("Add User Profiles");
  });

  it("converts plan name with spaces to title case", () => {
    expect(generatePrTitle("fix login bug")).toBe("Fix Login Bug");
  });

  it("strips .md extension before title-casing", () => {
    expect(generatePrTitle("my-feature.md")).toBe("My Feature");
  });

  it("handles uppercase input words", () => {
    expect(generatePrTitle("ADD-USER-PROFILES")).toBe("Add User Profiles");
  });

  it("handles mixed case input", () => {
    expect(generatePrTitle("Fix-Login-Bug")).toBe("Fix Login Bug");
  });

  it("handles single word plan name", () => {
    expect(generatePrTitle("authentication")).toBe("Authentication");
  });

  it("handles underscore-separated plan name", () => {
    expect(generatePrTitle("add_new_screen")).toBe("Add New Screen");
  });

  it("returns fallback for empty string input", () => {
    expect(generatePrTitle("")).toBe("Pull Request");
  });

  it("returns fallback for .md-only input", () => {
    // ".md" becomes "" after stripping, then fallback
    expect(generatePrTitle(".md")).toBe("Pull Request");
  });

  it("handles branch name as plan name", () => {
    expect(generatePrTitle("feat-dark-mode")).toBe("Feat Dark Mode");
  });
});

// ==================== PR Body Tests ====================

describe("generatePrBody - PR command helper logic", () => {
  it("includes objective from plan content when ## Objective section exists", () => {
    const planContent = [
      "## Objective",
      "Add OAuth2 login with Google and Apple.",
      "",
      "## Tasks",
      "",
      "### 1. Configure providers",
    ].join("\n");

    const body = generatePrBody({
      planContent,
      planName: "oauth-login",
      checkpointPath: null,
    });

    expect(body).toContain("Add OAuth2 login with Google and Apple.");
  });

  it("includes task list when ### N. task headers present", () => {
    const planContent = [
      "## Objective",
      "Build payment flow.",
      "",
      "### 1. Setup Stripe",
      "",
      "### 2. Create checkout form",
      "",
      "### 3. Handle webhooks",
    ].join("\n");

    const body = generatePrBody({
      planContent,
      planName: "payments",
      checkpointPath: null,
    });

    expect(body).toContain("## Tasks");
    expect(body).toContain("Setup Stripe");
    expect(body).toContain("Create checkout form");
    expect(body).toContain("Handle webhooks");
  });

  it('includes "Generated with Kova" footer in every body', () => {
    const body = generatePrBody({
      planContent: "",
      planName: "any-plan",
      checkpointPath: null,
    });
    expect(body).toContain("Generated with");
    expect(body).toContain("Kova");
  });

  it("produces valid markdown when no plan content given", () => {
    const body = generatePrBody({
      planContent: "",
      planName: "empty-plan",
      checkpointPath: null,
    });
    expect(typeof body).toBe("string");
    expect(body).toContain("## Summary");
    expect(body.length).toBeGreaterThan(20);
  });

  it("includes checkpoint Build Status section when checkpoint path provided", () => {
    const checkpointPath = path.join(tmpDir, "my-plan.progress.json");
    const checkpoint = {
      plan: "my-plan.md",
      started_at: new Date().toISOString(),
      status: "completed",
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-2": {
          status: "failed",
          agent_type: "backend-engineer",
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
      planName: "my-plan",
      checkpointPath,
    });

    expect(body).toContain("## Build Status");
    // 1 of 2 completed, 1 failed
    expect(body).toContain("1/2 completed");
    expect(body).toContain("1 failed");
  });

  it("does not include Build Status section when checkpoint path is null", () => {
    const body = generatePrBody({
      planContent: "",
      planName: "no-checkpoint",
      checkpointPath: null,
    });
    expect(body).not.toContain("## Build Status");
  });

  it("does not include Build Status section when checkpoint file does not exist", () => {
    const body = generatePrBody({
      planContent: "",
      planName: "no-file",
      checkpointPath: path.join(tmpDir, "nonexistent.progress.json"),
    });
    expect(body).not.toContain("## Build Status");
  });

  it("shows task completion checkboxes when checkpoint and tasks both present", () => {
    const checkpointPath = path.join(tmpDir, "plan-tasks.progress.json");
    const checkpoint = {
      plan: "plan-tasks.md",
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

    const planContent = [
      "### 1. Build the thing",
      "",
      "### 2. Test the thing",
    ].join("\n");

    const body = generatePrBody({
      planContent,
      planName: "plan-tasks",
      checkpointPath,
    });

    // Completed task should have [x], pending should have [ ]
    expect(body).toContain("[x]");
    expect(body).toContain("[ ]");
  });
});

import { execa } from "execa";
import fs from "fs";
import path from "path";
import { readCheckpoint } from "./checkpoint.js";

const isWindows = process.platform === "win32";

// ==================== Git Helpers ====================

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const result = await execa("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      shell: isWindows,
      reject: false,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const result = await execa("git", ["branch", "--show-current"], {
      cwd,
      shell: isWindows,
      reject: false,
    });
    if (result.exitCode !== 0) return null;
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

export function isMainBranch(branchName: string): boolean {
  const main = branchName.toLowerCase().trim();
  return main === "main" || main === "master" || main === "develop";
}

export async function createBranch(
  cwd: string,
  branchName: string,
): Promise<boolean> {
  try {
    const result = await execa("git", ["checkout", "-b", branchName], {
      cwd,
      shell: isWindows,
      reject: false,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export function planNameToBranch(planName: string): string {
  const cleaned = planName
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `feat/${cleaned}`;
}

// ==================== GitHub CLI Helpers ====================

export async function isGhInstalled(cwd: string): Promise<boolean> {
  try {
    const result = await execa("gh", ["--version"], {
      cwd,
      shell: isWindows,
      reject: false,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function isGhAuthenticated(cwd: string): Promise<boolean> {
  try {
    const result = await execa("gh", ["auth", "status"], {
      cwd,
      shell: isWindows,
      reject: false,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export async function fetchIssue(
  cwd: string,
  issueNumber: number,
): Promise<GitHubIssue | null> {
  try {
    const result = await execa(
      "gh",
      [
        "issue",
        "view",
        String(issueNumber),
        "--json",
        "number,title,body,labels",
      ],
      { cwd, shell: isWindows, reject: false },
    );
    if (result.exitCode !== 0) return null;

    const data = JSON.parse(result.stdout) as {
      number?: number;
      title?: string;
      body?: string;
      labels?: Array<{ name: string }>;
    };

    return {
      number: data.number ?? issueNumber,
      title: data.title ?? "",
      body: data.body ?? "",
      labels: (data.labels ?? []).map((l) => l.name),
    };
  } catch {
    return null;
  }
}

export function buildIssueContext(issue: GitHubIssue): string {
  const lines: string[] = [];
  lines.push(`## GitHub Issue #${issue.number}: ${issue.title}`);
  lines.push("");
  if (issue.body) {
    lines.push(issue.body);
    lines.push("");
  }
  if (issue.labels.length > 0) {
    lines.push(`Labels: ${issue.labels.join(", ")}`);
    lines.push("");
  }
  lines.push(`Closing this issue: Closes #${issue.number}`);
  return lines.join("\n");
}

// ==================== PR Helpers ====================

export function generatePrTitle(planName: string): string {
  const cleaned = planName.replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim();

  if (!cleaned) return "Pull Request";

  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export interface PrBodyOptions {
  planContent: string;
  planName: string;
  checkpointPath: string | null;
}

export function generatePrBody(options: PrBodyOptions): string {
  const { planContent, planName, checkpointPath } = options;
  const lines: string[] = [];

  lines.push("## Summary");
  lines.push("");

  // Extract objective from plan
  const objectiveMatch = /^##\s+Objective\s*\n([\s\S]*?)(?=^##\s|\z)/im.exec(
    planContent,
  );
  const objective = objectiveMatch?.[1]?.trim();
  if (objective) {
    // Take first 3 lines of objective
    const objectiveLines = objective
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 3);
    for (const line of objectiveLines) {
      lines.push(line.trim());
    }
  } else {
    lines.push(`Implementation of ${planName.replace(/[-_]/g, " ")}.`);
  }
  lines.push("");

  // Task summary
  const taskHeaderRe = /^###\s+\d+\.\s+(.+)$/gim;
  const tasks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = taskHeaderRe.exec(planContent)) !== null) {
    tasks.push(match[1]?.trim() ?? "");
  }

  if (tasks.length > 0) {
    lines.push("## Tasks");
    lines.push("");

    // If checkpoint exists, show status per task
    let checkpoint = null;
    if (checkpointPath && fs.existsSync(checkpointPath)) {
      checkpoint = readCheckpoint(checkpointPath);
    }

    const taskIds = checkpoint ? Object.keys(checkpoint.tasks) : [];

    for (let i = 0; i < tasks.length; i++) {
      const taskName = tasks[i]!;
      let status = "";
      if (checkpoint && taskIds[i]) {
        const taskEntry = checkpoint.tasks[taskIds[i]!];
        if (taskEntry) {
          const icon = taskEntry.status === "completed" ? "x" : " ";
          status = `[${icon}] `;
        }
      }
      lines.push(`- ${status}${taskName}`);
    }
    lines.push("");
  }

  // Build status from checkpoint
  if (checkpointPath) {
    const checkpoint = readCheckpoint(checkpointPath);
    if (checkpoint) {
      const total = Object.keys(checkpoint.tasks).length;
      const completed = Object.values(checkpoint.tasks).filter(
        (t) => t.status === "completed",
      ).length;
      const failed = Object.values(checkpoint.tasks).filter(
        (t) => t.status === "failed",
      ).length;
      lines.push("## Build Status");
      lines.push("");
      lines.push(`- **Status**: ${checkpoint.status}`);
      lines.push(
        `- **Tasks**: ${completed}/${total} completed${failed > 0 ? `, ${failed} failed` : ""}`,
      );
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(
    "*Generated with [Kova](https://github.com/kova-cli/kova) - Plan the hunt. Run the pack.*",
  );

  return lines.join("\n");
}

export interface CreatePrOptions {
  cwd: string;
  title: string;
  body: string;
  base?: string;
  draft?: boolean;
}

export interface CreatePrResult {
  success: boolean;
  url: string | null;
  error: string | null;
}

export async function createPullRequest(
  options: CreatePrOptions,
): Promise<CreatePrResult> {
  try {
    const args = [
      "pr",
      "create",
      "--title",
      options.title,
      "--body",
      options.body,
    ];

    if (options.base) {
      args.push("--base", options.base);
    }
    if (options.draft) {
      args.push("--draft");
    }

    const result = await execa("gh", args, {
      cwd: options.cwd,
      shell: isWindows,
      reject: false,
    });

    if (result.exitCode === 0) {
      // gh pr create outputs the PR URL on success
      const url = result.stdout.trim();
      return { success: true, url: url || null, error: null };
    }

    return {
      success: false,
      url: null,
      error: result.stderr?.trim() || result.stdout?.trim() || "Unknown error",
    };
  } catch (err) {
    return {
      success: false,
      url: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

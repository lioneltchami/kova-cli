import fs from "fs";
import path from "path";
import { getCheckpointPath } from "../lib/checkpoint.js";
import { TASKS_DIR } from "../lib/constants.js";
import {
	createPullRequest,
	generatePrBody,
	generatePrTitle,
	getCurrentBranch,
	isGhAuthenticated,
	isGhInstalled,
	isGitRepo,
	isMainBranch,
} from "../lib/github.js";
import * as logger from "../lib/logger.js";
import { getLatestPlan } from "./build.js";

export interface PrOptions {
	title?: string;
	body?: string;
	draft?: boolean;
	base?: string;
}

export async function prCommand(options: PrOptions): Promise<void> {
	const projectDir = process.cwd();

	// 1. Verify git repo
	if (!(await isGitRepo(projectDir))) {
		logger.error("Not a git repository. Initialize with: git init");
		process.exit(1);
	}

	// 2. Verify gh CLI
	if (!(await isGhInstalled(projectDir))) {
		logger.error(
			"GitHub CLI (gh) not found. Install from: https://cli.github.com",
		);
		process.exit(1);
	}

	if (!(await isGhAuthenticated(projectDir))) {
		logger.error("GitHub CLI not authenticated. Run: gh auth login");
		process.exit(1);
	}

	// 3. Check branch
	const branch = await getCurrentBranch(projectDir);
	if (!branch) {
		logger.error("Could not determine current branch.");
		process.exit(1);
	}
	if (isMainBranch(branch)) {
		logger.error(
			`Cannot create PR from ${branch}. Switch to a feature branch first.`,
		);
		logger.info("Tip: Use 'kova plan' which auto-creates feature branches.");
		process.exit(1);
	}

	// 4. Find latest plan for PR body generation
	const tasksDir = path.join(projectDir, TASKS_DIR);
	const latestPlan = getLatestPlan(tasksDir);
	let planContent = "";
	let planName = branch; // fallback to branch name

	if (latestPlan) {
		planContent = fs.readFileSync(latestPlan, "utf-8");
		planName = path.basename(latestPlan, ".md");
	}

	// 5. Generate title and body (or use overrides)
	const title = options.title ?? generatePrTitle(planName);
	const body =
		options.body ??
		generatePrBody({
			planContent,
			planName,
			checkpointPath: latestPlan ? getCheckpointPath(latestPlan) : null,
		});

	logger.info(`Creating PR: ${title}`);
	logger.info(`Branch: ${branch} -> ${options.base ?? "main"}`);
	if (options.draft) logger.info("Mode: draft");

	// 6. Create PR
	const result = await createPullRequest({
		cwd: projectDir,
		title,
		body,
		base: options.base,
		draft: options.draft,
	});

	if (result.success && result.url) {
		logger.success(`PR created: ${result.url}`);
	} else {
		logger.error(`Failed to create PR: ${result.error ?? "unknown error"}`);
		process.exit(1);
	}
}

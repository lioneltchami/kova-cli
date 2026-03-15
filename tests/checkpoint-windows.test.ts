import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createCheckpoint,
	persistTokenUsage,
	readCheckpoint,
	writeCheckpoint,
} from "../src/lib/checkpoint.js";
import type { CheckpointFile, TokenUsage } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-win-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeCheckpoint(
	overrides: Partial<CheckpointFile> = {},
): CheckpointFile {
	return {
		plan: "test-plan.md",
		started_at: new Date().toISOString(),
		status: "in_progress",
		tasks: {
			"task-1": {
				status: "pending",
				agent_type: "frontend-specialist",
				model: "sonnet",
				agent_id: null,
				started_at: null,
				completed_at: null,
				duration_s: null,
				tokens: null,
			},
		},
		token_usage: null,
		validation: null,
		...overrides,
	};
}

function makeTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
	return {
		total_input: 1000,
		total_output: 500,
		total_combined: 1500,
		cost_estimate_usd: 0.0075,
		per_task: {
			"task-1": { input: 1000, output: 500, model: "sonnet" },
		},
		session_start: new Date().toISOString(),
		plan_type: "max5",
		window_allocation: 88_000,
		...overrides,
	};
}

describe("writeCheckpoint (Windows hardening)", () => {
	it("creates file when it does not exist", () => {
		const checkpointPath = path.join(tmpDir, "new-plan.progress.json");
		const checkpoint = makeCheckpoint();

		expect(fs.existsSync(checkpointPath)).toBe(false);
		writeCheckpoint(checkpointPath, checkpoint);
		expect(fs.existsSync(checkpointPath)).toBe(true);
	});

	it("successfully overwrites an existing file", () => {
		const checkpointPath = path.join(tmpDir, "plan.progress.json");
		const checkpoint1 = makeCheckpoint({ status: "in_progress" });
		const checkpoint2 = makeCheckpoint({ status: "completed" });

		writeCheckpoint(checkpointPath, checkpoint1);
		const first = readCheckpoint(checkpointPath);
		expect(first?.status).toBe("in_progress");

		writeCheckpoint(checkpointPath, checkpoint2);
		const second = readCheckpoint(checkpointPath);
		expect(second?.status).toBe("completed");
	});

	it("data is not corrupted when write is followed immediately by read", () => {
		const checkpointPath = path.join(tmpDir, "concurrent.progress.json");
		const checkpoint = makeCheckpoint({ plan: "concurrent-plan.md" });

		writeCheckpoint(checkpointPath, checkpoint);
		const loaded = readCheckpoint(checkpointPath);

		expect(loaded).not.toBeNull();
		expect(loaded!.plan).toBe("concurrent-plan.md");
		expect(loaded!.tasks["task-1"]?.status).toBe("pending");
	});

	it("leaves no .tmp file behind after successful write", () => {
		const checkpointPath = path.join(tmpDir, "atomic.progress.json");
		const checkpoint = makeCheckpoint();

		writeCheckpoint(checkpointPath, checkpoint);

		const tmpFile = `${checkpointPath}.tmp`;
		expect(fs.existsSync(tmpFile)).toBe(false);
		expect(fs.existsSync(checkpointPath)).toBe(true);
	});

	it("leaves no .tmp file behind after overwriting existing file", () => {
		const checkpointPath = path.join(tmpDir, "overwrite.progress.json");
		const checkpoint1 = makeCheckpoint();
		const checkpoint2 = makeCheckpoint({ status: "completed" });

		writeCheckpoint(checkpointPath, checkpoint1);
		writeCheckpoint(checkpointPath, checkpoint2);

		const tmpFile = `${checkpointPath}.tmp`;
		expect(fs.existsSync(tmpFile)).toBe(false);
	});

	it("multiple rapid writes produce valid final data", () => {
		const checkpointPath = path.join(tmpDir, "rapid.progress.json");

		for (let i = 0; i < 10; i++) {
			const checkpoint = makeCheckpoint({
				plan: `plan-iteration-${i}.md`,
				status: i === 9 ? "completed" : "in_progress",
			});
			writeCheckpoint(checkpointPath, checkpoint);
		}

		const final = readCheckpoint(checkpointPath);
		expect(final).not.toBeNull();
		expect(final!.plan).toBe("plan-iteration-9.md");
		expect(final!.status).toBe("completed");
	});

	it("written JSON is valid and parseable (not truncated)", () => {
		const checkpointPath = path.join(tmpDir, "valid-json.progress.json");
		const checkpoint = makeCheckpoint();

		writeCheckpoint(checkpointPath, checkpoint);

		const raw = fs.readFileSync(checkpointPath, "utf-8");
		expect(() => JSON.parse(raw)).not.toThrow();

		const parsed = JSON.parse(raw) as CheckpointFile;
		expect(parsed.plan).toBe("test-plan.md");
	});
});

describe("persistTokenUsage", () => {
	it("updates token_usage in an existing checkpoint", () => {
		const checkpointPath = path.join(tmpDir, "token.progress.json");
		const checkpoint = makeCheckpoint({ token_usage: null });
		writeCheckpoint(checkpointPath, checkpoint);

		const tokenData = makeTokenUsage();
		persistTokenUsage(checkpointPath, tokenData);

		const loaded = readCheckpoint(checkpointPath);
		expect(loaded).not.toBeNull();
		expect(loaded!.token_usage).not.toBeNull();
		expect(loaded!.token_usage!.total_input).toBe(1000);
		expect(loaded!.token_usage!.total_output).toBe(500);
		expect(loaded!.token_usage!.total_combined).toBe(1500);
		expect(loaded!.token_usage!.plan_type).toBe("max5");
	});

	it("preserves existing tasks when updating token_usage", () => {
		const checkpointPath = path.join(tmpDir, "preserve.progress.json");
		const checkpoint = makeCheckpoint({
			tasks: {
				"task-1": {
					status: "completed",
					agent_type: "frontend-specialist",
					model: "sonnet",
					agent_id: "agent-abc",
					started_at: null,
					completed_at: null,
					duration_s: 30,
					tokens: null,
				},
			},
		});
		writeCheckpoint(checkpointPath, checkpoint);

		persistTokenUsage(checkpointPath, makeTokenUsage());

		const loaded = readCheckpoint(checkpointPath);
		expect(loaded!.tasks["task-1"]?.status).toBe("completed");
		expect(loaded!.tasks["task-1"]?.agent_id).toBe("agent-abc");
		expect(loaded!.tasks["task-1"]?.duration_s).toBe(30);
	});

	it("does nothing for a non-existent checkpoint path", () => {
		const nonExistentPath = path.join(tmpDir, "does-not-exist.progress.json");
		const tokenData = makeTokenUsage();

		expect(() => {
			persistTokenUsage(nonExistentPath, tokenData);
		}).not.toThrow();

		expect(fs.existsSync(nonExistentPath)).toBe(false);
	});

	it("can be called multiple times, updating token_usage each time", () => {
		const checkpointPath = path.join(tmpDir, "multi-persist.progress.json");
		writeCheckpoint(checkpointPath, makeCheckpoint());

		const first = makeTokenUsage({ total_combined: 1_500 });
		persistTokenUsage(checkpointPath, first);

		const second = makeTokenUsage({ total_combined: 3_000 });
		persistTokenUsage(checkpointPath, second);

		const loaded = readCheckpoint(checkpointPath);
		expect(loaded!.token_usage!.total_combined).toBe(3_000);
	});

	it("createCheckpoint initializes token_usage as null", () => {
		const checkpoint = createCheckpoint("plan.md", []);
		expect(checkpoint.token_usage).toBeNull();
	});
});

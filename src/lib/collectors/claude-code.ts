import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { AiModel, UsageRecord } from "../../types.js";
import { CLAUDE_CODE_DIR, TOKEN_COSTS } from "../constants.js";
import type { Collector, CollectorResult } from "./types.js";

// The JSONL format Claude Code uses for conversation history.
// Each line is one of these structures (simplified to what we need):
interface ClaudeCodeEntry {
	type: "user" | "assistant" | "file-history-snapshot" | string;
	uuid?: string;
	sessionId?: string;
	timestamp?: string;
	cwd?: string;
	message?: {
		role?: string;
		model?: string;
		usage?: {
			input_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
			output_tokens?: number;
		};
		stop_reason?: string | null;
	};
}

/**
 * Map a raw Claude model string to our canonical AiModel type.
 * Claude Code stores models like "claude-opus-4-6", "claude-sonnet-4-20250514",
 * "claude-haiku-3-5" etc.
 */
function mapModelName(raw: string | undefined | null): AiModel {
	if (!raw) return "unknown";
	const lower = raw.toLowerCase();
	if (lower.includes("haiku")) return "haiku";
	if (lower.includes("sonnet")) return "sonnet";
	if (lower.includes("opus")) return "opus";
	return "unknown";
}

/**
 * Compute cost for a usage record. TOKEN_COSTS stores cost per 1M tokens.
 * Cache creation tokens count as input tokens for billing purposes.
 * Cache read tokens are billed at a reduced rate -- we treat them as 0
 * cost here since we do not have a separate cache-read rate in constants.
 */
function computeCost(
	model: AiModel,
	inputTokens: number,
	outputTokens: number,
): number {
	const rates = TOKEN_COSTS[model];
	if (!rates) return 0;
	const inputCost = (inputTokens / 1_000_000) * rates.input;
	const outputCost = (outputTokens / 1_000_000) * rates.output;
	return inputCost + outputCost;
}

/**
 * Generate a deterministic 16-character ID for deduplication.
 * Uses the session UUID + message UUID + timestamp for uniqueness.
 */
function makeId(sessionId: string, uuid: string, timestamp: string): string {
	return crypto
		.createHash("sha256")
		.update(`claude_code:${sessionId}:${uuid}:${timestamp}`)
		.digest("hex")
		.slice(0, 16);
}

/**
 * Derive a human-readable project name from the cwd field stored in the entry.
 * Claude Code stores the absolute working directory path; we take the last
 * path segment as the project name. Falls back to the project directory name
 * (the hashed folder under ~/.claude/projects/).
 */
function projectFromCwd(cwd: string | undefined, fallback: string): string {
	if (cwd && cwd.trim().length > 0) {
		const normalized = cwd.replace(/\\/g, "/");
		const parts = normalized.split("/").filter((p) => p.length > 0);
		if (parts.length > 0) {
			return parts[parts.length - 1];
		}
	}
	return fallback;
}

/**
 * Recursively collect all *.jsonl files under a directory.
 */
function findJsonlFiles(dir: string): string[] {
	const results: string[] = [];
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return results;
	}
	for (const entry of entries) {
		if (entry.isSymbolicLink()) continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findJsonlFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			results.push(fullPath);
		}
	}
	return results;
}

/**
 * Parse a single JSONL file and return UsageRecord entries.
 * Skips empty lines, lines with parse errors, and entries that predate `since`.
 */
function parseJsonlFile(
	filePath: string,
	projectFallback: string,
	since: Date | undefined,
	errors: string[],
): UsageRecord[] {
	let raw: string;
	try {
		raw = fs.readFileSync(filePath, "utf-8");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		errors.push(`Failed to read ${filePath}: ${msg}`);
		return [];
	}

	const records: UsageRecord[] = [];
	const lines = raw.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		let entry: ClaudeCodeEntry;
		try {
			entry = JSON.parse(line) as ClaudeCodeEntry;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`JSON parse error in ${filePath}:${i + 1}: ${msg}`);
			continue;
		}

		// We only care about assistant messages that carry token usage.
		if (entry.type !== "assistant") continue;
		if (!entry.message?.usage) continue;

		const usage = entry.message.usage;
		const inputTokens =
			(usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
		const outputTokens = usage.output_tokens ?? 0;

		// Skip entries with zero usage (no meaningful data).
		if (inputTokens === 0 && outputTokens === 0) continue;

		const timestamp = entry.timestamp ?? new Date(0).toISOString();

		// Filter by `since` if provided.
		if (since !== undefined) {
			try {
				if (new Date(timestamp) < since) continue;
			} catch {
				// If timestamp is unparseable, include the record rather than skip.
			}
		}

		const uuid = entry.uuid ?? "";
		const sessionId = entry.sessionId ?? "";
		const model = mapModelName(entry.message.model);
		const cost = computeCost(model, inputTokens, outputTokens);
		const project = projectFromCwd(entry.cwd, projectFallback);
		const id = makeId(sessionId, uuid, timestamp);

		records.push({
			id,
			tool: "claude_code",
			model,
			session_id: sessionId,
			project: project || null,
			input_tokens: inputTokens,
			output_tokens: outputTokens,
			cost_usd: cost,
			timestamp,
			duration_ms: null,
			metadata: {
				raw_model: entry.message.model ?? "",
				file: filePath,
			},
		});
	}

	return records;
}

export const claudeCodeCollector: Collector = {
	name: "claude_code",

	async isAvailable(): Promise<boolean> {
		return fs.existsSync(CLAUDE_CODE_DIR);
	},

	async collect(since?: Date): Promise<CollectorResult> {
		const errors: string[] = [];
		const scanned_paths: string[] = [];
		const records: UsageRecord[] = [];

		const projectsDir = path.join(CLAUDE_CODE_DIR, "projects");

		if (!fs.existsSync(projectsDir)) {
			return {
				tool: "claude_code",
				records: [],
				errors: [],
				scanned_paths: [],
			};
		}

		const jsonlFiles = findJsonlFiles(projectsDir);

		for (const filePath of jsonlFiles) {
			scanned_paths.push(filePath);

			// Derive a fallback project name from the project directory name.
			// Project dirs are named after the hashed path, e.g. "C--PROJ-my-app".
			// We take the parent directory name and strip the "C--PROJ-" prefix if
			// present, replacing remaining dashes with spaces for readability.
			const projectDirName = path.basename(path.dirname(filePath));
			const projectFallback = projectDirName
				.replace(/^[A-Za-z]--/, "") // Remove drive letter prefix like "C--"
				.replace(/-/g, " ")
				.trim();

			const fileRecords = parseJsonlFile(
				filePath,
				projectFallback,
				since,
				errors,
			);
			records.push(...fileRecords);
		}

		return {
			tool: "claude_code",
			records,
			errors,
			scanned_paths,
		};
	},
};

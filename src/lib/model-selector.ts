import type { KovaConfig, ModelTier, PlanTask } from "../types.js";

interface ModelSignals {
	fileCount: number;
	hasDependents: boolean;
	dependentCount: number;
	touchesSecurity: boolean;
	touchesPayments: boolean;
	touchesDatabase: boolean;
	isArchitectural: boolean;
	isSimple: boolean;
	isValidation: boolean;
}

function buildSignals(task: PlanTask): ModelSignals {
	return {
		fileCount: task.files?.length ?? 0,
		hasDependents: false, // would need full task graph, simplified for now
		dependentCount: 0,
		touchesSecurity: /auth|security|rls|permission|token|session/i.test(
			task.description,
		),
		touchesPayments: /stripe|payment|billing|subscription|checkout/i.test(
			task.description,
		),
		touchesDatabase: /migration|schema|index|rls|trigger|function/i.test(
			task.description,
		),
		isArchitectural: /refactor|redesign|migrate|overhaul/i.test(
			task.description,
		),
		isSimple: /rename|typo|config|format|update version|add comment/i.test(
			task.description,
		),
		isValidation: task.agent_type === "quality-engineer",
	};
}

export function selectModel(task: PlanTask, config: KovaConfig): ModelTier {
	// Explicit override from task definition
	if (task.model !== null) {
		return task.model;
	}

	// If auto-selection is disabled, use the moderate default
	if (!config.models.auto) {
		return config.models.moderate;
	}

	const signals = buildSignals(task);

	// Haiku: simple single-file tasks
	if (signals.isSimple && signals.fileCount <= 1) {
		return "haiku";
	}

	// Opus: architectural work or security-sensitive multi-file tasks or large scope
	if (
		signals.isArchitectural ||
		(signals.touchesSecurity && signals.fileCount > 2) ||
		signals.fileCount >= 5
	) {
		return "opus";
	}

	// Sonnet: everything else (moderate complexity)
	return "sonnet";
}

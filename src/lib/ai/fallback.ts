import { MODEL_FALLBACK_CHAIN } from "../constants.js";
import * as logger from "../logger.js";
import { getModelDisplayName } from "./model-router.js";

export interface FallbackResult {
	modelId: string;
	attempt: number;
}

/**
 * Determine if an error is retryable (rate limit or server error).
 */
export function isRetryableError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const message = err.message.toLowerCase();

	// Rate limit
	if (
		message.includes("429") ||
		message.includes("rate limit") ||
		message.includes("too many requests")
	) {
		return true;
	}

	// Server errors
	if (
		message.includes("500") ||
		message.includes("502") ||
		message.includes("503") ||
		message.includes("internal server error")
	) {
		return true;
	}

	// Overloaded
	if (message.includes("overloaded") || message.includes("capacity")) {
		return true;
	}

	return false;
}

/**
 * Get the next fallback model for a given model ID.
 * Returns null if no fallback available.
 */
export function getNextFallbackModel(
	currentModelId: string,
	attemptedModels: Set<string>,
): string | null {
	const chain = MODEL_FALLBACK_CHAIN[currentModelId];
	if (!chain) return null;

	for (const fallback of chain) {
		if (!attemptedModels.has(fallback)) {
			return fallback;
		}
	}

	return null;
}

/**
 * Execute a function with smart model fallback.
 * @param initialModelId The first model to try
 * @param fn The function to execute (receives modelId, returns result)
 * @param enabled Whether fallback is enabled
 */
export async function withFallback<T>(
	initialModelId: string,
	fn: (modelId: string) => Promise<T>,
	enabled: boolean,
): Promise<{ result: T; modelId: string }> {
	const attemptedModels = new Set<string>();
	let currentModelId = initialModelId;

	while (true) {
		attemptedModels.add(currentModelId);

		try {
			const result = await fn(currentModelId);
			return { result, modelId: currentModelId };
		} catch (err) {
			if (!enabled || !isRetryableError(err)) {
				throw err;
			}

			const nextModel = getNextFallbackModel(currentModelId, attemptedModels);
			if (!nextModel) {
				throw err;
			}

			logger.warn(
				`${getModelDisplayName(currentModelId)} unavailable, falling back to ${getModelDisplayName(nextModel)}`,
			);

			// Brief delay before retry (1s)
			await new Promise((resolve) => setTimeout(resolve, 1000));

			currentModelId = nextModel;
		}
	}
}

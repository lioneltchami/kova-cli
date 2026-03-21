import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/logger.js", () => ({
	warn: vi.fn(),
	info: vi.fn(),
	error: vi.fn(),
	success: vi.fn(),
	debug: vi.fn(),
	header: vi.fn(),
	table: vi.fn(),
}));

import {
	getNextFallbackModel,
	isRetryableError,
	withFallback,
} from "../../../src/lib/ai/fallback.js";

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe("isRetryableError", () => {
	it('returns true for "429" errors', () => {
		expect(isRetryableError(new Error("HTTP 429 Too Many Requests"))).toBe(
			true,
		);
	});

	it('returns true for "rate limit" errors', () => {
		expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
	});

	it('returns true for "too many requests" errors', () => {
		expect(isRetryableError(new Error("too many requests"))).toBe(true);
	});

	it('returns true for "500" server errors', () => {
		expect(isRetryableError(new Error("HTTP 500 Internal Server Error"))).toBe(
			true,
		);
	});

	it('returns true for "502" server errors', () => {
		expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
	});

	it('returns true for "503" server errors', () => {
		expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
	});

	it('returns true for "overloaded" errors', () => {
		expect(isRetryableError(new Error("model is overloaded"))).toBe(true);
	});

	it('returns true for "capacity" errors', () => {
		expect(isRetryableError(new Error("at capacity right now"))).toBe(true);
	});

	it('returns false for non-retryable errors like "invalid api key"', () => {
		expect(isRetryableError(new Error("invalid api key"))).toBe(false);
	});

	it("returns false for non-Error values", () => {
		expect(isRetryableError("some string")).toBe(false);
		expect(isRetryableError(42)).toBe(false);
		expect(isRetryableError(null)).toBe(false);
		expect(isRetryableError(undefined)).toBe(false);
		expect(isRetryableError({ message: "429" })).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getNextFallbackModel
// ---------------------------------------------------------------------------

describe("getNextFallbackModel", () => {
	it("returns the first fallback from the chain for a known model", () => {
		const attempted = new Set(["anthropic:claude-opus-4-20250115"]);
		const result = getNextFallbackModel(
			"anthropic:claude-opus-4-20250115",
			attempted,
		);
		expect(result).toBe("anthropic:claude-sonnet-4-20250514");
	});

	it("returns null when no fallback chain exists for the model", () => {
		const attempted = new Set(["unknown:model-xyz"]);
		const result = getNextFallbackModel("unknown:model-xyz", attempted);
		expect(result).toBeNull();
	});

	it("skips already-attempted models and returns the next available", () => {
		const attempted = new Set([
			"anthropic:claude-opus-4-20250115",
			"anthropic:claude-sonnet-4-20250514",
		]);
		const result = getNextFallbackModel(
			"anthropic:claude-opus-4-20250115",
			attempted,
		);
		expect(result).toBe("anthropic:claude-haiku-4-5-20251001");
	});

	it("returns null when all fallbacks have been attempted", () => {
		const attempted = new Set([
			"anthropic:claude-opus-4-20250115",
			"anthropic:claude-sonnet-4-20250514",
			"anthropic:claude-haiku-4-5-20251001",
		]);
		const result = getNextFallbackModel(
			"anthropic:claude-opus-4-20250115",
			attempted,
		);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// withFallback
// ---------------------------------------------------------------------------

describe("withFallback", () => {
	// Use real timers for withFallback tests (the 1s delays are acceptable in tests)
	beforeEach(() => {
		vi.useRealTimers();
	});

	afterEach(() => {
		vi.useFakeTimers();
	});

	it("returns the result and model when fn succeeds on first try", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withFallback(
			"anthropic:claude-opus-4-20250115",
			fn,
			true,
		);
		expect(result).toEqual({
			result: "ok",
			modelId: "anthropic:claude-opus-4-20250115",
		});
		expect(fn).toHaveBeenCalledWith("anthropic:claude-opus-4-20250115");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("calls fn with fallback model on retryable error", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("429 rate limited"))
			.mockResolvedValueOnce("fallback-ok");

		const result = await withFallback(
			"anthropic:claude-opus-4-20250115",
			fn,
			true,
		);
		expect(result).toEqual({
			result: "fallback-ok",
			modelId: "anthropic:claude-sonnet-4-20250514",
		});
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenCalledWith("anthropic:claude-sonnet-4-20250514");
	}, 10000);

	it("throws on non-retryable error without trying fallback", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("invalid api key"));

		await expect(
			withFallback("anthropic:claude-opus-4-20250115", fn, true),
		).rejects.toThrow("invalid api key");

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("throws when fallback is disabled even for retryable errors", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("429 rate limited"));

		await expect(
			withFallback("anthropic:claude-opus-4-20250115", fn, false),
		).rejects.toThrow("429 rate limited");

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("throws when all fallback models are exhausted", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockRejectedValueOnce(new Error("503 Service Unavailable"));

		await expect(
			withFallback("anthropic:claude-opus-4-20250115", fn, true),
		).rejects.toThrow("503 Service Unavailable");
		expect(fn).toHaveBeenCalledTimes(3);
	}, 10000);
});

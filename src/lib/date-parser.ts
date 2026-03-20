/**
 * parseSinceDate -- parse relative or absolute date strings into Date objects.
 *
 * Supported relative patterns (case-insensitive):
 *   7d  -- 7 days ago
 *   30d -- 30 days ago
 *   2w  -- 14 days ago (2 weeks)
 *   1m  -- 1 month ago
 *   1y  -- 1 year ago
 *
 * Supported absolute patterns:
 *   2026-01-15            -- ISO date (YYYY-MM-DD)
 *   2026-01-15T14:30:00Z  -- ISO datetime
 *
 * Returns null for invalid or empty input.
 */
export function parseSinceDate(input: string): Date | null {
	if (!input || !input.trim()) {
		return null;
	}

	const trimmed = input.trim();

	// Relative patterns: <number><unit> where unit is d/w/m/y
	const relativeMatch = /^(\d+)\s*([dwmy])$/i.exec(trimmed);
	if (relativeMatch) {
		const amount = parseInt(relativeMatch[1]!, 10);
		const unit = relativeMatch[2]!.toLowerCase();

		const result = new Date();
		result.setHours(0, 0, 0, 0);

		switch (unit) {
			case "d":
				result.setDate(result.getDate() - amount);
				break;
			case "w":
				result.setDate(result.getDate() - amount * 7);
				break;
			case "m":
				result.setMonth(result.getMonth() - amount);
				break;
			case "y":
				result.setFullYear(result.getFullYear() - amount);
				break;
		}

		return result;
	}

	// ISO date / datetime patterns
	const parsed = new Date(trimmed);
	if (!isNaN(parsed.getTime())) {
		return parsed;
	}

	return null;
}

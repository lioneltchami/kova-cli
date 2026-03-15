import * as logger from "./logger.js";

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from(
    { length: m + 1 },
    () => Array(n + 1).fill(0) as number[],
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[m]![n]!;
}

export function suggestCommand(
  input: string,
  commands: string[],
): string | null {
  let bestMatch: string | null = null;
  let bestDistance = 4; // threshold: suggest only if distance <= 3

  for (const cmd of commands) {
    const dist = levenshteinDistance(input.toLowerCase(), cmd.toLowerCase());
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = cmd;
    }
  }

  return bestMatch;
}

export function formatErrorWithSuggestion(
  input: string,
  commands: string[],
): string {
  const suggestion = suggestCommand(input, commands);
  let msg = `Unknown command: ${input}.`;
  if (suggestion) {
    msg += ` Did you mean '${suggestion}'?`;
  }
  msg += "\nDocs: https://github.com/kova-cli/kova";
  return msg;
}

export function wrapCommandAction<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T): Promise<void> => {
    try {
      await action(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      if (process.env["KOVA_DEBUG"] && err instanceof Error && err.stack) {
        logger.debug(err.stack);
      }
      logger.info("Docs: https://github.com/kova-cli/kova");
      process.exitCode = 1;
    }
  };
}

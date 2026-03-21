import { colors } from "../lib/constants.js";
import { queryRecords } from "../lib/local-store.js";
import * as logger from "../lib/logger.js";
import type { AiTool } from "../types.js";

export interface HistoryOptions {
  tool?: string;
  project?: string;
  days?: string;
  limit?: string;
}

export async function historyCommand(options: HistoryOptions): Promise<void> {
  const days = options.days ? parseInt(options.days, 10) : 30;
  const limit = options.limit ? parseInt(options.limit, 10) : 50;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = queryRecords({
    tool: options.tool as AiTool | undefined,
    project: options.project,
    since,
  });

  if (records.length === 0) {
    logger.info("No usage records found for the given filters.");
    logger.info("Try: kova history --days 90 or kova track to scan for usage.");
    return;
  }

  // Group by session
  const sessions = new Map<string, typeof records>();
  for (const record of records) {
    const key = record.session_id || record.id;
    const group = sessions.get(key) ?? [];
    group.push(record);
    sessions.set(key, group);
  }

  logger.header("Session History");
  logger.info(
    `Showing last ${days} days${options.tool ? ` (tool: ${options.tool})` : ""}${options.project ? ` (project: ${options.project})` : ""}\n`,
  );

  // Build summary rows from sessions, sorted by most recent first
  const summaries = [...sessions.entries()]
    .map(([sessionId, recs]) => {
      const totalCost = recs.reduce((sum, r) => sum + r.cost_usd, 0);
      const totalInputTokens = recs.reduce((sum, r) => sum + r.input_tokens, 0);
      const totalOutputTokens = recs.reduce(
        (sum, r) => sum + r.output_tokens,
        0,
      );
      const totalDuration = recs.reduce(
        (sum, r) => sum + (r.duration_ms ?? 0),
        0,
      );
      const models = [...new Set(recs.map((r) => r.model))];
      const tools = [...new Set(recs.map((r) => r.tool))];
      const projects = [...new Set(recs.map((r) => r.project).filter(Boolean))];
      const timestamp = recs.reduce(
        (latest, r) => (r.timestamp > latest ? r.timestamp : latest),
        recs[0].timestamp,
      );

      return {
        sessionId: sessionId.slice(0, 8),
        timestamp,
        tool: tools.join(", "),
        model: models.join(", "),
        project: projects.join(", ") || "-",
        cost: totalCost,
        tokens: totalInputTokens + totalOutputTokens,
        duration: totalDuration,
        turns: recs.length,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  // Display as table
  const rows: [string, string][] = [];
  for (const s of summaries) {
    const date = s.timestamp.slice(0, 10);
    const time = s.timestamp.slice(11, 16);
    const durationStr =
      s.duration > 0 ? `${(s.duration / 1000).toFixed(0)}s` : "-";

    rows.push([
      `${date} ${time}`,
      `${colors.brand("$" + s.cost.toFixed(4))} | ${s.model} | ${s.project} | ${s.tokens.toLocaleString()} tok | ${durationStr} | ${s.turns} turns`,
    ]);
  }

  logger.table(rows);

  // Summary
  const totalCost = summaries.reduce((sum, s) => sum + s.cost, 0);
  console.log();
  logger.info(
    `Total: ${colors.brand("$" + totalCost.toFixed(4))} across ${summaries.length} sessions`,
  );
}

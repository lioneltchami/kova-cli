import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsageRecord } from "../../src/types.js";

vi.mock("../../src/lib/local-store.js", () => ({
  queryRecords: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/lib/logger.js", () => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  table: vi.fn(),
}));

import { historyCommand } from "../../src/commands/history.js";
import { queryRecords } from "../../src/lib/local-store.js";
import * as loggerMod from "../../src/lib/logger.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queryRecords).mockReturnValue([]);
});

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: "rec-001",
    tool: "claude_code",
    model: "sonnet",
    session_id: "sess-aaa",
    project: "my-project",
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.005,
    timestamp: "2026-03-15T10:30:00Z",
    duration_ms: 2000,
    metadata: {},
    ...overrides,
  };
}

describe("historyCommand", () => {
  it('shows "no records found" when queryRecords returns empty', async () => {
    await historyCommand({});

    expect(loggerMod.info).toHaveBeenCalledWith(
      expect.stringContaining("No usage records found"),
    );
  });

  it("displays sessions grouped by session_id", async () => {
    vi.mocked(queryRecords).mockReturnValue([
      makeRecord({ id: "r1", session_id: "sess-aaa" }),
      makeRecord({ id: "r2", session_id: "sess-aaa" }),
      makeRecord({ id: "r3", session_id: "sess-bbb" }),
    ]);

    await historyCommand({});

    expect(loggerMod.header).toHaveBeenCalledWith("Session History");
    // logger.table receives rows grouped by session; 2 sessions = 2 rows
    expect(loggerMod.table).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.arrayContaining([expect.any(String), expect.any(String)]),
      ]),
    );
    const rows = vi.mocked(loggerMod.table).mock.calls[0][0] as string[][];
    expect(rows).toHaveLength(2);
  });

  it("passes --tool filter to queryRecords", async () => {
    await historyCommand({ tool: "cursor" });

    expect(queryRecords).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "cursor" }),
    );
  });

  it("passes --project filter to queryRecords", async () => {
    await historyCommand({ project: "my-app" });

    expect(queryRecords).toHaveBeenCalledWith(
      expect.objectContaining({ project: "my-app" }),
    );
  });

  it("respects --days option for the since date", async () => {
    await historyCommand({ days: "7" });

    const call = vi.mocked(queryRecords).mock.calls[0][0];
    const since = call.since as Date;
    // The since date should be roughly 7 days ago
    const now = new Date();
    const diffMs = now.getTime() - since.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("respects --limit option by truncating displayed sessions", async () => {
    // Create 5 records with distinct sessions
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        id: `r-${i}`,
        session_id: `sess-${i}`,
        timestamp: `2026-03-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
      }),
    );
    vi.mocked(queryRecords).mockReturnValue(records);

    await historyCommand({ limit: "3" });

    const rows = vi.mocked(loggerMod.table).mock.calls[0][0] as string[][];
    expect(rows).toHaveLength(3);
  });
});

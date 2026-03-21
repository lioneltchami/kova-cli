import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure mockServer is available in the mock factory
const mockServer = vi.hoisted(() => {
  return {
    resource: vi.fn(),
    tool: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: vi.fn(() => mockServer),
  };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("../../src/lib/local-store.js", () => ({
  queryRecords: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/lib/cost-calculator.js", () => ({
  aggregateCosts: vi.fn().mockReturnValue({
    total_cost_usd: 0,
    total_sessions: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    by_tool: {},
    by_model: {},
    by_day: {},
    by_project: {},
  }),
}));

vi.mock("../../src/lib/config-store.js", () => ({
  readConfig: vi.fn().mockReturnValue({
    budget: {
      monthly_usd: 100,
      daily_usd: 10,
      warn_at_percent: 80,
    },
  }),
}));

vi.mock("../../src/lib/formatter.js", () => ({
  formatMoney: vi.fn((v: number) => `$${v.toFixed(2)}`),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startMcpServer } from "../../src/mcp/server.js";

describe("startMcpServer", () => {
  it("creates an McpServer with name kova", async () => {
    await startMcpServer();

    expect(McpServer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "kova" }),
    );
  });

  it("registers expected resources (costs-today, costs-week, budget-status)", async () => {
    await startMcpServer();

    const resourceCalls = mockServer.resource.mock.calls;
    const resourceNames = resourceCalls.map(
      (call: unknown[]) => call[0] as string,
    );

    expect(resourceNames).toContain("costs-today");
    expect(resourceNames).toContain("costs-week");
    expect(resourceNames).toContain("budget-status");
    expect(resourceCalls).toHaveLength(3);
  });

  it("registers expected tools (get_costs, budget_check, track_usage)", async () => {
    await startMcpServer();

    const toolCalls = mockServer.tool.mock.calls;
    const toolNames = toolCalls.map((call: unknown[]) => call[0] as string);

    expect(toolNames).toContain("get_costs");
    expect(toolNames).toContain("budget_check");
    expect(toolNames).toContain("track_usage");
    expect(toolCalls).toHaveLength(3);
  });
});

describe("mcpCommand", () => {
  it("does not throw when invoked", async () => {
    const { mcpCommand } = await import("../../src/commands/mcp.js");

    await expect(mcpCommand()).resolves.not.toThrow();
  });
});

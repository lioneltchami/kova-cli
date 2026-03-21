export async function mcpCommand(): Promise<void> {
  const { startMcpServer } = await import("../mcp/server.js");
  await startMcpServer();
}

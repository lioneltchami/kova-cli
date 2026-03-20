import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process exec so no real browser is opened
vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, cb: (err: Error | null) => void) => {
    cb(null);
  }),
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

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-dashboard-test-"));
  process.env["HOME"] = tmpDir;
  process.env["USERPROFILE"] = tmpDir;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("dashboardCommand", () => {
  it("opens URL via exec when no credentials file present", async () => {
    const { exec } = await import("node:child_process");
    const { dashboardCommand } = await import(
      "../../src/commands/dashboard.js"
    );
    await dashboardCommand();

    expect(vi.mocked(exec)).toHaveBeenCalledOnce();
    const cmd = vi.mocked(exec).mock.calls[0]?.[0] ?? "";
    expect(cmd).toContain("kova.dev/dashboard");
  });

  it("falls back to kova.dev/dashboard when no credentials stored", async () => {
    const logger = await import("../../src/lib/logger.js");
    const { dashboardCommand } = await import(
      "../../src/commands/dashboard.js"
    );
    await dashboardCommand();

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("kova.dev/dashboard");
  });

  it("uses dashboardUrl from credentials when credentials file exists", async () => {
    // Write a credentials file with a custom dashboardUrl
    const kovaDir = path.join(tmpDir, ".kova");
    fs.mkdirSync(kovaDir, { recursive: true });
    const creds = {
      apiKey: "test-key-123",
      dashboardUrl: "https://custom.kova.dev/dashboard",
      syncedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(kovaDir, "credentials.json"),
      JSON.stringify(creds),
      "utf-8",
    );

    const logger = await import("../../src/lib/logger.js");
    const { dashboardCommand } = await import(
      "../../src/commands/dashboard.js"
    );
    await dashboardCommand();

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("custom.kova.dev/dashboard");
  });

  it("logs URL to open manually when exec callback returns error", async () => {
    // Override mock for this test to simulate exec failure
    const { exec } = await import("node:child_process");
    vi.mocked(exec).mockImplementationOnce(
      (_cmd: string, cb: (err: Error | null) => void) => {
        cb(new Error("open command not found"));
        return undefined as unknown as ReturnType<typeof exec>;
      },
    );

    const logger = await import("../../src/lib/logger.js");
    const { dashboardCommand } = await import(
      "../../src/commands/dashboard.js"
    );
    await dashboardCommand();

    const infoCalls = vi.mocked(logger.info).mock.calls.flat().join(" ");
    // Should still mention the URL in the "Open manually" fallback message
    expect(infoCalls).toContain("kova.dev/dashboard");
  });
});

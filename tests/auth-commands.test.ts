import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCommandRegistry } from "../src/lib/completions.js";
import {
  isLoggedIn,
  readCredentials,
  removeCredentials,
  storeCredentials,
} from "../src/lib/dashboard.js";
import type { DashboardCredentials } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kova-auth-test-"));
}

function makeCreds(
  overrides: Partial<DashboardCredentials> = {},
): DashboardCredentials {
  return {
    apiKey: "kova_testkey_abcdef",
    dashboardUrl: "https://kova.dev",
    userId: "user-abc",
    email: "user@test.com",
    plan: "pro",
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Completions registry includes new commands
// ---------------------------------------------------------------------------

describe("getCommandRegistry includes auth commands", () => {
  it("includes the 'login' command", () => {
    const names = getCommandRegistry().map((c) => c.name);
    expect(names).toContain("login");
  });

  it("includes the 'logout' command", () => {
    const names = getCommandRegistry().map((c) => c.name);
    expect(names).toContain("logout");
  });

  it("includes the 'account' command", () => {
    const names = getCommandRegistry().map((c) => c.name);
    expect(names).toContain("account");
  });

  it("has 9 commands total (track, costs, budget, sync, report, login, logout, account, completions)", () => {
    expect(getCommandRegistry()).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// Full credentials lifecycle with temp dirs
// ---------------------------------------------------------------------------

describe("credentials lifecycle", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env["HOME"] = tmpDir;
    process.env["USERPROFILE"] = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("storeCredentials writes a file that readCredentials can read back", () => {
    const creds = makeCreds();
    storeCredentials(creds);
    const read = readCredentials();
    expect(read).not.toBeNull();
    expect(read?.apiKey).toBe(creds.apiKey);
  });

  it("readCredentials returns null when nothing has been stored", () => {
    expect(readCredentials()).toBeNull();
  });

  it("isLoggedIn is false before storing credentials", () => {
    expect(isLoggedIn()).toBe(false);
  });

  it("isLoggedIn is true after storing credentials", () => {
    storeCredentials(makeCreds());
    expect(isLoggedIn()).toBe(true);
  });

  it("removeCredentials deletes the credentials file", () => {
    storeCredentials(makeCreds());
    expect(isLoggedIn()).toBe(true);
    removeCredentials();
    expect(isLoggedIn()).toBe(false);
  });

  it("removeCredentials does not throw if called when not logged in", () => {
    expect(() => removeCredentials()).not.toThrow();
  });

  it("full store -> read -> remove cycle works end to end", () => {
    // Not logged in
    expect(isLoggedIn()).toBe(false);

    // Store
    const creds = makeCreds({ plan: "team", email: "admin@company.com" });
    storeCredentials(creds);
    expect(isLoggedIn()).toBe(true);

    // Read back and verify fields
    const read = readCredentials();
    expect(read?.plan).toBe("team");
    expect(read?.email).toBe("admin@company.com");
    expect(read?.apiKey).toBe(creds.apiKey);

    // Remove
    removeCredentials();
    expect(isLoggedIn()).toBe(false);
    expect(readCredentials()).toBeNull();
  });

  it("overwriting credentials updates them correctly", () => {
    storeCredentials(makeCreds({ plan: "free" }));
    storeCredentials(makeCreds({ plan: "enterprise" }));
    const read = readCredentials();
    expect(read?.plan).toBe("enterprise");
  });
});

// ---------------------------------------------------------------------------
// DashboardCredentials type shape verification
// ---------------------------------------------------------------------------

describe("DashboardCredentials type", () => {
  it("has all expected fields", () => {
    const creds: DashboardCredentials = {
      apiKey: "kova_abc",
      dashboardUrl: "https://kova.dev",
      userId: "u-1",
      email: "a@b.com",
      plan: "free",
      cachedAt: new Date().toISOString(),
    };
    expect(creds).toHaveProperty("apiKey");
    expect(creds).toHaveProperty("dashboardUrl");
    expect(creds).toHaveProperty("userId");
    expect(creds).toHaveProperty("email");
    expect(creds).toHaveProperty("plan");
    expect(creds).toHaveProperty("cachedAt");
  });

  it("plan field accepts all valid values", () => {
    const plans: DashboardCredentials["plan"][] = [
      "free",
      "pro",
      "team",
      "enterprise",
    ];
    for (const plan of plans) {
      const creds: DashboardCredentials = makeCreds({ plan });
      expect(creds.plan).toBe(plan);
    }
  });
});

// Note: BuildUploadPayload type removed in FinOps pivot (v0.2.0).
// Use UsageUploadPayload from types.ts for the new upload shape.

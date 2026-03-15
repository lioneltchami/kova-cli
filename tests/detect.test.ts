import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/lib/detect.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Helper to write JSON files
function writePkg(dir: string, pkg: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(pkg),
    "utf-8",
  );
}

describe("detectProject", () => {
  // Language detection
  it("detects TypeScript when tsconfig.json exists", async () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}", "utf-8");
    writePkg(tmpDir, {});
    const result = await detectProject(tmpDir);
    expect(result.language).toBe("TypeScript");
  });

  it("detects Python when pyproject.toml exists", async () => {
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), "", "utf-8");
    const result = await detectProject(tmpDir);
    expect(result.language).toBe("Python");
  });

  it("detects Go when go.mod exists", async () => {
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "", "utf-8");
    const result = await detectProject(tmpDir);
    expect(result.language).toBe("Go");
  });

  it("detects JavaScript when only package.json exists", async () => {
    writePkg(tmpDir, {});
    const result = await detectProject(tmpDir);
    expect(result.language).toBe("JavaScript");
  });

  it("returns null language for empty directory", async () => {
    const result = await detectProject(tmpDir);
    expect(result.language).toBeNull();
  });

  // Framework detection
  it("detects Next.js from package.json dependencies", async () => {
    writePkg(tmpDir, { dependencies: { next: "14.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.framework).toBe("Next.js");
  });

  it("detects Expo from package.json dependencies", async () => {
    writePkg(tmpDir, { dependencies: { expo: "51.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.framework).toBe("Expo");
  });

  it("detects React (without Next) from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { react: "18.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.framework).toBe("React");
  });

  it("detects Vue from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { vue: "3.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.framework).toBe("Vue");
  });

  it("detects Express from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { express: "4.18.0" } });
    const result = await detectProject(tmpDir);
    expect(result.framework).toBe("Express");
  });

  // Package manager detection
  it("detects npm from package-lock.json", async () => {
    fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}", "utf-8");
    const result = await detectProject(tmpDir);
    expect(result.packageManager).toBe("npm");
  });

  it("detects yarn from yarn.lock", async () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "", "utf-8");
    const result = await detectProject(tmpDir);
    expect(result.packageManager).toBe("yarn");
  });

  it("detects pnpm from pnpm-lock.yaml", async () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "", "utf-8");
    const result = await detectProject(tmpDir);
    expect(result.packageManager).toBe("pnpm");
  });

  // Database detection
  it("detects Supabase from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { "@supabase/supabase-js": "2.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.database).toBe("Supabase");
  });

  it("detects Prisma from dependencies", async () => {
    writePkg(tmpDir, { devDependencies: { prisma: "5.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.database).toBe("Prisma");
  });

  // Auth detection
  it("detects BetterAuth from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { "better-auth": "1.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.auth).toBe("BetterAuth");
  });

  it("detects NextAuth from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { "next-auth": "4.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.auth).toBe("NextAuth");
  });

  // Payments detection
  it("detects Stripe from dependencies", async () => {
    writePkg(tmpDir, { dependencies: { stripe: "14.0.0" } });
    const result = await detectProject(tmpDir);
    expect(result.payments).toBe("Stripe");
  });

  // Commands detection
  it("extracts test, lint, build scripts from package.json", async () => {
    writePkg(tmpDir, {
      scripts: {
        test: "vitest run",
        lint: "eslint .",
        build: "tsc",
        typecheck: "tsc --noEmit",
        dev: "vite",
      },
    });
    const result = await detectProject(tmpDir);
    expect(result.commands.test).toBe("vitest run");
    expect(result.commands.lint).toBe("eslint .");
    expect(result.commands.build).toBe("tsc");
    expect(result.commands.typecheck).toBe("tsc --noEmit");
    expect(result.commands.dev).toBe("vite");
  });

  it("returns null commands for missing scripts", async () => {
    writePkg(tmpDir, {});
    const result = await detectProject(tmpDir);
    expect(result.commands.test).toBeNull();
    expect(result.commands.lint).toBeNull();
    expect(result.commands.build).toBeNull();
    expect(result.commands.typecheck).toBeNull();
    expect(result.commands.dev).toBeNull();
  });
});

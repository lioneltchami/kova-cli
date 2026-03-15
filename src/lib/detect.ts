import fs from "fs";
import path from "path";
import type { DetectedProject } from "../types.js";

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(dir: string): PackageJson | null {
  const pkgPath = path.join(dir, "package.json");
  try {
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function detectLanguage(projectDir: string): string | null {
  if (fileExists(path.join(projectDir, "tsconfig.json"))) return "TypeScript";
  if (fileExists(path.join(projectDir, "pyproject.toml"))) return "Python";
  if (fileExists(path.join(projectDir, "go.mod"))) return "Go";
  if (fileExists(path.join(projectDir, "Cargo.toml"))) return "Rust";
  if (fileExists(path.join(projectDir, "package.json"))) return "JavaScript";
  return null;
}

function detectFramework(
  projectDir: string,
  pkg: PackageJson | null,
): string | null {
  if (pkg) {
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    if ("next" in allDeps) return "Next.js";
    if ("expo" in allDeps) return "Expo";
    if ("nuxt" in allDeps) return "Nuxt";
    if ("react" in allDeps) return "React";
    if ("vue" in allDeps) return "Vue";
    if ("@angular/core" in allDeps) return "Angular";
    if ("express" in allDeps) return "Express";
  }

  // Check pyproject.toml for FastAPI
  const pyprojectPath = path.join(projectDir, "pyproject.toml");
  if (fileExists(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      if (content.includes("fastapi")) return "FastAPI";
    } catch {
      // ignore
    }
  }

  return null;
}

function detectPackageManager(projectDir: string): string | null {
  if (fileExists(path.join(projectDir, "package-lock.json"))) return "npm";
  if (fileExists(path.join(projectDir, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(path.join(projectDir, "bun.lockb"))) return "bun";
  return null;
}

function detectDatabase(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  if ("@supabase/supabase-js" in allDeps) return "Supabase";
  if ("prisma" in allDeps || "@prisma/client" in allDeps) return "Prisma";
  if ("drizzle-orm" in allDeps) return "Drizzle";
  if ("mongoose" in allDeps) return "MongoDB";
  return null;
}

function detectAuth(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  if ("better-auth" in allDeps) return "BetterAuth";
  if ("next-auth" in allDeps) return "NextAuth";
  if (
    "@supabase/auth-helpers-nextjs" in allDeps ||
    "@supabase/auth-helpers" in allDeps
  )
    return "Supabase Auth";
  if ("passport" in allDeps) return "Passport";
  return null;
}

function detectPayments(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  if ("stripe" in allDeps) return "Stripe";
  if ("@polar-sh/sdk" in allDeps) return "Polar";
  if ("dodopayments" in allDeps) return "Dodo Payments";
  return null;
}

function detectCommands(pkg: PackageJson | null): DetectedProject["commands"] {
  const scripts = pkg?.scripts ?? {};
  return {
    test: scripts["test"] ?? null,
    lint: scripts["lint"] ?? null,
    build: scripts["build"] ?? null,
    typecheck: scripts["typecheck"] ?? scripts["type-check"] ?? null,
    dev: scripts["dev"] ?? null,
  };
}

export async function detectProject(
  projectDir: string,
): Promise<DetectedProject> {
  const pkg = readPackageJson(projectDir);

  return {
    language: detectLanguage(projectDir),
    framework: detectFramework(projectDir, pkg),
    packageManager: detectPackageManager(projectDir),
    database: detectDatabase(pkg),
    auth: detectAuth(pkg),
    payments: detectPayments(pkg),
    commands: detectCommands(pkg),
  };
}

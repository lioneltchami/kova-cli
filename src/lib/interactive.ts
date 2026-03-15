import path from "path";
import type { DetectedProject, PlanType } from "../types.js";

export interface InteractiveInitResult {
  projectName: string;
  language: string;
  framework: string;
  packageManager: string;
  database: string | null;
  auth: string | null;
  payments: string | null;
  planType: PlanType;
  enableWebhooks: boolean;
  confirmed: boolean;
}

export interface InitOptions {
  force?: boolean;
  merge?: boolean;
  dryRun?: boolean;
  noDetect?: boolean;
  preset?: string;
}

export function isInteractiveMode(options: InitOptions): boolean {
  // Interactive mode when stdin is TTY and no meaningful flags are set
  if (!process.stdin.isTTY) return false;
  if (
    options.force ||
    options.merge ||
    options.dryRun ||
    options.noDetect ||
    options.preset
  ) {
    return false;
  }
  return true;
}

export async function runInteractiveInit(
  detected: DetectedProject,
): Promise<InteractiveInitResult> {
  // Dynamic import to avoid loading @inquirer/prompts when not in interactive mode
  const { input, confirm, select } = await import("@inquirer/prompts");

  // 1. Project name
  const projectName = await input({
    message: "Project name",
    default: path.basename(process.cwd()),
  });

  // 2. Confirm detection
  const detectedLabel =
    [detected.language, detected.framework].filter(Boolean).join(" + ") ||
    "Unknown";
  const detectionCorrect = await confirm({
    message: `Detected ${detectedLabel}. Correct?`,
    default: true,
  });

  let language = detected.language ?? "TypeScript";
  let framework = detected.framework ?? "";

  if (!detectionCorrect) {
    language = await select({
      message: "Language",
      choices: [
        { name: "TypeScript", value: "TypeScript" },
        { name: "JavaScript", value: "JavaScript" },
        { name: "Python", value: "Python" },
        { name: "Go", value: "Go" },
        { name: "Rust", value: "Rust" },
      ],
      default: detected.language ?? "TypeScript",
    });

    framework = await select({
      message: "Framework",
      choices: [
        { name: "Next.js", value: "Next.js" },
        { name: "Expo", value: "Expo" },
        { name: "React", value: "React" },
        { name: "Vue", value: "Vue" },
        { name: "Angular", value: "Angular" },
        { name: "Express", value: "Express" },
        { name: "FastAPI", value: "FastAPI" },
        { name: "None", value: "" },
      ],
      default: detected.framework ?? "",
    });
  }

  // 3. Database
  const databaseChoice = await select({
    message: "Database",
    choices: [
      { name: "Supabase", value: "Supabase" },
      { name: "Prisma", value: "Prisma" },
      { name: "Drizzle", value: "Drizzle" },
      { name: "MongoDB", value: "MongoDB" },
      { name: "None", value: "None" },
    ],
    default: detected.database ?? "None",
  });

  // 4. Auth
  const authChoice = await select({
    message: "Auth provider",
    choices: [
      { name: "BetterAuth", value: "BetterAuth" },
      { name: "NextAuth", value: "NextAuth" },
      { name: "Supabase Auth", value: "Supabase Auth" },
      { name: "Passport", value: "Passport" },
      { name: "None", value: "None" },
    ],
    default: detected.auth ?? "None",
  });

  // 5. Payments
  const paymentsChoice = await select({
    message: "Payment provider",
    choices: [
      { name: "Stripe", value: "Stripe" },
      { name: "Polar", value: "Polar" },
      { name: "Dodo Payments", value: "Dodo Payments" },
      { name: "None", value: "None" },
    ],
    default: detected.payments ?? "None",
  });

  // 6. Claude plan
  const planType = await select({
    message: "Claude plan (for token tracking)",
    choices: [
      { name: "Pro ($20/mo)", value: "pro" as PlanType },
      { name: "Max 5x (~$80/mo)", value: "max5" as PlanType },
      { name: "Max 20x (~$320/mo)", value: "max20" as PlanType },
      { name: "API (pay-per-token)", value: "api" as PlanType },
    ],
    default: "max5" as PlanType,
  });

  // 7. Webhooks
  const enableWebhooks = await confirm({
    message: "Enable webhook notifications?",
    default: false,
  });

  return {
    projectName,
    language,
    framework,
    packageManager: detected.packageManager ?? "npm",
    database: databaseChoice === "None" ? null : databaseChoice,
    auth: authChoice === "None" ? null : authChoice,
    payments: paymentsChoice === "None" ? null : paymentsChoice,
    planType,
    enableWebhooks,
    confirmed: true,
  };
}

import * as readline from "node:readline";
import { exec } from "node:child_process";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { claudeCodeCollector } from "../lib/collectors/claude-code.js";
import { copilotCollector } from "../lib/collectors/copilot.js";
import { cursorCollector } from "../lib/collectors/cursor.js";
import { devinCollector } from "../lib/collectors/devin.js";
import { windsurfCollector } from "../lib/collectors/windsurf.js";
import type { Collector } from "../lib/collectors/types.js";
import { readCredentials, storeCredentials } from "../lib/dashboard.js";
import { appendRecords } from "../lib/local-store.js";
import { getDailyCosts } from "../lib/cost-calculator.js";
import { formatMoney } from "../lib/formatter.js";
import { colors, KOVA_DATA_DIR } from "../lib/constants.js";
import type { AiTool } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

function printBanner(): void {
  const line = colors.brand("=".repeat(48));
  console.log("");
  console.log(line);
  console.log(
    colors.brand("  ") +
      chalk.bold.hex("#4361EE")("  K O V A") +
      "  " +
      chalk.dim("AI Dev Cost Tracker"),
  );
  console.log(colors.dim("  Know what your AI tools actually cost."));
  console.log(line);
  console.log("");
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start ${url}`
      : process.platform === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;
  exec(cmd, (err) => {
    if (err) {
      console.log(colors.dim("  Open manually: ") + chalk.underline(url));
    }
  });
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

interface ToolEntry {
  key: AiTool;
  label: string;
  collector: Collector;
}

const ALL_TOOLS: ToolEntry[] = [
  { key: "claude_code", label: "Claude Code", collector: claudeCodeCollector },
  { key: "cursor", label: "Cursor", collector: cursorCollector },
  { key: "copilot", label: "GitHub Copilot", collector: copilotCollector },
  { key: "windsurf", label: "Windsurf", collector: windsurfCollector },
  { key: "devin", label: "Devin", collector: devinCollector },
];

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export async function initCommand(): Promise<void> {
  printBanner();

  console.log(chalk.bold("  Welcome to Kova setup!"));
  console.log(
    colors.dim("  This wizard scans for AI tools on your machine and"),
  );
  console.log(colors.dim("  shows you your first cost insight.\n"));

  // Step 1: auto-detect available tools
  console.log(chalk.bold("  Step 1/3 — Detecting AI tools\n"));

  const detected: ToolEntry[] = [];
  const notDetected: ToolEntry[] = [];

  for (const tool of ALL_TOOLS) {
    const available = await tool.collector.isAvailable();
    if (available) {
      detected.push(tool);
    } else {
      notDetected.push(tool);
    }
  }

  if (detected.length === 0) {
    console.log(colors.warning("  No AI tools detected on this machine."));
    console.log(
      colors.dim("  Install Claude Code, Cursor, Copilot, Windsurf, or Devin"),
    );
    console.log(
      colors.dim("  and run ") +
        chalk.cyan("kova init") +
        colors.dim(" again.\n"),
    );
    return;
  }

  for (const tool of detected) {
    console.log("  " + chalk.green("✓") + "  " + chalk.bold(tool.label));
  }
  for (const tool of notDetected) {
    console.log(
      "  " + colors.dim("○") + "  " + colors.dim(tool.label + " (not found)"),
    );
  }

  console.log("");

  // Step 2: confirm which to scan
  console.log(chalk.bold("  Step 2/3 — Quick scan\n"));

  const toolList = detected.map((t) => t.label).join(", ");
  const confirm = await prompt(
    colors.info("  Scan detected tools? ") +
      colors.dim(`(${toolList}) `) +
      chalk.cyan("[Y/n] "),
  );

  const shouldScan = confirm === "" || confirm.toLowerCase().startsWith("y");

  if (!shouldScan) {
    console.log(
      "\n" +
        colors.dim(
          "  Skipped scan. Run " +
            chalk.cyan("kova track") +
            " any time to start collecting data.",
        ),
    );
    printNextSteps(false);
    return;
  }

  console.log("");
  console.log(colors.dim("  Scanning..."));

  // If user typed a custom subset e.g. "cursor,claude"
  let toolsToScan = detected;
  if (
    confirm !== "" &&
    !confirm.toLowerCase().startsWith("y") &&
    !confirm.toLowerCase().startsWith("n")
  ) {
    const names = confirm
      .toLowerCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    toolsToScan = detected.filter((t) =>
      names.some((n) => t.label.toLowerCase().includes(n)),
    );
    if (toolsToScan.length === 0) toolsToScan = detected;
  }

  const allRecords: import("../types.js").UsageRecord[] = [];

  for (const tool of toolsToScan) {
    process.stdout.write("  " + colors.dim(`  Scanning ${tool.label}...`));
    try {
      const result = await tool.collector.collect();
      allRecords.push(...result.records);
      process.stdout.write(" " + chalk.green("done\n"));
    } catch {
      process.stdout.write(" " + colors.dim("skipped\n"));
    }
  }

  // Persist new records
  const added = appendRecords(allRecords);

  // Compute total estimated cost
  const dailyCosts = getDailyCosts(allRecords);
  const totalCost = Object.values(dailyCosts).reduce((a, b) => a + b, 0);
  const sessionCount = new Set(
    allRecords.filter((r) => r.session_id).map((r) => r.session_id),
  ).size;

  console.log("");
  console.log(chalk.bold("  First insight:"));
  console.log(
    "  " +
      chalk.green("✓") +
      "  Found " +
      chalk.bold(String(added)) +
      " usage records across " +
      chalk.bold(String(sessionCount)) +
      " sessions",
  );
  console.log(
    "  " +
      chalk.green("✓") +
      "  Estimated cost: " +
      chalk.bold.hex("#4361EE")(formatMoney(totalCost)),
  );
  console.log("");

  // Step 3: offer sync
  console.log(chalk.bold("  Step 3/3 — Sync to dashboard (optional)\n"));
  console.log(
    colors.dim(
      "  Kova Dashboard gives you charts, budget alerts, and team reports.",
    ),
  );
  const syncAnswer = await prompt(
    colors.info("  Sync data to kova.dev/dashboard? ") + chalk.cyan("[y/N] "),
  );

  if (syncAnswer.toLowerCase().startsWith("y")) {
    const existingCreds = readCredentials();
    if (existingCreds?.apiKey) {
      console.log(
        "\n  " + chalk.green("✓") + "  Already logged in. Running sync...\n",
      );
      try {
        const { syncCommand } = await import("./sync.js");
        await syncCommand({});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(colors.warning("  Sync failed: " + msg));
      }
    } else {
      const keyAnswer = await prompt(
        "\n  Enter your API key (or press Enter to open the dashboard): ",
      );

      if (keyAnswer.length > 0) {
        // Store the key and sync
        const creds = {
          apiKey: keyAnswer,
          dashboardUrl: "https://kova.dev/dashboard",
          syncedAt: new Date().toISOString(),
        };
        storeCredentials(creds);
        console.log(
          "\n  " + chalk.green("✓") + "  API key saved. Running sync...\n",
        );
        try {
          const { syncCommand } = await import("./sync.js");
          await syncCommand({});
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(colors.warning("  Sync failed: " + msg));
        }
      } else {
        const url = "https://kova.dev/dashboard/settings";
        console.log(
          "\n  " +
            colors.dim("Visit ") +
            chalk.underline(url) +
            colors.dim(" to get your API key."),
        );
        console.log(
          colors.dim(
            "  Then run " +
              chalk.cyan("kova login <your-api-key>") +
              " to connect.",
          ),
        );
        openBrowser(url);
      }
    }
  }

  printNextSteps(true);
}

function printNextSteps(scanned: boolean): void {
  console.log("");
  const line = colors.dim("-".repeat(48));
  console.log("  " + line);
  console.log("  " + chalk.bold("Next steps:"));
  console.log("");
  if (!scanned) {
    console.log(
      "  " +
        chalk.cyan("kova track") +
        colors.dim("           Scan AI tool usage"),
    );
  }
  console.log(
    "  " +
      chalk.cyan("kova costs") +
      colors.dim("           View cost breakdown"),
  );
  console.log(
    "  " +
      chalk.cyan("kova dashboard") +
      colors.dim("       Open the web dashboard"),
  );
  console.log(
    "  " +
      chalk.cyan("kova track --daemon") +
      colors.dim("  Run continuous background tracking"),
  );
  console.log("  " + line);
  console.log("");
}

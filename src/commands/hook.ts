import fs from "fs";
import path from "path";
import * as logger from "../lib/logger.js";

export async function hookCommand(action?: string): Promise<void> {
  if (action !== "install") {
    logger.header("Kova Hook");
    logger.info("Usage: kova hook install");
    logger.info(
      "Installs a Claude Code hook that auto-tracks usage after each session.",
    );
    return;
  }

  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  const hookEntry = {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: "kova track --tool claude_code --quiet 2>/dev/null || true",
      },
    ],
  };

  // Ensure .claude directory exists
  fs.mkdirSync(claudeDir, { recursive: true });

  if (fs.existsSync(settingsPath)) {
    // Merge with existing settings
    try {
      const existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      existing.hooks = existing.hooks ?? {};
      existing.hooks.Stop = existing.hooks.Stop ?? [];

      // Check if our hook is already installed
      const alreadyInstalled = existing.hooks.Stop.some(
        (entry: Record<string, unknown>) =>
          Array.isArray(entry.hooks) &&
          entry.hooks.some(
            (h: Record<string, unknown>) =>
              typeof h.command === "string" && h.command.includes("kova track"),
          ),
      );

      if (alreadyInstalled) {
        logger.info("Kova hook is already installed in this project.");
        return;
      }

      existing.hooks.Stop.push(hookEntry);
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(existing, null, 2),
        "utf-8",
      );
    } catch {
      // If we can't parse existing, create fresh
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({ hooks: { Stop: [hookEntry] } }, null, 2),
        "utf-8",
      );
    }
  } else {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [hookEntry] } }, null, 2),
      "utf-8",
    );
  }

  logger.success("Kova hook installed!");
  logger.info("Claude Code will now auto-track usage after each session.");
  logger.info(`Hook added to: ${settingsPath}`);
}

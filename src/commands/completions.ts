import {
  generateBashCompletion,
  generateFishCompletion,
  generateZshCompletion,
} from "../lib/completions.js";
import * as logger from "../lib/logger.js";

export async function completionsCommand(shell?: string): Promise<void> {
  if (!shell) {
    logger.info("Usage: kova completions <bash|zsh|fish>");
    logger.info("");
    logger.info("Generate shell completion scripts:");
    logger.info("  kova completions bash >> ~/.bashrc");
    logger.info("  kova completions zsh >> ~/.zshrc");
    logger.info(
      "  kova completions fish > ~/.config/fish/completions/kova.fish",
    );
    return;
  }

  switch (shell.toLowerCase()) {
    case "bash":
      process.stdout.write(generateBashCompletion());
      break;
    case "zsh":
      process.stdout.write(generateZshCompletion());
      break;
    case "fish":
      process.stdout.write(generateFishCompletion());
      break;
    default:
      logger.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
      process.exitCode = 1;
      return;
  }
}

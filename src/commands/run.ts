import * as logger from "../lib/logger.js";
import { planCommand } from "./plan.js";

export interface RunOptions {
  model?: string;
  template?: string;
  auto?: boolean;
  live?: boolean;
  resume?: boolean;
  parallel?: number;
  modelOverride?: string;
  verbose?: boolean;
  validate?: boolean;
  issue?: string;
  branch?: string;
  noBranch?: boolean;
}

export async function runCommand(
  prompt: string,
  options: RunOptions,
): Promise<void> {
  if (!prompt || prompt.trim() === "") {
    logger.error(
      'Please provide a prompt. Example: kova run "add user profiles"',
    );
    process.exit(1);
  }

  logger.banner();
  logger.info("Starting plan-and-build workflow...");

  await planCommand(prompt, {
    model: options.model,
    template: options.template,
    autoBuild: options.auto !== false,
    output: undefined,
    issue: options.issue,
    noBranch: options.noBranch,
  });
}

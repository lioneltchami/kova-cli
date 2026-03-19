import chalk from "chalk";

const isDebug = !!process.env["KOVA_DEBUG"];

// Status icons for task progress display
const STATUS_ICONS: Record<string, string> = {
  done: chalk.green("[done]"),
  running: chalk.cyan("[running]"),
  pending: chalk.dim("[pending]"),
  blocked: chalk.yellow("[blocked]"),
  failed: chalk.red("[failed]"),
};

export function info(msg: string): void {
  console.log(chalk.cyan("  info") + "  " + msg);
}

export function success(msg: string): void {
  console.log(chalk.green("  " + String.fromCharCode(10003)) + "  " + msg);
}

export function warn(msg: string): void {
  console.error(chalk.yellow("  warn") + "  " + msg);
}

export function error(msg: string): void {
  console.error(chalk.red("  " + String.fromCharCode(10007)) + "  " + msg);
}

export function debug(msg: string): void {
  if (isDebug) {
    console.log(chalk.dim("  debug  " + msg));
  }
}

export function header(title: string): void {
  const line = chalk.hex("#4361EE")("=".repeat(Math.max(40, title.length + 4)));
  console.log();
  console.log(line);
  console.log(chalk.bold.hex("#4361EE")("  " + title));
  console.log(line);
  console.log();
}

export function table(rows: [string, string][]): void {
  if (rows.length === 0) return;
  const maxKeyLen = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    const paddedKey = key.padEnd(maxKeyLen);
    console.log("  " + chalk.dim(paddedKey) + "  " + value);
  }
}

export function progress(
  status: string,
  taskName: string,
  detail: string,
): void {
  const icon = STATUS_ICONS[status] ?? chalk.dim("[" + status + "]");
  console.log(icon + "  " + chalk.bold(taskName) + chalk.dim("  " + detail));
}

export function banner(): void {
  console.log();
  console.log(
    chalk.hex("#4361EE").bold("  KOVA") +
      chalk.hex("#C0C0C8")("  |  AI dev tool cost tracker"),
  );
  console.log(chalk.dim("  Know what your AI tools actually cost."));
  console.log();
}

export function updateBanner(
  currentVersion: string,
  latestVersion: string,
): void {
  console.log();
  console.log(
    chalk.yellow(`  Update available: ${currentVersion} -> ${latestVersion}`),
  );
  console.log(chalk.dim("  Run: npm install -g kova-cli"));
  console.log();
}

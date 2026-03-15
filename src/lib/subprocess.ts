import { ExecaError, execa } from "execa";

interface InvokeClaudeArgs {
  command: string;
  prompt?: string;
  cwd: string;
  timeout?: number;
}

interface InvokeClaudeResult {
  stdout: string;
  exitCode: number;
}

export async function invokeClaude(
  args: InvokeClaudeArgs,
): Promise<InvokeClaudeResult> {
  const { command, prompt, cwd, timeout = 300000 } = args;
  const isWindows = process.platform === "win32";

  const cliArgs: string[] = [command];
  if (prompt) {
    cliArgs.push("--print", prompt);
  }

  try {
    const result = await execa("claude", cliArgs, {
      cwd,
      timeout,
      reject: false,
      shell: isWindows,
    });

    return {
      stdout: result.stdout,
      exitCode: result.exitCode ?? 0,
    };
  } catch (err) {
    if (err instanceof ExecaError) {
      if (err.timedOut) {
        throw new Error(
          `Claude CLI timed out after ${timeout}ms. Try increasing the timeout or simplifying the prompt.`,
        );
      }
      if (err.isCanceled) {
        throw new Error("Claude CLI process was cancelled.");
      }
      // Process error -- return non-zero exit code with any output
      return {
        stdout: err.stdout ?? "",
        exitCode: err.exitCode ?? 1,
      };
    }
    if (err instanceof Error) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new Error(
          "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code",
        );
      }
      if (nodeErr.code === "EACCES" || nodeErr.code === "EPERM") {
        throw new Error(
          "Permission denied running Claude CLI. Check file permissions or try running as administrator.",
        );
      }
    }
    throw err;
  }
}

export async function isClaudeInstalled(): Promise<boolean> {
  const isWindows = process.platform === "win32";
  try {
    await execa("claude", ["--version"], { timeout: 10000, shell: isWindows });
    return true;
  } catch {
    return false;
  }
}

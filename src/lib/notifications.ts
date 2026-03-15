import type {
  CheckpointFile,
  NotificationConfig,
  WebhookPayload,
} from "../types.js";
import * as logger from "./logger.js";

export function buildWebhookPayload(
  checkpoint: CheckpointFile,
  event: "build_start" | "build_complete" | "build_fail",
  startedAt: number,
): WebhookPayload {
  const taskEntries = Object.entries(checkpoint.tasks);
  const completed = taskEntries.filter(
    ([, t]) => t.status === "completed",
  ).length;
  const failed = taskEntries.filter(([, t]) => t.status === "failed").length;
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

  // Count models used
  const modelsUsed: Record<string, number> = {};
  for (const [, task] of taskEntries) {
    const model = task.model ?? "unknown";
    modelsUsed[model] = (modelsUsed[model] ?? 0) + 1;
  }

  return {
    event,
    plan: checkpoint.plan,
    status: checkpoint.status,
    tasks_total: taskEntries.length,
    tasks_completed: completed,
    tasks_failed: failed,
    duration_seconds: durationSeconds,
    models_used: modelsUsed,
    timestamp: new Date().toISOString(),
  };
}

async function sendDiscord(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  try {
    const statusEmoji =
      payload.event === "build_complete"
        ? "OK"
        : payload.event === "build_fail"
          ? "FAIL"
          : "START";
    const description = [
      `**Plan**: ${payload.plan}`,
      `**Status**: ${statusEmoji} ${payload.status}`,
      `**Tasks**: ${payload.tasks_completed}/${payload.tasks_total} completed, ${payload.tasks_failed} failed`,
      `**Duration**: ${payload.duration_seconds}s`,
      `**Models**: ${Object.entries(payload.models_used)
        .map(([m, c]) => `${m}(${c})`)
        .join(", ")}`,
    ].join("\n");

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Kova",
        content: `**[${payload.event}]** ${payload.plan}\n${description}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.warn(
      `Discord webhook failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

async function sendSlack(url: string, payload: WebhookPayload): Promise<void> {
  try {
    const statusIcon =
      payload.event === "build_complete"
        ? ":white_check_mark:"
        : payload.event === "build_fail"
          ? ":x:"
          : ":arrow_forward:";

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${statusIcon} *Kova ${payload.event}*: ${payload.plan}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${statusIcon} *Kova ${payload.event}*\n*Plan*: ${payload.plan}\n*Tasks*: ${payload.tasks_completed}/${payload.tasks_total} completed\n*Duration*: ${payload.duration_seconds}s`,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.warn(
      `Slack webhook failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

async function sendCustom(url: string, payload: WebhookPayload): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.warn(
      `Custom webhook failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

export async function sendNotification(
  config: NotificationConfig,
  payload: WebhookPayload,
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (config.discord) {
    promises.push(sendDiscord(config.discord, payload));
  }
  if (config.slack) {
    promises.push(sendSlack(config.slack, payload));
  }
  if (config.custom) {
    promises.push(sendCustom(config.custom, payload));
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

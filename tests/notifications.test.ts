import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWebhookPayload,
  sendNotification,
} from "../src/lib/notifications.js";
import type { CheckpointFile, NotificationConfig } from "../src/types.js";

function makeCheckpoint(
  overrides: Partial<CheckpointFile> = {},
): CheckpointFile {
  return {
    plan: "my-plan.md",
    started_at: new Date().toISOString(),
    status: "in_progress",
    tasks: {},
    token_usage: null,
    validation: null,
    ...overrides,
  };
}

describe("buildWebhookPayload", () => {
  it("constructs correct payload from checkpoint with mixed task statuses", () => {
    const checkpoint = makeCheckpoint({
      plan: "test-plan.md",
      status: "completed",
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-2": {
          status: "completed",
          agent_type: "backend-engineer",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-3": {
          status: "failed",
          agent_type: "quality-engineer",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-4": {
          status: "pending",
          agent_type: "frontend-specialist",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-5": {
          status: "in_progress",
          agent_type: "backend-engineer",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
      },
    });

    const startedAt = Date.now() - 5000;
    const payload = buildWebhookPayload(
      checkpoint,
      "build_complete",
      startedAt,
    );

    expect(payload.event).toBe("build_complete");
    expect(payload.plan).toBe("test-plan.md");
    expect(payload.status).toBe("completed");
    expect(payload.tasks_total).toBe(5);
    expect(payload.tasks_completed).toBe(2);
    expect(payload.tasks_failed).toBe(1);
    expect(payload.duration_seconds).toBeGreaterThanOrEqual(4);
    expect(payload.duration_seconds).toBeLessThanOrEqual(10);
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("counts models_used correctly", () => {
    const checkpoint = makeCheckpoint({
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-2": {
          status: "completed",
          agent_type: "backend-engineer",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-3": {
          status: "completed",
          agent_type: "quality-engineer",
          model: "sonnet",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-4": {
          status: "pending",
          agent_type: "frontend-specialist",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
        "task-5": {
          status: "pending",
          agent_type: "backend-engineer",
          model: "haiku",
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
      },
    });

    const payload = buildWebhookPayload(
      checkpoint,
      "build_complete",
      Date.now(),
    );

    expect(payload.models_used["sonnet"]).toBe(3);
    expect(payload.models_used["haiku"]).toBe(2);
  });

  it("counts models_used as unknown when model is null", () => {
    const checkpoint = makeCheckpoint({
      tasks: {
        "task-1": {
          status: "completed",
          agent_type: "frontend-specialist",
          model: null,
          agent_id: null,
          started_at: null,
          completed_at: null,
          duration_s: null,
          tokens: null,
        },
      },
    });

    const payload = buildWebhookPayload(checkpoint, "build_start", Date.now());
    expect(payload.models_used["unknown"]).toBe(1);
  });

  it("returns zero tasks_total and zero counts for empty tasks", () => {
    const checkpoint = makeCheckpoint({ tasks: {} });
    const payload = buildWebhookPayload(checkpoint, "build_start", Date.now());

    expect(payload.tasks_total).toBe(0);
    expect(payload.tasks_completed).toBe(0);
    expect(payload.tasks_failed).toBe(0);
  });
});

describe("sendNotification", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makePayload() {
    return buildWebhookPayload(makeCheckpoint(), "build_complete", Date.now());
  }

  it("calls fetch for Discord URL", async () => {
    const config: NotificationConfig = {
      discord: "https://discord.com/api/webhooks/test",
      slack: null,
      custom: null,
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls fetch for Slack URL", async () => {
    const config: NotificationConfig = {
      discord: null,
      slack: "https://hooks.slack.com/services/test",
      custom: null,
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/test",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls fetch for custom URL", async () => {
    const config: NotificationConfig = {
      discord: null,
      slack: null,
      custom: "https://my-webhook.example.com/notify",
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://my-webhook.example.com/notify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls all configured webhooks when discord + slack + custom are set", async () => {
    const config: NotificationConfig = {
      discord: "https://discord.com/api/webhooks/test",
      slack: "https://hooks.slack.com/services/test",
      custom: "https://my-webhook.example.com/notify",
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it("skips null URLs and only calls fetch for non-null ones", async () => {
    const config: NotificationConfig = {
      discord: null,
      slack: "https://hooks.slack.com/services/test",
      custom: null,
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/test",
      expect.anything(),
    );
  });

  it("does NOT throw when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const config: NotificationConfig = {
      discord: "https://discord.com/api/webhooks/test",
      slack: null,
      custom: null,
    };

    await expect(
      sendNotification(config, makePayload()),
    ).resolves.toBeUndefined();
  });

  it("does nothing when all URLs are null", async () => {
    const config: NotificationConfig = {
      discord: null,
      slack: null,
      custom: null,
    };

    await sendNotification(config, makePayload());

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("sends correct JSON body to Discord with event info", async () => {
    const config: NotificationConfig = {
      discord: "https://discord.com/api/webhooks/test",
      slack: null,
      custom: null,
    };
    const payload = buildWebhookPayload(
      makeCheckpoint({ plan: "build-plan.md" }),
      "build_complete",
      Date.now(),
    );

    await sendNotification(config, payload);

    const callArgs = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(callArgs[1]!.body as string) as Record<
      string,
      unknown
    >;
    expect(body.username).toBe("Kova");
    expect(typeof body.content).toBe("string");
    expect(body.content as string).toContain("build_complete");
  });

  it("sends raw payload JSON to custom webhook", async () => {
    const config: NotificationConfig = {
      discord: null,
      slack: null,
      custom: "https://my-webhook.example.com/notify",
    };
    const payload = makePayload();

    await sendNotification(config, payload);

    const callArgs = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(callArgs[1]!.body as string) as typeof payload;
    expect(body.event).toBe(payload.event);
    expect(body.plan).toBe(payload.plan);
    expect(body.tasks_total).toBe(payload.tasks_total);
  });
});

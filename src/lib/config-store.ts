import fs from "fs";
import path from "path";
import type {
  AiTool,
  KovaFinOpsConfig,
  OrchestrationConfig,
} from "../types.js";
import { CONFIG_FILE, KOVA_DATA_DIR } from "./constants.js";

export interface CostCenter {
  id: string;
  name: string;
  projects: string[];
}

export interface KovaFinOpsConfigExtended extends KovaFinOpsConfig {
  proxy?: {
    http_proxy?: string;
    https_proxy?: string;
    ca_cert_path?: string;
  };
  sso?: {
    enabled: boolean;
    issuer?: string;
    token?: string;
    token_expires_at?: string;
  };
  cost_centers?: CostCenter[];
  orchestration?: OrchestrationConfig;
}

export function getConfigPath(): string {
  return path.join(KOVA_DATA_DIR, CONFIG_FILE);
}

export function getDefaultConfig(): KovaFinOpsConfigExtended {
  return {
    budget: {
      monthly_usd: null,
      daily_usd: null,
      warn_at_percent: 80,
    },
    tracking: {
      tools: [
        "claude_code",
        "cursor",
        "copilot",
        "windsurf",
        "devin",
      ] as AiTool[],
      auto_sync: false,
      scan_interval_minutes: 60,
    },
    display: {
      currency: "usd",
      show_tokens: true,
      show_model_breakdown: true,
    },
  };
}

export function readConfig(): KovaFinOpsConfigExtended {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as KovaFinOpsConfigExtended;
  } catch {
    return getDefaultConfig();
  }
}

export function writeConfig(config: KovaFinOpsConfigExtended): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function updateConfig(partial: Partial<KovaFinOpsConfigExtended>): void {
  const current = readConfig();

  const merged: KovaFinOpsConfigExtended = {
    budget: {
      ...current.budget,
      ...(partial.budget ?? {}),
    },
    tracking: {
      ...current.tracking,
      ...(partial.tracking ?? {}),
    },
    display: {
      ...current.display,
      ...(partial.display ?? {}),
    },
    proxy: partial.proxy !== undefined ? partial.proxy : current.proxy,
    sso:
      partial.sso !== undefined
        ? { ...current.sso, ...partial.sso }
        : current.sso,
    cost_centers:
      partial.cost_centers !== undefined
        ? partial.cost_centers
        : current.cost_centers,
    orchestration:
      partial.orchestration !== undefined
        ? {
            ...current.orchestration,
            ...partial.orchestration,
            routing: {
              ...(current.orchestration?.routing ?? {}),
              ...(partial.orchestration?.routing ?? {}),
            },
          }
        : current.orchestration,
  };

  // Strip undefined optional sections to keep config clean
  if (merged.proxy === undefined) delete merged.proxy;
  if (merged.sso === undefined) delete merged.sso;
  if (merged.cost_centers === undefined) delete merged.cost_centers;
  if (merged.orchestration === undefined) delete merged.orchestration;

  writeConfig(merged);
}

/** Read cost centers from config, returning an empty array if none configured. */
export function readCostCenters(): CostCenter[] {
  return readConfig().cost_centers ?? [];
}

/** Persist an updated cost centers list back to config. */
export function writeCostCenters(centers: CostCenter[]): void {
  const current = readConfig();
  writeConfig({ ...current, cost_centers: centers });
}

/** Find the cost center that contains the given project name. */
export function findCostCenterForProject(
  project: string,
): CostCenter | undefined {
  return readCostCenters().find((cc) => cc.projects.includes(project));
}

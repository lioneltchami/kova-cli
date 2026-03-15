import { cosmiconfig } from "cosmiconfig";
import fs from "fs";
import path from "path";
import yaml from "yaml";
import type { DetectedProject, KovaConfig } from "../types.js";
import { DEFAULT_CONFIG, KOVA_CONFIG_FILE } from "./constants.js";

export async function loadConfig(
  projectDir: string,
): Promise<KovaConfig | null> {
  const explorer = cosmiconfig("kova", {
    searchPlaces: ["kova.yaml"],
    loaders: {
      ".yaml": (_filepath: string, content: string) =>
        yaml.parse(content) as KovaConfig,
    },
  });

  try {
    const result = await explorer.search(projectDir);
    if (!result || result.isEmpty) return null;
    return result.config as KovaConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(
  projectDir: string,
  config: KovaConfig,
): Promise<void> {
  const configPath = path.join(projectDir, KOVA_CONFIG_FILE);
  const header =
    "# Kova CLI configuration\n# https://github.com/kova-cli/kova\n\n";
  const content = header + yaml.stringify(config);
  fs.writeFileSync(configPath, content, "utf-8");
}

export function generateConfig(detected: DetectedProject): KovaConfig {
  const config: KovaConfig = {
    ...DEFAULT_CONFIG,
    project: {
      ...DEFAULT_CONFIG.project,
      name: path.basename(process.cwd()),
      language: detected.language ?? DEFAULT_CONFIG.project.language,
      framework: detected.framework ?? DEFAULT_CONFIG.project.framework,
      package_manager:
        detected.packageManager ?? DEFAULT_CONFIG.project.package_manager,
    },
    quality: {
      ...DEFAULT_CONFIG.quality,
      test: detected.commands.test,
      lint: detected.commands.lint,
      typecheck: detected.commands.typecheck,
      build: detected.commands.build,
    },
  };
  return config;
}

// Using unknown as the recursive leaf to avoid circular type alias error
type ConfigNode = Record<string, unknown>;

function parseValue(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNum = Number(raw);
  if (!isNaN(asNum) && raw.trim() !== "") return asNum;
  return raw;
}

export async function setConfigValue(
  projectDir: string,
  key: string,
  value: string,
): Promise<void> {
  const config = await loadConfig(projectDir);
  if (!config) throw new Error("No kova.yaml found. Run `kova init` first.");

  const parts = key.split(".");
  // Walk the config object to set the nested value
  let current: ConfigNode = config as unknown as ConfigNode;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) break;
    if (
      !(part in current) ||
      typeof current[part] !== "object" ||
      current[part] === null
    ) {
      current[part] = {} as ConfigNode;
    }
    current = current[part] as ConfigNode;
  }

  const lastKey = parts[parts.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = parseValue(value);
  }

  await saveConfig(projectDir, config);
}

export async function addRule(projectDir: string, rule: string): Promise<void> {
  const config = await loadConfig(projectDir);
  if (!config) throw new Error("No kova.yaml found. Run `kova init` first.");
  config.rules.push(rule);
  await saveConfig(projectDir, config);
}

export async function addBoundary(
  projectDir: string,
  boundary: string,
): Promise<void> {
  const config = await loadConfig(projectDir);
  if (!config) throw new Error("No kova.yaml found. Run `kova init` first.");
  config.boundaries.never_touch.push(boundary);
  await saveConfig(projectDir, config);
}

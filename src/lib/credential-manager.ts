import fs from "fs";
import path from "path";
import type {
  AiProvider,
  AiTool,
  ProviderCredentials,
  ToolCredentials,
} from "../types.js";
import { KOVA_DATA_DIR } from "./constants.js";

const TOOL_CREDENTIALS_FILE = "tool-credentials.json";

export function getToolCredentialsPath(): string {
  return path.join(KOVA_DATA_DIR, TOOL_CREDENTIALS_FILE);
}

export function readToolCredentials(): ToolCredentials {
  try {
    const raw = fs.readFileSync(getToolCredentialsPath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ToolCredentials;
  } catch {
    return {};
  }
}

export function writeToolCredentials(creds: ToolCredentials): void {
  const dir = path.dirname(getToolCredentialsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getToolCredentialsPath(), JSON.stringify(creds, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function getToolKey(tool: AiTool): string | null {
  const creds = readToolCredentials();
  return creds[tool] ?? null;
}

export function setToolKey(tool: AiTool, key: string): void {
  const creds = readToolCredentials();
  creds[tool] = key;
  writeToolCredentials(creds);
}

export function removeToolKey(tool: AiTool): void {
  const creds = readToolCredentials();
  delete creds[tool];
  writeToolCredentials(creds);
}

export function listConfiguredTools(): AiTool[] {
  const creds = readToolCredentials();
  return Object.keys(creds).filter(
    (k) => creds[k as AiTool] !== undefined && creds[k as AiTool] !== "",
  ) as AiTool[];
}

// Provider API key storage (separate file from tool credentials)
const PROVIDER_CREDENTIALS_FILE = "provider-keys.json";

export function getProviderCredentialsPath(): string {
  return path.join(KOVA_DATA_DIR, PROVIDER_CREDENTIALS_FILE);
}

export function readProviderCredentials(): ProviderCredentials {
  try {
    const raw = fs.readFileSync(getProviderCredentialsPath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ProviderCredentials;
  } catch {
    return {};
  }
}

export function writeProviderCredentials(creds: ProviderCredentials): void {
  const dir = path.dirname(getProviderCredentialsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getProviderCredentialsPath(),
    JSON.stringify(creds, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

export function getProviderKey(provider: AiProvider): string | null {
  const creds = readProviderCredentials();
  return creds[provider] ?? null;
}

export function setProviderKey(provider: AiProvider, key: string): void {
  const creds = readProviderCredentials();
  creds[provider] = key;
  writeProviderCredentials(creds);
}

export function removeProviderKey(provider: AiProvider): void {
  const creds = readProviderCredentials();
  delete creds[provider];
  writeProviderCredentials(creds);
}

export function listConfiguredProviders(): AiProvider[] {
  const creds = readProviderCredentials();
  return (Object.keys(creds) as AiProvider[]).filter(
    (k) => creds[k] !== undefined && creds[k] !== "",
  );
}

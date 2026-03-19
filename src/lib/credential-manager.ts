import fs from "fs";
import path from "path";
import type { AiTool, ToolCredentials } from "../types.js";
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

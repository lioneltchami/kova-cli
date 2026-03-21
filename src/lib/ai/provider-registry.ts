import { createProviderRegistry } from "ai";
import type { ProviderCredentials } from "../../types.js";

export async function createKovaRegistry(credentials: ProviderCredentials) {
  const providers: Record<string, any> = {};

  if (credentials.anthropic) {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    providers.anthropic = createAnthropic({ apiKey: credentials.anthropic });
  }

  if (credentials.openai) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    providers.openai = createOpenAI({ apiKey: credentials.openai });
  }

  if (credentials.google) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    providers.google = createGoogleGenerativeAI({ apiKey: credentials.google });
  }

  if (credentials.openrouter) {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    providers.openrouter = createOpenRouter({ apiKey: credentials.openrouter });
  }

  if (Object.keys(providers).length === 0) {
    return null;
  }

  return createProviderRegistry(providers);
}

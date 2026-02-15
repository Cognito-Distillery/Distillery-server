import type { AISettings, EmbeddingProvider, ChatProvider } from "./types";
import { getAISettingsFromDB } from "./settings-service";
import { createOpenAIEmbeddingProvider, createOpenAIChatProvider } from "./openai";
import { createGoogleChatProvider } from "./google";

const CACHE_TTL_MS = 60_000;

let cachedSettings: AISettings | null = null;
let cacheTimestamp = 0;

async function getAISettings(): Promise<AISettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  cachedSettings = await getAISettingsFromDB();
  cacheTimestamp = Date.now();
  return cachedSettings;
}

export function invalidateAISettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

let embeddingProvider: EmbeddingProvider | null = null;
let embeddingSettingsKey = "";

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  const settings = await getAISettings();
  const key = settings.embeddingModel;

  if (embeddingProvider && embeddingSettingsKey === key) {
    return embeddingProvider;
  }

  embeddingProvider = createOpenAIEmbeddingProvider(settings.embeddingModel);

  embeddingSettingsKey = key;
  return embeddingProvider;
}

let chatProvider: ChatProvider | null = null;
let chatSettingsKey = "";

export async function getChatProvider(): Promise<{ provider: ChatProvider; model: string }> {
  const settings = await getAISettings();
  const key = `${settings.chatProvider}:${settings.chatModel}`;

  if (chatProvider && chatSettingsKey === key) {
    return { provider: chatProvider, model: settings.chatModel };
  }

  chatProvider =
    settings.chatProvider === "openai"
      ? createOpenAIChatProvider()
      : createGoogleChatProvider();

  chatSettingsKey = key;
  return { provider: chatProvider, model: settings.chatModel };
}

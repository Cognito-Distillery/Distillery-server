import { Elysia } from "elysia";
import { AISettingsBody } from "./schema";
import { getAISettingsFromDB, updateAISettingsInDB } from "./settings-service";
import { invalidateAISettingsCache } from "./index";
import {
  EMBEDDING_MODELS_BY_PROVIDER,
  CHAT_MODELS_BY_PROVIDER,
  type AISettings,
} from "./types";
import { PipelineSettingsBody } from "../pipeline/settings-schema";
import {
  getPipelineSettingsFromDB,
  updatePipelineSettingsInDB,
  invalidatePipelineSettingsCache,
  reschedule,
} from "../pipeline";

export const aiSettingsRoutes = new Elysia({ prefix: "/settings" })
  .get(
    "/ai",
    async () => {
      const settings = await getAISettingsFromDB();

      return {
        ...settings,
        availableModels: {
          embedding: EMBEDDING_MODELS_BY_PROVIDER,
          chat: CHAT_MODELS_BY_PROVIDER,
        },
      };
    },
    {
      detail: { tags: ["Settings"], summary: "AI 설정 조회" },
    }
  )

  .put(
    "/ai",
    async ({ body, set }) => {
      const current = await getAISettingsFromDB();
      const merged: AISettings = { ...current, ...body };

      const validEmbeddingModels = EMBEDDING_MODELS_BY_PROVIDER.openai;
      if (!validEmbeddingModels.includes(merged.embeddingModel)) {
        set.status = 400;
        return {
          error: `Model "${merged.embeddingModel}" is not available for embedding. Valid models: ${validEmbeddingModels.join(", ")}`,
        };
      }

      const validChatModels = CHAT_MODELS_BY_PROVIDER[merged.chatProvider];
      if (!validChatModels.includes(merged.chatModel)) {
        set.status = 400;
        return {
          error: `Model "${merged.chatModel}" is not available for provider "${merged.chatProvider}". Valid models: ${validChatModels.join(", ")}`,
        };
      }

      const updated = await updateAISettingsInDB(body as Partial<AISettings>);
      invalidateAISettingsCache();

      return updated;
    },
    {
      body: AISettingsBody,
      detail: { tags: ["Settings"], summary: "AI 설정 수정" },
    }
  )

  .get(
    "/pipeline",
    async () => {
      return getPipelineSettingsFromDB();
    },
    {
      detail: { tags: ["Settings"], summary: "파이프라인 설정 조회" },
    }
  )

  .put(
    "/pipeline",
    async ({ body }) => {
      const updated = await updatePipelineSettingsInDB(body);
      invalidatePipelineSettingsCache();
      await reschedule();
      return updated;
    },
    {
      body: PipelineSettingsBody,
      detail: { tags: ["Settings"], summary: "파이프라인 설정 수정" },
    }
  );

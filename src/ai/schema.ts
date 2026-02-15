import { t } from "elysia";

const EmbeddingModelSchema = t.Union([
  t.Literal("text-embedding-3-small"),
  t.Literal("text-embedding-3-large"),
]);

const ChatModelSchema = t.Union([
  t.Literal("gpt-4o-mini"),
  t.Literal("gpt-4o"),
  t.Literal("gpt-4.1-mini"),
  t.Literal("gemini-2.0-flash"),
  t.Literal("gemini-2.5-flash"),
]);

const AIProviderSchema = t.Union([t.Literal("openai"), t.Literal("google")]);

export const AISettingsBody = t.Object({
  embeddingModel: t.Optional(EmbeddingModelSchema),
  chatProvider: t.Optional(AIProviderSchema),
  chatModel: t.Optional(ChatModelSchema),
});

import { t } from "elysia";

export const PipelineSettingsBody = t.Object({
  intervalMinutes: t.Optional(t.Number({ minimum: 5, maximum: 60 })),
  similarityThreshold: t.Optional(t.Number({ minimum: 0.1, maximum: 1.0 })),
  topK: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
});

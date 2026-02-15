import { eq } from "drizzle-orm";
import { db } from "../db";
import { aiSettings } from "../db/schema";
import type { AISettings } from "./types";

const DEFAULTS: AISettings = {
  embeddingModel: "text-embedding-3-small",
  chatProvider: "openai",
  chatModel: "gpt-4o-mini",
};

export async function getAISettingsFromDB(): Promise<AISettings> {
  const row = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.singletonKey, "default"))
    .then((rows) => rows[0]);

  if (!row) return { ...DEFAULTS };

  return {
    embeddingModel: row.embeddingModel as AISettings["embeddingModel"],
    chatProvider: row.chatProvider as AISettings["chatProvider"],
    chatModel: row.chatModel as AISettings["chatModel"],
  };
}

export async function updateAISettingsInDB(
  partial: Partial<AISettings>
): Promise<AISettings> {
  const values = {
    ...partial,
    updatedAt: new Date(),
  };

  await db
    .insert(aiSettings)
    .values({ singletonKey: "default", ...values })
    .onConflictDoUpdate({
      target: aiSettings.singletonKey,
      set: values,
    });

  return getAISettingsFromDB();
}

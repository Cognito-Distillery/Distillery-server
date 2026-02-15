import { eq } from "drizzle-orm";
import { db } from "../db";
import { pipelineSettings } from "../db/schema";

export type PipelineSettings = {
  intervalMinutes: number;
  similarityThreshold: number;
  topK: number;
};

const DEFAULTS: PipelineSettings = {
  intervalMinutes: 30,
  similarityThreshold: 0.75,
  topK: 5,
};

export async function getPipelineSettingsFromDB(): Promise<PipelineSettings> {
  const row = await db
    .select()
    .from(pipelineSettings)
    .where(eq(pipelineSettings.singletonKey, "default"))
    .then((rows) => rows[0]);

  if (!row) return { ...DEFAULTS };

  return {
    intervalMinutes: row.intervalMinutes,
    similarityThreshold: row.similarityThreshold,
    topK: row.topK,
  };
}

export async function updatePipelineSettingsInDB(
  partial: Partial<PipelineSettings>
): Promise<PipelineSettings> {
  const values = {
    ...partial,
    updatedAt: new Date(),
  };

  await db
    .insert(pipelineSettings)
    .values({ singletonKey: "default", ...values })
    .onConflictDoUpdate({
      target: pipelineSettings.singletonKey,
      set: values,
    });

  return getPipelineSettingsFromDB();
}

import { eq } from "drizzle-orm";
import { db } from "../db";
import { malts } from "../db/schema";
import { driver } from "../graph";
import { distillMalts } from "../distill";
import { caskMalts } from "../cask";
import { getProgress, setRunning, setIdle } from "./progress";
import { logger } from "../logger";

/** Neo4j에서 source='ai'인 모든 엣지 삭제 */
export async function deleteAIEdges(): Promise<number> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH ()-[r]->() WHERE r.source = 'ai'
       DELETE r RETURN count(r) AS deleted`
    );
    return result.records[0]?.get("deleted")?.toNumber?.() ?? 0;
  } finally {
    await session.close();
  }
}

/** 전체 재임베딩: CASKED → DISTILLED_READY + embedding NULL (관계는 유지) */
export async function reEmbed(): Promise<{ affected: number }> {
  const result = await db
    .update(malts)
    .set({ status: "DISTILLED_READY", embedding: null })
    .where(eq(malts.status, "CASKED"))
    .returning({ id: malts.id });

  const affected = result.length;

  logger.info({ affected }, "Re-embed: reset complete");
  return { affected };
}

/** 관계 재추출: CASKED → DISTILLED (임베딩 유지) + AI 엣지 삭제 */
export async function reExtract(): Promise<{ affected: number; aiEdgesDeleted: number }> {
  const result = await db
    .update(malts)
    .set({ status: "DISTILLED" })
    .where(eq(malts.status, "CASKED"))
    .returning({ id: malts.id });

  const affected = result.length;
  const aiEdgesDeleted = await deleteAIEdges();

  logger.info({ affected, aiEdgesDeleted }, "Re-extract: reset complete");
  return { affected, aiEdgesDeleted };
}

export async function runPipeline(): Promise<{ skipped: boolean; distilled?: number; casked?: number }> {
  if (getProgress().status === "running") {
    logger.info("Pipeline already running, skipping");
    return { skipped: true };
  }

  try {
    setRunning("distill");
    const distillResult = await distillMalts();

    setRunning("cask");
    const caskResult = await caskMalts();

    const result = { distilled: distillResult.distilled, casked: caskResult.casked };
    setIdle(result);

    return { skipped: false, ...result };
  } catch (err) {
    setIdle({ distilled: 0, casked: 0 });
    logger.error({ err }, "Pipeline run failed");
    throw err;
  }
}

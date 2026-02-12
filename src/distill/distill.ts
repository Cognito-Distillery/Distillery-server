import { eq } from "drizzle-orm";
import { db } from "../db";
import { malts } from "../db/schema";
import { generateEmbeddings } from "./embedding";
import { logger } from "../logger";

export async function distillMalts() {
  const readyMalts = await db
    .select({ id: malts.id, summary: malts.summary })
    .from(malts)
    .where(eq(malts.status, "DISTILLED_READY"));

  if (readyMalts.length === 0) {
    logger.info("No malts to distill");
    return { distilled: 0 };
  }

  logger.info({ count: readyMalts.length }, "Distilling malts");

  const summaries = readyMalts.map((m) => m.summary);
  const embeddings = await generateEmbeddings(summaries);

  let distilled = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < readyMalts.length; i++) {
      await tx
        .update(malts)
        .set({
          status: "DISTILLED",
          embedding: embeddings[i],
        })
        .where(eq(malts.id, readyMalts[i].id));
      distilled++;
    }
  });

  logger.info({ distilled }, "Distillation complete");
  return { distilled };
}

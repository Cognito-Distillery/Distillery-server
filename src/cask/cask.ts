import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { malts } from "../db/schema";
import { runQuery } from "../graph";
import { RelationType, edgeCypher } from "../graph/schema";
import { findSimilarCasked, findSimilarInBatch, type SimilarPair } from "../db/similarity";
import { extractRelations, type RelationCandidate } from "./relationship";
import { logger } from "../logger";

type DistilledMalt = {
  id: string;
  type: string;
  summary: string;
  context: string;
  memo: string;
  embedding: number[] | null;
};

export async function caskMalts() {
  // DISTILLED 몰트 조회
  const distilledMalts = await db
    .select({
      id: malts.id,
      type: malts.type,
      summary: malts.summary,
      context: malts.context,
      memo: malts.memo,
      embedding: malts.embedding,
    })
    .from(malts)
    .where(eq(malts.status, "DISTILLED"));

  if (distilledMalts.length === 0) {
    logger.info("No malts to cask");
    return { casked: 0 };
  }

  logger.info({ count: distilledMalts.length }, "Casking malts");

  // Phase 1: Knowledge 노드 생성
  const nodeCreated = await createKnowledgeNodes(distilledMalts);
  if (nodeCreated.length === 0) {
    logger.warn("No knowledge nodes created, aborting cask");
    return { casked: 0 };
  }

  // Phase 2: 코사인 유사도 검색
  const similarPairs = await findSimilarPairs(nodeCreated);

  // Phase 3: AI 관계 추출
  const relations = await extractRelationsFromPairs(similarPairs, nodeCreated);

  // Phase 4: 관계 엣지 생성
  await createRelationEdges(relations);

  // Phase 5: 상태 업데이트 → CASKED
  const casked = await updateStatus(nodeCreated);

  logger.info({ casked, edges: relations.length }, "Casking complete");
  return { casked };
}

// Phase 1
async function createKnowledgeNodes(
  items: DistilledMalt[]
): Promise<DistilledMalt[]> {
  const created: DistilledMalt[] = [];

  for (const malt of items) {
    try {
      await runQuery(
        `MERGE (k:Knowledge { id: $id })
         SET k.type = $type, k.summary = $summary, k.context = $context, k.memo = $memo`,
        {
          id: malt.id,
          type: malt.type,
          summary: malt.summary,
          context: malt.context,
          memo: malt.memo,
        }
      );
      created.push(malt);
    } catch (err) {
      logger.warn({ err, maltId: malt.id }, "Failed to create knowledge node, skipping");
    }
  }

  logger.info({ created: created.length, total: items.length }, "Phase 1: Knowledge nodes created");
  return created;
}

// Phase 2
async function findSimilarPairs(
  items: DistilledMalt[]
): Promise<SimilarPair[]> {
  const withEmbedding = items.filter(
    (m): m is DistilledMalt & { embedding: number[] } => m.embedding !== null
  );

  if (withEmbedding.length === 0) {
    logger.info("Phase 2: No embeddings available, skipping similarity search");
    return [];
  }

  // 기존 CASKED 몰트 대상 pgvector 검색
  const caskedPairs: SimilarPair[] = [];
  for (const malt of withEmbedding) {
    try {
      const similar = await findSimilarCasked(malt.id, malt.embedding);
      caskedPairs.push(...similar);
    } catch (err) {
      logger.warn({ err, maltId: malt.id }, "pgvector similarity search failed for malt");
    }
  }

  // 배치 내 상호 비교
  const batchPairs = findSimilarInBatch(
    withEmbedding.map((m) => ({ id: m.id, embedding: m.embedding }))
  );

  // 중복 제거 (sourceId-targetId 쌍 기준)
  const seen = new Set<string>();
  const allPairs: SimilarPair[] = [];

  for (const pair of [...caskedPairs, ...batchPairs]) {
    const key = [pair.sourceId, pair.targetId].sort().join(":");
    if (!seen.has(key)) {
      seen.add(key);
      allPairs.push(pair);
    }
  }

  logger.info(
    { casked: caskedPairs.length, batch: batchPairs.length, unique: allPairs.length },
    "Phase 2: Similarity search complete"
  );
  return allPairs;
}

// Phase 3
async function extractRelationsFromPairs(
  pairs: SimilarPair[],
  items: DistilledMalt[]
) {
  if (pairs.length === 0) {
    logger.info("Phase 3: No similar pairs, skipping relation extraction");
    return [];
  }

  const summaryMap = new Map(items.map((m) => [m.id, m.summary]));

  // CASKED 몰트의 summary도 필요 — DB에서 조회
  const missingIds = pairs
    .flatMap((p) => [p.sourceId, p.targetId])
    .filter((id) => !summaryMap.has(id));

  if (missingIds.length > 0) {
    const unique = [...new Set(missingIds)];
    const rows = await db
      .select({ id: malts.id, summary: malts.summary })
      .from(malts)
      .where(inArray(malts.id, unique));
    for (const row of rows) {
      summaryMap.set(row.id, row.summary);
    }
  }

  const candidates: RelationCandidate[] = pairs
    .filter((p) => summaryMap.has(p.sourceId) && summaryMap.has(p.targetId))
    .map((p) => ({
      sourceId: p.sourceId,
      sourceSummary: summaryMap.get(p.sourceId)!,
      targetId: p.targetId,
      targetSummary: summaryMap.get(p.targetId)!,
    }));

  const relations = await extractRelations(candidates);
  logger.info(
    { candidates: candidates.length, extracted: relations.length },
    "Phase 3: Relation extraction complete"
  );
  return relations;
}

// Phase 4
async function createRelationEdges(
  relations: { sourceId: string; targetId: string; relation: RelationType; confidence: number }[]
) {
  if (relations.length === 0) {
    logger.info("Phase 4: No relations to create");
    return;
  }

  let created = 0;
  for (const rel of relations) {
    try {
      await runQuery(
        edgeCypher(rel.relation),
        {
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          confidence: rel.confidence,
        }
      );
      created++;
    } catch (err) {
      logger.warn(
        { err, sourceId: rel.sourceId, targetId: rel.targetId, relation: rel.relation },
        "Failed to create relation edge"
      );
    }
  }

  logger.info({ created, total: relations.length }, "Phase 4: Relation edges created");
}

// Phase 5
async function updateStatus(items: DistilledMalt[]): Promise<number> {
  let casked = 0;
  await db.transaction(async (tx) => {
    for (const malt of items) {
      await tx
        .update(malts)
        .set({ status: "CASKED" })
        .where(eq(malts.id, malt.id));
      casked++;
    }
  });

  logger.info({ casked }, "Phase 5: Status updated to CASKED");
  return casked;
}

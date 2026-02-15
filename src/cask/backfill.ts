import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { malts } from "../db/schema";
import { runQuery } from "../graph";
import { RelationType, edgeCypher } from "../graph/schema";
import { findSimilarCasked, type SimilarPair } from "../db/similarity";
import { extractRelations, type RelationCandidate } from "./relationship";
import { getPipelineSettings } from "../pipeline/settings-cache";
import { logger } from "../logger";

/**
 * 고립 노드 backfill: 엣지가 0개인 CASKED Knowledge 노드를 재평가
 * 주 1회 실행
 */
export async function backfillIsolatedNodes() {
  // 1. Neo4j에서 엣지 0개인 Knowledge 노드 ID 조회
  const isolated = await runQuery<{ id: string }>(
    `MATCH (k:Knowledge)
     WHERE NOT (k)-[]-()
     RETURN k.id AS id`
  );

  if (isolated.length === 0) {
    logger.info("Backfill: No isolated nodes");
    return { evaluated: 0, edges: 0 };
  }

  logger.info({ count: isolated.length }, "Backfill: Found isolated nodes");

  // 2. Postgres에서 해당 몰트 조회 (embedding + summary)
  const isolatedIds = isolated.map((r) => r.id);
  const isolatedMalts = await db
    .select({
      id: malts.id,
      summary: malts.summary,
      embedding: malts.embedding,
    })
    .from(malts)
    .where(inArray(malts.id, isolatedIds));

  const withEmbedding = isolatedMalts.filter(
    (m): m is typeof m & { embedding: number[] } => m.embedding !== null
  );

  if (withEmbedding.length === 0) {
    logger.info("Backfill: No isolated nodes with embeddings");
    return { evaluated: 0, edges: 0 };
  }

  // 3. 유사도 검색 (전체 CASKED 대상)
  const settings = await getPipelineSettings();
  const allPairs: SimilarPair[] = [];
  for (const malt of withEmbedding) {
    try {
      const similar = await findSimilarCasked(malt.id, malt.embedding, settings.topK, settings.similarityThreshold);
      allPairs.push(...similar);
    } catch (err) {
      logger.warn({ err, maltId: malt.id }, "Backfill: similarity search failed");
    }
  }

  if (allPairs.length === 0) {
    logger.info("Backfill: No similar pairs found");
    return { evaluated: withEmbedding.length, edges: 0 };
  }

  // 4. AI 관계 추출
  const summaryMap = new Map(isolatedMalts.map((m) => [m.id, m.summary]));

  // target summary 조회 (CASKED 몰트)
  const missingIds = [
    ...new Set(
      allPairs
        .map((p) => p.targetId)
        .filter((id) => !summaryMap.has(id))
    ),
  ];
  if (missingIds.length > 0) {
    const rows = await db
      .select({ id: malts.id, summary: malts.summary })
      .from(malts)
      .where(inArray(malts.id, missingIds));
    for (const row of rows) {
      summaryMap.set(row.id, row.summary);
    }
  }

  const candidates: RelationCandidate[] = allPairs
    .filter((p) => summaryMap.has(p.sourceId) && summaryMap.has(p.targetId))
    .map((p) => ({
      sourceId: p.sourceId,
      sourceSummary: summaryMap.get(p.sourceId)!,
      targetId: p.targetId,
      targetSummary: summaryMap.get(p.targetId)!,
    }));

  const relations = await extractRelations(candidates);

  // 5. 엣지 생성
  let edges = 0;
  for (const rel of relations) {
    try {
      await runQuery(edgeCypher(rel.relation), {
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        confidence: rel.confidence,
      });
      edges++;
    } catch (err) {
      logger.warn(
        { err, sourceId: rel.sourceId, targetId: rel.targetId },
        "Backfill: failed to create edge"
      );
    }
  }

  logger.info(
    { evaluated: withEmbedding.length, candidates: candidates.length, edges },
    "Backfill complete"
  );
  return { evaluated: withEmbedding.length, edges };
}


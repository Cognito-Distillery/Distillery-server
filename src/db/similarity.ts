import { and, eq, ne, sql, lte } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { db } from ".";
import { malts } from "./schema";

export type SimilarPair = {
  sourceId: string;
  targetId: string;
  similarity: number;
};

/**
 * pgvector 코사인 유사도 검색: CASKED 상태 몰트 대상
 * 전체 maltster 대상 (사일로 방지), top 5, similarity >= 0.75
 */
export async function findSimilarCasked(
  sourceId: string,
  embedding: number[],
  limit = 5
): Promise<SimilarPair[]> {
  const distance = cosineDistance(malts.embedding, embedding);

  const results = await db
    .select({
      id: malts.id,
      distance: sql<number>`${distance}`.as("distance"),
    })
    .from(malts)
    .where(
      and(
        eq(malts.status, "CASKED"),
        ne(malts.id, sourceId),
        lte(distance, 0.25) // cosine distance <= 0.25 = similarity >= 0.75
      )
    )
    .orderBy(sql`${distance}`)
    .limit(limit);

  return results.map((r) => ({
    sourceId,
    targetId: r.id,
    similarity: 1 - r.distance,
  }));
}

/**
 * 인메모리 코사인 유사도 계산: 배치 내 DISTILLED 몰트끼리 상호 비교
 * N*(N-1)/2 쌍, threshold >= 0.75
 */
export function findSimilarInBatch(
  items: { id: string; embedding: number[] }[]
): SimilarPair[] {
  const pairs: SimilarPair[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (sim >= 0.75) {
        pairs.push({
          sourceId: items[i].id,
          targetId: items[j].id,
          similarity: sim,
        });
      }
    }
  }

  return pairs;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

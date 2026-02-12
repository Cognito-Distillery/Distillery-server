import { runQuery } from ".";
import { logger } from "../logger";

export const RelationType = {
  RELATED_TO: "RELATED_TO",
  SUPPORTS: "SUPPORTS",
  CONFLICTS_WITH: "CONFLICTS_WITH",
} as const;

export type RelationType = (typeof RelationType)[keyof typeof RelationType];

export type RelationMeta = {
  source: "ai" | "human";
  confidence: number; // 0.0 ~ 1.0, ai일 때만 의미 있음
};

// 방향 규칙:
// - 문장으로 읽었을 때 자연스러운 방향 (A SUPPORTS B, A CONFLICTS_WITH B)
// - RELATED_TO는 사실상 양방향 — 쿼리 시 -[]- 방향 무시 가능
// - 방향에 집착하지 말 것

export async function initGraphSchema() {
  await runQuery(
    "CREATE CONSTRAINT knowledge_id_unique IF NOT EXISTS FOR (k:Knowledge) REQUIRE k.id IS UNIQUE"
  );
  logger.info("Graph schema initialized");
}

export function edgeCypher(relationType: RelationType): string {
  switch (relationType) {
    case "RELATED_TO":
      return `
        MATCH (a:Knowledge { id: $sourceId })
        MATCH (b:Knowledge { id: $targetId })
        MERGE (a)-[r:RELATED_TO]->(b)
        SET r.source = 'ai', r.confidence = $confidence`;
    case "SUPPORTS":
      return `
        MATCH (a:Knowledge { id: $sourceId })
        MATCH (b:Knowledge { id: $targetId })
        MERGE (a)-[r:SUPPORTS]->(b)
        SET r.source = 'ai', r.confidence = $confidence`;
    case "CONFLICTS_WITH":
      return `
        MATCH (a:Knowledge { id: $sourceId })
        MATCH (b:Knowledge { id: $targetId })
        MERGE (a)-[r:CONFLICTS_WITH]->(b)
        SET r.source = 'ai', r.confidence = $confidence`;
  }
}

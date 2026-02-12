import OpenAI from "openai";
import { RelationType } from "../graph/schema";
import { logger } from "../logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type RelationCandidate = {
  sourceId: string;
  sourceSummary: string;
  targetId: string;
  targetSummary: string;
};

export type ExtractedRelation = {
  sourceId: string;
  targetId: string;
  relation: RelationType;
  confidence: number;
};

type AIResponse = {
  relations: {
    sourceId: string;
    targetId: string;
    relation: string | null;
    confidence: number;
  }[];
};

/**
 * OpenAI gpt-4o-mini로 관계 추출
 * 후보들을 5개씩 배치로 묶어 호출
 */
export async function extractRelations(
  candidates: RelationCandidate[]
): Promise<ExtractedRelation[]> {
  if (candidates.length === 0) return [];

  const batches: RelationCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += 5) {
    batches.push(candidates.slice(i, i + 5));
  }

  const results: ExtractedRelation[] = [];

  for (const batch of batches) {
    try {
      const extracted = await extractBatch(batch);
      results.push(...extracted);
    } catch (err) {
      logger.warn({ err, batchSize: batch.length }, "Relationship extraction batch failed, skipping");
    }
  }

  return results;
}

async function extractBatch(
  batch: RelationCandidate[]
): Promise<ExtractedRelation[]> {
  const pairs = batch.map((c) => ({
    sourceId: c.sourceId,
    sourceSummary: c.sourceSummary,
    targetId: c.targetId,
    targetSummary: c.targetSummary,
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify relationships between knowledge items.

For each pair, determine the relationship type:
- "RELATED_TO": general topical relationship
- "SUPPORTS": source reinforces/extends/provides evidence for target
- "CONFLICTS_WITH": source contradicts or tensions with target
- null: no meaningful relationship

Return JSON: { "relations": [{ "sourceId": string, "targetId": string, "relation": string | null, "confidence": number (0.0-1.0) }] }

Be conservative — only assign a relation when clearly justified. Prefer null over weak RELATED_TO.`,
      },
      {
        role: "user",
        content: JSON.stringify(pairs),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed: AIResponse = JSON.parse(content);

  return parsed.relations
    .filter(
      (r) =>
        r.relation !== null &&
        r.relation in RelationType &&
        r.confidence > 0
    )
    .map((r) => ({
      sourceId: r.sourceId,
      targetId: r.targetId,
      relation: r.relation as RelationType,
      confidence: r.confidence,
    }));
}

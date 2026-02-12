import { driver } from "../graph";
import { RelationType } from "../graph/schema";
import { logger } from "../logger";

type NodeRecord = {
  id: string;
  type: string;
  summary: string;
  context: string;
  memo: string;
};

type EdgeRecord = {
  sourceId: string;
  targetId: string;
  relationType: string;
  source: string;
  confidence: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function toNode(n: Record<string, unknown>): NodeRecord {
  return {
    id: n.id as string,
    type: n.type as string,
    summary: n.summary as string,
    context: n.context as string,
    memo: n.memo as string,
  };
}

function toEdge(r: Record<string, unknown>): EdgeRecord {
  return {
    sourceId: r.sourceId as string,
    targetId: r.targetId as string,
    relationType: r.relationType as string,
    source: r.source as string,
    confidence: r.confidence as number,
    createdAt: r.createdAt ? String(r.createdAt) : null,
    updatedAt: r.updatedAt ? String(r.updatedAt) : null,
  };
}

// --- Graph queries ---

export async function getGraph(filters: {
  relationType?: string;
  source?: string;
  limit?: number;
}) {
  const limit = filters.limit ?? 100;
  const session = driver.session();
  try {
    // 1) 노드 조회 (고립 노드 포함 보장)
    const nodeResult = await session.run(
      `MATCH (k:Knowledge) RETURN k.id AS id, k.type AS type, k.summary AS summary, k.context AS context, k.memo AS memo LIMIT $limit`,
      { limit }
    );
    const nodes = nodeResult.records.map((r) => toNode(r.toObject()));

    // 2) 엣지 별도 조회 (필터 적용)
    const edgeConditions: string[] = [];
    const edgeParams: Record<string, unknown> = {};

    if (filters.relationType) {
      edgeConditions.push(`type(r) = $relationType`);
      edgeParams.relationType = filters.relationType;
    }
    if (filters.source) {
      edgeConditions.push(`r.source = $source`);
      edgeParams.source = filters.source;
    }

    const whereClause =
      edgeConditions.length > 0
        ? `WHERE ${edgeConditions.join(" AND ")}`
        : "";

    const edgeResult = await session.run(
      `MATCH (a:Knowledge)-[r]->(b:Knowledge) ${whereClause}
       RETURN a.id AS sourceId, b.id AS targetId, type(r) AS relationType,
              r.source AS source, r.confidence AS confidence,
              r.createdAt AS createdAt, r.updatedAt AS updatedAt`,
      edgeParams
    );
    const edges = edgeResult.records.map((r) => toEdge(r.toObject()));

    return { nodes, edges };
  } finally {
    await session.close();
  }
}

export async function getNodeWithNeighbors(id: string) {
  const session = driver.session();
  try {
    // 대상 노드 + 1-depth 이웃
    const nodeResult = await session.run(
      `MATCH (k:Knowledge { id: $id })
       OPTIONAL MATCH (k)-[r]-(neighbor:Knowledge)
       WITH k, collect(DISTINCT neighbor) AS neighbors
       RETURN k, neighbors`,
      { id }
    );

    if (nodeResult.records.length === 0) return null;

    const record = nodeResult.records[0];
    const kNode = record.get("k").properties;
    const neighbors = record.get("neighbors") as { properties: Record<string, unknown> }[];

    const nodes = [toNode(kNode), ...neighbors.map((n) => toNode(n.properties))];

    // 관련 엣지
    const edgeResult = await session.run(
      `MATCH (k:Knowledge { id: $id })-[r]-(neighbor:Knowledge)
       RETURN startNode(r).id AS sourceId, endNode(r).id AS targetId,
              type(r) AS relationType, r.source AS source, r.confidence AS confidence,
              r.createdAt AS createdAt, r.updatedAt AS updatedAt`,
      { id }
    );
    const edges = edgeResult.records.map((r) => toEdge(r.toObject()));

    return { nodes, edges };
  } finally {
    await session.close();
  }
}

// depth별 Cypher 분기
const expandCyphers: Record<number, string> = {
  1: `MATCH (k:Knowledge { id: $id })-[r]-(n:Knowledge)
      RETURN k AS center, collect(DISTINCT n) AS neighbors, collect(r) AS rels`,
  2: `MATCH (k:Knowledge { id: $id })-[*1..2]-(n:Knowledge)
      WITH k, collect(DISTINCT n) AS allNodes
      MATCH (a:Knowledge)-[r]-(b:Knowledge)
      WHERE a IN allNodes OR a = k
      AND (b IN allNodes OR b = k)
      RETURN k, allNodes, collect(DISTINCT r) AS rels`,
  3: `MATCH (k:Knowledge { id: $id })-[*1..3]-(n:Knowledge)
      WITH k, collect(DISTINCT n) AS allNodes
      MATCH (a:Knowledge)-[r]-(b:Knowledge)
      WHERE a IN allNodes OR a = k
      AND (b IN allNodes OR b = k)
      RETURN k, allNodes, collect(DISTINCT r) AS rels`,
};

export async function expandNode(id: string, depth: number) {
  const clampedDepth = Math.max(1, Math.min(3, depth));
  const session = driver.session();
  try {
    if (clampedDepth === 1) {
      // depth 1 uses simpler query
      const result = await session.run(expandCyphers[1], { id });
      if (result.records.length === 0) return null;

      const record = result.records[0];
      const center = record.get("center").properties;
      const neighbors = record.get("neighbors") as { properties: Record<string, unknown> }[];
      const rels = record.get("rels") as {
        start: { low: number };
        end: { low: number };
        type: string;
        properties: Record<string, unknown>;
      }[];

      const nodes = [toNode(center), ...neighbors.map((n) => toNode(n.properties))];

      // For depth 1, get edges separately for clean sourceId/targetId
      const edgeResult = await session.run(
        `MATCH (k:Knowledge { id: $id })-[r]-(neighbor:Knowledge)
         RETURN startNode(r).id AS sourceId, endNode(r).id AS targetId,
                type(r) AS relationType, r.source AS source, r.confidence AS confidence,
                r.createdAt AS createdAt, r.updatedAt AS updatedAt`,
        { id }
      );
      const edges = edgeResult.records.map((r) => toEdge(r.toObject()));

      return { nodes, edges };
    }

    // depth 2, 3
    const result = await session.run(expandCyphers[clampedDepth], { id });
    if (result.records.length === 0) return null;

    const record = result.records[0];
    const center = record.get("k").properties;
    const allNodes = record.get("allNodes") as { properties: Record<string, unknown> }[];
    const rels = record.get("rels") as {
      type: string;
      properties: Record<string, unknown>;
    }[];

    const nodes = [toNode(center), ...allNodes.map((n) => toNode(n.properties))];
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Get edges between subgraph nodes
    const edgeResult = await session.run(
      `MATCH (a:Knowledge)-[r]-(b:Knowledge)
       WHERE a.id IN $nodeIds AND b.id IN $nodeIds
       RETURN DISTINCT startNode(r).id AS sourceId, endNode(r).id AS targetId,
              type(r) AS relationType, r.source AS source, r.confidence AS confidence,
              r.createdAt AS createdAt, r.updatedAt AS updatedAt`,
      { nodeIds: [...nodeIds] }
    );
    const edges = edgeResult.records.map((r) => toEdge(r.toObject()));

    return { nodes, edges };
  } finally {
    await session.close();
  }
}

// --- Edge mutations ---

// relationType별 분기 (APOC 미설치, vanilla Cypher)
function createEdgeCypher(relationType: RelationType): string {
  switch (relationType) {
    case "RELATED_TO":
      return `MATCH (a:Knowledge { id: $sourceId })
              MATCH (b:Knowledge { id: $targetId })
              MERGE (a)-[r:RELATED_TO]->(b)
              ON CREATE SET r.source = 'human', r.confidence = 1.0, r.createdAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r) AS relationType,
                     r.source AS source, r.confidence AS confidence, r.createdAt AS createdAt`;
    case "SUPPORTS":
      return `MATCH (a:Knowledge { id: $sourceId })
              MATCH (b:Knowledge { id: $targetId })
              MERGE (a)-[r:SUPPORTS]->(b)
              ON CREATE SET r.source = 'human', r.confidence = 1.0, r.createdAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r) AS relationType,
                     r.source AS source, r.confidence AS confidence, r.createdAt AS createdAt`;
    case "CONFLICTS_WITH":
      return `MATCH (a:Knowledge { id: $sourceId })
              MATCH (b:Knowledge { id: $targetId })
              MERGE (a)-[r:CONFLICTS_WITH]->(b)
              ON CREATE SET r.source = 'human', r.confidence = 1.0, r.createdAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r) AS relationType,
                     r.source AS source, r.confidence AS confidence, r.createdAt AS createdAt`;
  }
}

export async function createEdge(
  sourceId: string,
  targetId: string,
  relationType: RelationType
) {
  const session = driver.session();
  try {
    const result = await session.run(createEdgeCypher(relationType), {
      sourceId,
      targetId,
    });

    if (result.records.length === 0) return null;
    return toEdge(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

// 단일 트랜잭션으로 DELETE → MERGE
function updateEdgeCypher(relationType: RelationType): string {
  switch (relationType) {
    case "RELATED_TO":
      return `MERGE (a)-[r2:RELATED_TO]->(b)
              ON CREATE SET r2.source = 'human', r2.confidence = 1.0, r2.createdAt = datetime(), r2.updatedAt = datetime()
              ON MATCH SET r2.updatedAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r2) AS relationType,
                     r2.source AS source, r2.confidence AS confidence,
                     r2.createdAt AS createdAt, r2.updatedAt AS updatedAt`;
    case "SUPPORTS":
      return `MERGE (a)-[r2:SUPPORTS]->(b)
              ON CREATE SET r2.source = 'human', r2.confidence = 1.0, r2.createdAt = datetime(), r2.updatedAt = datetime()
              ON MATCH SET r2.updatedAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r2) AS relationType,
                     r2.source AS source, r2.confidence AS confidence,
                     r2.createdAt AS createdAt, r2.updatedAt AS updatedAt`;
    case "CONFLICTS_WITH":
      return `MERGE (a)-[r2:CONFLICTS_WITH]->(b)
              ON CREATE SET r2.source = 'human', r2.confidence = 1.0, r2.createdAt = datetime(), r2.updatedAt = datetime()
              ON MATCH SET r2.updatedAt = datetime()
              RETURN a.id AS sourceId, b.id AS targetId, type(r2) AS relationType,
                     r2.source AS source, r2.confidence AS confidence,
                     r2.createdAt AS createdAt, r2.updatedAt AS updatedAt`;
  }
}

export async function updateEdge(
  sourceId: string,
  targetId: string,
  relationType: RelationType
) {
  const session = driver.session();
  try {
    const result = await session.executeWrite(async (tx) => {
      // DELETE existing relationship
      await tx.run(
        `MATCH (a:Knowledge { id: $sourceId })-[r]->(b:Knowledge { id: $targetId }) DELETE r`,
        { sourceId, targetId }
      );

      // MERGE new relationship type
      const cypher = `MATCH (a:Knowledge { id: $sourceId })
                      MATCH (b:Knowledge { id: $targetId })
                      ${updateEdgeCypher(relationType)}`;

      return tx.run(cypher, { sourceId, targetId });
    });

    if (result.records.length === 0) return null;
    return toEdge(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

export async function deleteEdge(sourceId: string, targetId: string) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Knowledge { id: $sourceId })-[r]->(b:Knowledge { id: $targetId })
       DELETE r
       RETURN count(r) AS deleted`,
      { sourceId, targetId }
    );
    const deleted = result.records[0]?.get("deleted")?.toNumber?.() ?? 0;
    return deleted > 0;
  } finally {
    await session.close();
  }
}

// --- Node mutation ---

export async function updateNode(
  id: string,
  fields: { summary?: string; context?: string; memo?: string }
) {
  const setClauses: string[] = [];
  const params: Record<string, unknown> = { id };

  if (fields.summary !== undefined) {
    setClauses.push("k.summary = $summary");
    params.summary = fields.summary;
  }
  if (fields.context !== undefined) {
    setClauses.push("k.context = $context");
    params.context = fields.context;
  }
  if (fields.memo !== undefined) {
    setClauses.push("k.memo = $memo");
    params.memo = fields.memo;
  }

  if (setClauses.length === 0) return null;

  setClauses.push("k.updatedAt = datetime()");

  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (k:Knowledge { id: $id })
       SET ${setClauses.join(", ")}
       RETURN k.id AS id, k.type AS type, k.summary AS summary, k.context AS context, k.memo AS memo, k.updatedAt AS updatedAt`,
      params
    );

    if (result.records.length === 0) return null;

    const r = result.records[0].toObject();
    return {
      id: r.id as string,
      type: r.type as string,
      summary: r.summary as string,
      context: r.context as string,
      memo: r.memo as string,
      updatedAt: String(r.updatedAt),
    };
  } finally {
    await session.close();
  }
}

import { driver } from "../graph";
import { classifyQuery, generateCypher } from "./cypher";
import { generateEmbedding } from "../distill/embedding";
import { findSimilarByEmbedding } from "../db/similarity";
import { logger } from "../logger";
import { Integer } from "neo4j-driver";

type NodeRecord = {
  id: string;
  type: string;
  summary: string;
  context: string;
  memo: string;
  score: number;
};

type GraphNode = {
  id: string;
  type: string;
  summary: string;
  context: string;
  memo: string;
};

type GraphEdge = {
  sourceId: string;
  targetId: string;
  relType: string;
  confidence: number | null;
};

type NaturalSearchResult = {
  queryType: "structural" | "exploratory";
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export async function keywordSearch(query: string, limit: number = 10) {
  const session = driver.session();
  try {
    const result = await session.run(
      `CALL db.index.fulltext.queryNodes("knowledge_text", $query)
       YIELD node, score
       WITH node, score
       LIMIT $limit
       OPTIONAL MATCH (node)-[r]-(m:Knowledge)
       RETURN node.id AS id, node.type AS type, node.summary AS summary,
              node.context AS context, node.memo AS memo, score,
              type(r) AS relType, r.confidence AS confidence,
              startNode(r).id AS sourceId, endNode(r).id AS targetId,
              m.id AS neighborId, m.type AS neighborType,
              m.summary AS neighborSummary, m.context AS neighborContext,
              m.memo AS neighborMemo`,
      { query, limit: Integer.fromNumber(limit) }
    );

    const nodesMap = new Map<string, NodeRecord>();
    const edges: GraphEdge[] = [];

    for (const record of result.records) {
      const obj = record.toObject();

      // Add seed node
      const id = obj.id as string;
      if (id && !nodesMap.has(id)) {
        nodesMap.set(id, {
          id,
          type: (obj.type as string) ?? "",
          summary: (obj.summary as string) ?? "",
          context: (obj.context as string) ?? "",
          memo: (obj.memo as string) ?? "",
          score: obj.score as number,
        });
      }

      // Add neighbor node
      const neighborId = obj.neighborId as string | null;
      if (neighborId && !nodesMap.has(neighborId)) {
        nodesMap.set(neighborId, {
          id: neighborId,
          type: (obj.neighborType as string) ?? "",
          summary: (obj.neighborSummary as string) ?? "",
          context: (obj.neighborContext as string) ?? "",
          memo: (obj.neighborMemo as string) ?? "",
          score: 0,
        });
      }

      // Add edge
      if (obj.relType && obj.sourceId && obj.targetId) {
        const conf = obj.confidence;
        const confValue = conf instanceof Integer
          ? conf.toNumber()
          : typeof conf === "number" ? conf : null;
        edges.push({
          sourceId: obj.sourceId as string,
          targetId: obj.targetId as string,
          relType: obj.relType as string,
          confidence: confValue,
        });
      }
    }

    return { nodes: [...nodesMap.values()], edges };
  } finally {
    await session.close();
  }
}

export async function naturalSearch(
  query: string,
  options?: { threshold?: number; topK?: number }
): Promise<NaturalSearchResult> {
  let queryType: "structural" | "exploratory";

  try {
    const classification = await classifyQuery(query);
    queryType = classification.type;
  } catch (err) {
    logger.warn({ err }, "Query classification failed, falling back to keyword search");
    return keywordFallback(query);
  }

  if (queryType === "structural") {
    return structuralSearch(query);
  }

  return exploratorySearch(query, options);
}

async function structuralSearch(
  query: string
): Promise<NaturalSearchResult> {
  let cypher: string;
  try {
    cypher = await generateCypher(query);
  } catch (err) {
    logger.warn({ err }, "Cypher generation failed, falling back to keyword search");
    return keywordFallback(query);
  }

  const session = driver.session({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(cypher);

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    for (const record of result.records) {
      const keys = record.keys;

      // Extract nodes from fields
      if (keys.includes("id")) {
        const obj = record.toObject();
        const id = obj.id as string;
        if (id && !nodesMap.has(id)) {
          nodesMap.set(id, {
            id,
            type: (obj.type as string) ?? "",
            summary: (obj.summary as string) ?? "",
            context: (obj.context as string) ?? "",
            memo: (obj.memo as string) ?? "",
          });
        }
      }

      // Extract relationship info
      if (keys.includes("relType") && keys.includes("sourceId") && keys.includes("targetId")) {
        const obj = record.toObject();
        const conf = obj.confidence;
        edges.push({
          sourceId: obj.sourceId as string,
          targetId: obj.targetId as string,
          relType: obj.relType as string,
          confidence: typeof conf === "number" ? conf : null,
        });
      }
    }

    return {
      queryType: "structural",
      nodes: [...nodesMap.values()],
      edges,
    };
  } catch (err) {
    logger.warn({ err, cypher }, "Cypher execution failed, falling back to keyword search");
    return keywordFallback(query);
  } finally {
    await session.close();
  }
}

async function exploratorySearch(
  query: string,
  options?: { threshold?: number; topK?: number }
): Promise<NaturalSearchResult> {
  let embedding: number[] | null;
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    logger.warn({ err }, "Embedding generation failed, falling back to keyword search");
    return keywordFallback(query);
  }

  if (!embedding) {
    return keywordFallback(query);
  }

  const topK = options?.topK ?? 5;
  const threshold = options?.threshold ?? 0.75;
  const similar = await findSimilarByEmbedding(embedding, topK, threshold);
  if (similar.length === 0) {
    return keywordFallback(query);
  }

  const seedIds = similar.map((s) => s.id);

  // 1-depth expansion from seed nodes in Neo4j
  const session = driver.session({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `MATCH (n:Knowledge)
       WHERE n.id IN $ids
       OPTIONAL MATCH (n)-[r]-(m:Knowledge)
       RETURN n.id AS id, n.type AS type, n.summary AS summary,
              n.context AS context, n.memo AS memo,
              type(r) AS relType, r.confidence AS confidence,
              startNode(r).id AS sourceId, endNode(r).id AS targetId,
              m.id AS neighborId, m.type AS neighborType,
              m.summary AS neighborSummary, m.context AS neighborContext,
              m.memo AS neighborMemo`,
      { ids: seedIds }
    );

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    for (const record of result.records) {
      const obj = record.toObject();

      // Add seed node
      const id = obj.id as string;
      if (id && !nodesMap.has(id)) {
        nodesMap.set(id, {
          id,
          type: (obj.type as string) ?? "",
          summary: (obj.summary as string) ?? "",
          context: (obj.context as string) ?? "",
          memo: (obj.memo as string) ?? "",
        });
      }

      // Add neighbor node
      const neighborId = obj.neighborId as string | null;
      if (neighborId && !nodesMap.has(neighborId)) {
        nodesMap.set(neighborId, {
          id: neighborId,
          type: (obj.neighborType as string) ?? "",
          summary: (obj.neighborSummary as string) ?? "",
          context: (obj.neighborContext as string) ?? "",
          memo: (obj.neighborMemo as string) ?? "",
        });
      }

      // Add edge
      if (obj.relType && obj.sourceId && obj.targetId) {
        const conf = obj.confidence;
        const confValue = conf instanceof Integer
          ? conf.toNumber()
          : typeof conf === "number" ? conf : null;
        edges.push({
          sourceId: obj.sourceId as string,
          targetId: obj.targetId as string,
          relType: obj.relType as string,
          confidence: confValue,
        });
      }
    }

    return {
      queryType: "exploratory",
      nodes: [...nodesMap.values()],
      edges,
    };
  } finally {
    await session.close();
  }
}

async function keywordFallback(
  query: string
): Promise<NaturalSearchResult> {
  const result = await keywordSearch(query, 10);
  return {
    queryType: "exploratory",
    nodes: result.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      summary: n.summary,
      context: n.context,
      memo: n.memo,
    })),
    edges: result.edges,
  };
}

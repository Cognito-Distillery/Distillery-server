import { getChatProvider } from "../ai";
import { logger } from "../logger";

export type QueryType = "structural" | "exploratory";

export async function classifyQuery(
  query: string
): Promise<{ type: QueryType }> {
  const { provider, model } = await getChatProvider();

  const content = await provider.chatCompletion({
    model,
    temperature: 0,
    responseFormat: "json",
    messages: [
      {
        role: "system",
        content: `You classify user search queries into one of two types:

- "structural": The query asks about relationships, connections, contradictions, or structure between knowledge items. Examples: "서로 충돌하는 노트", "A와 B의 관계", "X를 뒷받침하는 근거"
- "exploratory": The query is a general topic search, looking for similar or relevant knowledge. Examples: "보안 관련 노트", "최근 배운 디자인 패턴", "React 성능 최적화"

Return JSON: { "type": "structural" | "exploratory" }`,
      },
      { role: "user", content: query },
    ],
  });

  try {
    const parsed = JSON.parse(content);
    if (parsed.type === "structural" || parsed.type === "exploratory") {
      return { type: parsed.type };
    }
  } catch {
    logger.warn({ content }, "Failed to parse query classification");
  }

  return { type: "exploratory" };
}

const GRAPH_SCHEMA = `
Node label: Knowledge
Properties: id (UUID string), type (string), summary (string), context (string), memo (string)

Relationship types:
- RELATED_TO (bidirectional, properties: source, confidence)
- SUPPORTS (directional: A supports B, properties: source, confidence)
- CONFLICTS_WITH (directional: A conflicts with B, properties: source, confidence)

Full-text index "knowledge_text" on [summary, context, memo]
`;

export async function generateCypher(query: string): Promise<string> {
  const { provider, model } = await getChatProvider();

  const content = await provider.chatCompletion({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a Neo4j Cypher query generator. Given a user's natural language query, generate a valid Cypher query.

Graph schema:
${GRAPH_SCHEMA}

Rules:
- Return ONLY the Cypher query string, no explanation or markdown
- Always RETURN node IDs, types, summaries, and relationship info
- Use LIMIT to avoid excessive results (default 20)
- For full-text search, use: CALL db.index.fulltext.queryNodes("knowledge_text", $searchTerm) YIELD node, score
- When returning relationships, include relationship type and properties
- Return nodes as: node.id AS id, node.type AS type, node.summary AS summary, node.context AS context, node.memo AS memo
- Return relationships as: type(r) AS relType, r.confidence AS confidence, startNode(r).id AS sourceId, endNode(r).id AS targetId`,
      },
      { role: "user", content: query },
    ],
  });

  if (!content) throw new Error("Empty Cypher response");

  // Strip markdown code fences if present
  return content.replace(/^```(?:cypher)?\n?/i, "").replace(/\n?```$/i, "").trim();
}

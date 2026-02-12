import { driver } from "../graph";

type NodeRecord = {
  id: string;
  type: string;
  summary: string;
  context: string;
  memo: string;
  score: number;
};

export async function keywordSearch(query: string, limit: number = 10) {
  const session = driver.session();
  try {
    const result = await session.run(
      `CALL db.index.fulltext.queryNodes("knowledge_text", $query)
       YIELD node, score
       RETURN node.id AS id, node.type AS type, node.summary AS summary,
              node.context AS context, node.memo AS memo, score
       LIMIT $limit`,
      { query, limit }
    );

    const nodes: NodeRecord[] = result.records.map((r) => {
      const obj = r.toObject();
      return {
        id: obj.id as string,
        type: obj.type as string,
        summary: obj.summary as string,
        context: obj.context as string,
        memo: obj.memo as string,
        score: obj.score as number,
      };
    });

    return { nodes };
  } finally {
    await session.close();
  }
}

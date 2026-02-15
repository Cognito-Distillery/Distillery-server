import { Elysia, t } from "elysia";
import { keywordSearch, naturalSearch } from "./service";

const KeywordQuery = t.Object({
  q: t.String(),
  limit: t.Optional(t.Numeric({ default: 10 })),
});

const NaturalQuery = t.Object({
  query: t.String(),
  threshold: t.Optional(t.Number({ minimum: 0.1, maximum: 0.95 })),
  topK: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
});

export const searchRoutes = new Elysia({ prefix: "/search" })
  .get(
    "/keyword",
    async ({ query }) => {
      return keywordSearch(query.q, query.limit);
    },
    {
      query: KeywordQuery,
      detail: {
        tags: ["Search"],
        summary: "키워드 검색",
        description:
          "Neo4j full-text index를 사용하여 summary, context, memo 필드에서 키워드 검색합니다.",
      },
    }
  )
  .post(
    "/natural",
    async ({ body }) => {
      return naturalSearch(body.query, {
        threshold: body.threshold,
        topK: body.topK,
      });
    },
    {
      body: NaturalQuery,
      detail: {
        tags: ["Search"],
        summary: "자연어 검색",
        description:
          "자연어 쿼리를 분류하여 structural(Text-to-Cypher) 또는 exploratory(임베딩+pgvector) 검색을 수행합니다.",
      },
    }
  );

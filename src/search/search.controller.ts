import { Elysia, t } from "elysia";
import { keywordSearch } from "./search.service";

const KeywordQuery = t.Object({
  q: t.String(),
  limit: t.Optional(t.Numeric({ default: 10 })),
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
  );

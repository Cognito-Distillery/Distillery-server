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
    { query: KeywordQuery }
  );

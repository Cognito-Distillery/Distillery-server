import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard";
import { getHistory, saveHistory, deleteHistory } from "./service";

const SaveBody = t.Object({
  query: t.String(),
  mode: t.Union([t.Literal("keyword"), t.Literal("natural")]),
  resultCount: t.Number(),
});

export const searchHistoryRoutes = new Elysia({ prefix: "/users/me/search-history" })
  .use(authGuard)

  .get(
    "/",
    async ({ user, query }) => {
      const limit = query.limit ? Number(query.limit) : 30;
      return getHistory(user!.slackId, limit);
    },
    {
      query: t.Object({ limit: t.Optional(t.String()) }),
      detail: { tags: ["Users"], summary: "검색 히스토리 조회" },
    }
  )

  .post(
    "/",
    async ({ user, body }) => {
      return saveHistory(user!.slackId, body.query, body.mode, body.resultCount);
    },
    {
      body: SaveBody,
      detail: { tags: ["Users"], summary: "검색 히스토리 저장" },
    }
  )

  .delete(
    "/:id",
    async ({ user, params }) => {
      await deleteHistory(user!.slackId, params.id);
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Users"], summary: "검색 히스토리 삭제" },
    }
  );

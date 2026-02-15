import { Elysia } from "elysia";
import { authGuard } from "../auth/guard";
import { PreferencesBody } from "./schema";
import { getPreferences, updatePreferences } from "./service";

export const preferencesRoutes = new Elysia({ prefix: "/users/me" })
  .use(authGuard)

  .get(
    "/preferences",
    async ({ user }) => {
      return getPreferences(user!.slackId);
    },
    {
      detail: { tags: ["Users"], summary: "유저 설정 조회" },
    }
  )

  .put(
    "/preferences",
    async ({ user, body }) => {
      return updatePreferences(user!.slackId, body as Record<string, unknown>);
    },
    {
      body: PreferencesBody,
      detail: { tags: ["Users"], summary: "유저 설정 수정" },
    }
  );

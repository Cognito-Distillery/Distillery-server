import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { msg } from "../i18n";

export const accessJwt = jwt({
  name: "accessJwt",
  secret: process.env.JWT_ACCESS_SECRET!,
  exp: "1d",
});

export const refreshJwt = jwt({
  name: "refreshJwt",
  secret: process.env.JWT_REFRESH_SECRET!,
  exp: "7d",
});

export const authGuard = new Elysia()
  .use(accessJwt)
  .derive(async ({ accessJwt, headers }) => {
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return { user: null };
    }
    const payload = await accessJwt.verify(auth.slice(7));
    if (!payload) {
      return { user: null };
    }
    return {
      user: payload as typeof payload & {
        sub: string;
        slackId: string;
        name: string;
        email: string;
      },
    };
  })
  .onBeforeHandle(({ user, set, headers }) => {
    if (!user) {
      const lang = headers["accept-language"];
      set.status = 401;
      return { error: msg("MISSING_TOKEN", lang) };
    }
  })
  .as("plugin");

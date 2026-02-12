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
  .onBeforeHandle(async ({ accessJwt, headers, set }) => {
    const lang = headers["accept-language"];
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      return { error: msg("MISSING_TOKEN", lang) };
    }
    const payload = await accessJwt.verify(auth.slice(7));
    if (!payload) {
      set.status = 401;
      return { error: msg("INVALID_TOKEN", lang) };
    }
  })
  .resolve(async ({ accessJwt, headers }) => {
    const payload = await accessJwt.verify(headers.authorization!.slice(7));
    return {
      user: payload as typeof payload & {
        sub: string;
        slackId: string;
        name: string;
        email: string;
      },
    };
  });

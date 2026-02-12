import { Elysia } from "elysia";
import { logger } from "./logger";
import { authRoutes } from "./auth";
import { maltRoutes } from "./malts";
import { blendRoutes } from "./blend";
import { searchRoutes } from "./search";
import { cronPlugin } from "./cron";
import { initGraphSchema } from "./graph/schema";

const app = new Elysia()
  .onRequest(({ store, request }) => {
    const s = store as Record<string, unknown>;
    s.requestId = crypto.randomUUID();
    s.startTime = Date.now();
    logger.info(
      { requestId: s.requestId, method: request.method, url: request.url },
      "incoming request"
    );
  })
  .onAfterResponse(({ store, request, set }) => {
    const s = store as Record<string, unknown>;
    const duration = Date.now() - (s.startTime as number);
    logger.info(
      {
        requestId: s.requestId,
        method: request.method,
        url: request.url,
        status: set.status || 200,
        duration,
      },
      "request completed"
    );
  })
  .onError(({ request, error, code, store }) => {
    const s = store as Record<string, unknown>;
    logger.error(
      { requestId: s.requestId, method: request.method, url: request.url, err: error, code },
      "request error"
    );
  })
  .use(cronPlugin)
  .use(authRoutes)
  .use(maltRoutes)
  .use(blendRoutes)
  .use(searchRoutes)
  .get("/", () => "Hello Elysia")
  .listen(3000);

logger.info(
  `Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

initGraphSchema();

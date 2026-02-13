import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { logger } from "./logger";
import { authRoutes } from "./auth";
import { maltRoutes } from "./malts";
import { blendRoutes } from "./blend";
import { searchRoutes } from "./search";
import { cronPlugin } from "./cron";
import { initGraphSchema } from "./graph/schema";
import { corsOrigins } from "./config";

const app = new Elysia()
  .use(cors({ origin: corsOrigins.length ? corsOrigins : true }))
  .use(
    openapi({
      path: "/docs",
      scalar: {
        theme: "moon",
        hideClientButton: false,
        showSidebar: true,
        showDeveloperTools: "localhost",
        showToolbar: "localhost",
        operationTitleSource: "summary",
        persistAuth: false,
        telemetry: true,
        layout: "modern",
        isEditable: false,
        isLoading: false,
        hideModels: false,
        documentDownloadType: "both",
        hideTestRequestButton: false,
        hideSearch: false,
        showOperationId: false,
        hideDarkModeToggle: false,
        withDefaultFonts: true,
        defaultOpenAllTags: false,
        expandAllModelSections: false,
        expandAllResponses: false,
        orderSchemaPropertiesBy: "alpha",
        orderRequiredPropertiesFirst: true,
      },
      documentation: {
        info: {
          title: "Distillery API",
          description: "Blending Room — Knowledge Graph API Server",
          version: "1.0.0",
        },
        tags: [
          { name: "Graph", description: "그래프 조회/편집" },
          { name: "Search", description: "키워드 검색" },
          { name: "Malts", description: "몰트 관리" },
          { name: "Auth", description: "인증 (OTP / JWT)" },
        ],
      },
    })
  )
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
  .listen(Number(process.env.PORT) || 8710);

logger.info(
  `Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

initGraphSchema();

import { Elysia } from "elysia";
import { reEmbed, reExtract, runPipeline } from "./service";
import { getProgress } from "./progress";

export const pipelineRoutes = new Elysia({ prefix: "/pipeline" })
  .get("/status", () => {
    return getProgress();
  }, {
    detail: { tags: ["Pipeline"], summary: "파이프라인 진행 상태 조회" },
  })

  .post("/re-embed", async () => {
    return reEmbed();
  }, {
    detail: { tags: ["Pipeline"], summary: "전체 재임베딩 (리셋)" },
  })

  .post("/re-extract", async () => {
    return reExtract();
  }, {
    detail: { tags: ["Pipeline"], summary: "전체 관계 재추출 (리셋)" },
  })

  .post("/trigger", async () => {
    return runPipeline();
  }, {
    detail: { tags: ["Pipeline"], summary: "파이프라인 수동 실행" },
  });

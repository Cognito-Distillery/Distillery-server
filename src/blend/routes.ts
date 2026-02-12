import { Elysia } from "elysia";
import {
  GetGraphQuery,
  ExpandQuery,
  NodeParams,
  CreateEdgeBody,
  UpdateEdgeBody,
  DeleteEdgeBody,
  UpdateNodeBody,
} from "./schema";
import {
  getGraph,
  getNodeWithNeighbors,
  expandNode,
  createEdge,
  updateEdge,
  deleteEdge,
  updateNode,
} from "./service";

export const blendRoutes = new Elysia({ prefix: "/graph" })

  // GET /graph — 전체 그래프 조회
  .get(
    "/",
    async ({ query }) => {
      return getGraph({
        relationType: query.relationType,
        source: query.source,
        limit: query.limit,
      });
    },
    {
      query: GetGraphQuery,
      detail: {
        tags: ["Graph"],
        summary: "전체 그래프 조회",
        description:
          "전체 그래프 또는 필터링된 서브그래프를 반환합니다. 노드와 엣지를 분리 조회하여 고립 노드도 포함됩니다.",
      },
    }
  )

  // GET /graph/node/:id — 노드 + 1-depth 이웃
  .get(
    "/node/:id",
    async ({ params, set }) => {
      const result = await getNodeWithNeighbors(params.id);
      if (!result) {
        set.status = 404;
        return { error: "Node not found" };
      }
      return result;
    },
    {
      params: NodeParams,
      detail: {
        tags: ["Graph"],
        summary: "노드 상세 조회",
        description:
          "특정 노드와 직접 연결된 1-depth 이웃 노드/엣지를 반환합니다.",
      },
    }
  )

  // GET /graph/node/:id/expand — N-depth 확장
  .get(
    "/node/:id/expand",
    async ({ params, query, set }) => {
      const depth = query.depth ?? 1;
      const result = await expandNode(params.id, depth);
      if (!result) {
        set.status = 404;
        return { error: "Node not found" };
      }
      return result;
    },
    {
      params: NodeParams,
      query: ExpandQuery,
      detail: {
        tags: ["Graph"],
        summary: "노드 확장 조회",
        description:
          "특정 노드 기준 N-depth 서브그래프를 확장합니다. depth는 1~3 사이 값입니다.",
      },
    }
  )

  // POST /graph/edge — 엣지 생성
  .post(
    "/edge",
    async ({ body, set }) => {
      const result = await createEdge(body.sourceId, body.targetId, body.relationType);
      if (!result) {
        set.status = 404;
        return { error: "Source or target node not found" };
      }
      set.status = 201;
      return result;
    },
    {
      body: CreateEdgeBody,
      detail: {
        tags: ["Graph"],
        summary: "엣지 생성",
        description:
          "두 노드 사이에 엣지를 생성합니다. source='human', confidence=1.0으로 기록됩니다. MERGE 기반이므로 중복 시 기존 엣지를 반환합니다.",
      },
    }
  )

  // PUT /graph/edge — 엣지 수정 (타입 변경)
  .put(
    "/edge",
    async ({ body, set }) => {
      const result = await updateEdge(body.sourceId, body.targetId, body.relationType);
      if (!result) {
        set.status = 404;
        return { error: "Edge not found" };
      }
      return result;
    },
    {
      body: UpdateEdgeBody,
      detail: {
        tags: ["Graph"],
        summary: "엣지 수정",
        description:
          "엣지의 relationType을 변경합니다. 내부적으로 기존 엣지 삭제 → 새 타입으로 재생성합니다 (단일 트랜잭션).",
      },
    }
  )

  // DELETE /graph/edge — 엣지 삭제
  .delete(
    "/edge",
    async ({ body, set }) => {
      const deleted = await deleteEdge(body.sourceId, body.targetId);
      if (!deleted) {
        set.status = 404;
        return { error: "Edge not found" };
      }
      return { success: true };
    },
    {
      body: DeleteEdgeBody,
      detail: {
        tags: ["Graph"],
        summary: "엣지 삭제",
        description:
          "sourceId + targetId 복합키로 엣지를 삭제합니다.",
      },
    }
  )

  // PUT /graph/node/:id — 노드 수정
  .put(
    "/node/:id",
    async ({ params, body, set }) => {
      const result = await updateNode(params.id, body);
      if (!result) {
        set.status = 404;
        return { error: "Node not found" };
      }
      return result;
    },
    {
      params: NodeParams,
      body: UpdateNodeBody,
      detail: {
        tags: ["Graph"],
        summary: "노드 수정",
        description:
          "노드의 summary, context, memo 필드를 수정합니다.",
      },
    }
  );

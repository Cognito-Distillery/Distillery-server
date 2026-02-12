import { Elysia } from "elysia";
import {
  GetGraphQuery,
  ExpandQuery,
  NodeParams,
  CreateEdgeBody,
  UpdateEdgeBody,
  DeleteEdgeBody,
  UpdateNodeBody,
} from "./blend.schema";
import {
  getGraph,
  getNodeWithNeighbors,
  expandNode,
  createEdge,
  updateEdge,
  deleteEdge,
  updateNode,
} from "./blend.service";

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
    { query: GetGraphQuery }
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
    { params: NodeParams }
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
    { params: NodeParams, query: ExpandQuery }
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
    { body: CreateEdgeBody }
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
    { body: UpdateEdgeBody }
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
    { body: DeleteEdgeBody }
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
    { params: NodeParams, body: UpdateNodeBody }
  );

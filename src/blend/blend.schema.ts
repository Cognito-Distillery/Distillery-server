import { t } from "elysia";

export const RelationTypeSchema = t.Union([
  t.Literal("RELATED_TO"),
  t.Literal("SUPPORTS"),
  t.Literal("CONFLICTS_WITH"),
]);

export const SourceSchema = t.Union([t.Literal("ai"), t.Literal("human")]);

export const GetGraphQuery = t.Object({
  relationType: t.Optional(RelationTypeSchema),
  source: t.Optional(SourceSchema),
  limit: t.Optional(t.Numeric({ default: 100 })),
});

export const ExpandQuery = t.Object({
  depth: t.Optional(t.Numeric({ default: 1, minimum: 1, maximum: 3 })),
});

export const NodeParams = t.Object({
  id: t.String(),
});

export const CreateEdgeBody = t.Object({
  sourceId: t.String(),
  targetId: t.String(),
  relationType: RelationTypeSchema,
});

export const UpdateEdgeBody = t.Object({
  sourceId: t.String(),
  targetId: t.String(),
  relationType: RelationTypeSchema,
});

export const DeleteEdgeBody = t.Object({
  sourceId: t.String(),
  targetId: t.String(),
});

export const UpdateNodeBody = t.Object({
  summary: t.Optional(t.String()),
  context: t.Optional(t.String()),
  memo: t.Optional(t.String()),
});

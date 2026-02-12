import { Elysia, t } from "elysia";
import { sql, and, eq } from "drizzle-orm";
import { authGuard } from "../auth/guard";
import { db } from "../db";
import { maltsters, malts } from "../db/schema";
import { msg } from "../i18n";

const MaltStatus = t.Union([
  t.Literal("MALT_HOUSE"),
  t.Literal("ON_STILL"),
  t.Literal("DISTILLED_READY"),
  t.Literal("DISTILLED"),
  t.Literal("CASKED"),
]);

const MaltType = t.Union([
  t.Literal("결정"),
  t.Literal("문제"),
  t.Literal("인사이트"),
  t.Literal("질문"),
]);

const queueMaltPayload = t.Object({
  localId: t.String(),
  type: MaltType,
  summary: t.String(),
  context: t.Optional(t.String()),
  memo: t.Optional(t.String()),
  status: t.Optional(MaltStatus),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

async function upsertMaltster(user: {
  slackId: string;
  email: string;
  name: string;
}): Promise<string> {
  const [row] = await db
    .insert(maltsters)
    .values({
      slackId: user.slackId,
      email: user.email,
      name: user.name,
    })
    .onConflictDoUpdate({
      target: maltsters.slackId,
      set: {
        email: user.email,
        name: user.name,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: maltsters.id });
  return row.id;
}

async function queueMalt(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  userId: string,
  payload: {
    localId: string;
    type: string;
    summary: string;
    context?: string;
    memo?: string;
    status?: string;
    createdAt: number;
    updatedAt: number;
  }
) {
  const now = Date.now();
  const [row] = await tx
    .insert(malts)
    .values({
      maltsterId: userId,
      localId: payload.localId,
      type: payload.type,
      status: payload.status ?? "DISTILLED_READY",
      summary: payload.summary,
      context: payload.context ?? "",
      memo: payload.memo ?? "",
      syncedAt: now,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    })
    .onConflictDoUpdate({
      target: [malts.maltsterId, malts.localId],
      set: {
        type: payload.type,
        status: payload.status ?? "DISTILLED_READY",
        summary: payload.summary,
        context: payload.context ?? "",
        memo: payload.memo ?? "",
        syncedAt: now,
        updatedAt: payload.updatedAt,
      },
    })
    .returning({ id: malts.id, localId: malts.localId, syncedAt: malts.syncedAt });
  return row;
}

export const maltRoutes = new Elysia({ prefix: "/malts" })
  .use(authGuard)

  // 증류 대기열 추가 (단건)
  .post(
    "/",
    async ({ user, body, set }) => {
      const userId = await upsertMaltster(user);
      const queued = await queueMalt(db, userId, body);
      set.status = 201;
      return queued;
    },
    { body: queueMaltPayload }
  )

  // 증류 대기열 추가 (일괄)
  .post(
    "/batch",
    async ({ user, body, set }) => {
      const userId = await upsertMaltster(user);

      const queuedMalts = await db.transaction(async (tx) => {
        const rows = [];
        for (let i = 0; i < body.malts.length; i++) {
          const row = await queueMalt(tx, userId, body.malts[i]);
          rows.push(row);
        }
        return rows;
      });

      set.status = 201;
      return { malts: queuedMalts };
    },
    { body: t.Object({ malts: t.Array(queueMaltPayload) }) }
  )

  // 드로우백
  .delete(
    "/:maltId",
    async ({ user, params, set, headers }) => {
      const lang = headers["accept-language"];
      const userId = await upsertMaltster(user);
      const [target] = await db
        .select({ id: malts.id, status: malts.status })
        .from(malts)
        .where(and(eq(malts.id, params.maltId), eq(malts.maltsterId, userId)));

      if (!target) {
        set.status = 404;
        return { error: msg("MALT_NOT_FOUND", lang) };
      }

      if (target.status !== "DISTILLED_READY") {
        set.status = 409;
        return { error: msg("DRAW_BACK_NOT_ALLOWED", lang) };
      }

      const [drawnBack] = await db
        .delete(malts)
        .where(eq(malts.id, target.id))
        .returning({ id: malts.id, localId: malts.localId });

      return drawnBack;
    },
    { params: t.Object({ maltId: t.String() }) }
  )

  // 몰트 조회 (status 필터)
  .get(
    "/",
    async ({ user, query }) => {
      const userId = await upsertMaltster(user);
      const conditions = [eq(malts.maltsterId, userId)];
      if (query.status) {
        conditions.push(eq(malts.status, query.status));
      }
      const result = await db
        .select({
          id: malts.id,
          localId: malts.localId,
          type: malts.type,
          summary: malts.summary,
          context: malts.context,
          memo: malts.memo,
          status: malts.status,
          syncedAt: malts.syncedAt,
          createdAt: malts.createdAt,
          updatedAt: malts.updatedAt,
        })
        .from(malts)
        .where(and(...conditions));

      return { malts: result };
    },
    { query: t.Object({ status: t.Optional(MaltStatus) }) }
  );

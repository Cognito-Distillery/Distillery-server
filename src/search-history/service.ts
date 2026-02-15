import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { maltsters, searchHistory } from "../db/schema";

const MAX_HISTORY = 30;

async function getMaltsterId(slackId: string): Promise<string> {
  const [row] = await db
    .select({ id: maltsters.id })
    .from(maltsters)
    .where(eq(maltsters.slackId, slackId));
  if (!row) throw new Error("maltster not found");
  return row.id;
}

export async function getHistory(slackId: string, limit = MAX_HISTORY) {
  const maltsterId = await getMaltsterId(slackId);
  return db
    .select({
      id: searchHistory.id,
      query: searchHistory.query,
      mode: searchHistory.mode,
      resultCount: searchHistory.resultCount,
      createdAt: searchHistory.createdAt,
    })
    .from(searchHistory)
    .where(eq(searchHistory.maltsterId, maltsterId))
    .orderBy(desc(searchHistory.createdAt))
    .limit(limit);
}

export async function saveHistory(
  slackId: string,
  query: string,
  mode: string,
  resultCount: number
) {
  const maltsterId = await getMaltsterId(slackId);

  const [inserted] = await db
    .insert(searchHistory)
    .values({ maltsterId, query, mode, resultCount })
    .returning();

  // Prune excess rows beyond MAX_HISTORY
  const rows = await db
    .select({ id: searchHistory.id })
    .from(searchHistory)
    .where(eq(searchHistory.maltsterId, maltsterId))
    .orderBy(desc(searchHistory.createdAt))
    .offset(MAX_HISTORY);

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    await db.delete(searchHistory).where(
      and(
        eq(searchHistory.maltsterId, maltsterId),
        sql`${searchHistory.id} = ANY(${ids})`
      )
    );
  }

  return inserted;
}

export async function deleteHistory(slackId: string, historyId: string) {
  const maltsterId = await getMaltsterId(slackId);
  await db
    .delete(searchHistory)
    .where(
      and(
        eq(searchHistory.id, historyId),
        eq(searchHistory.maltsterId, maltsterId)
      )
    );
}

import { eq } from "drizzle-orm";
import { db } from "../db";
import { maltsters } from "../db/schema";

const DEFAULTS = {
  locale: "ko",
  dateFormat: "medium",
  timeFormat: "24h",
  sidebarPosition: "left",
};

export async function getPreferences(slackId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ preferences: maltsters.preferences })
    .from(maltsters)
    .where(eq(maltsters.slackId, slackId));

  const stored = (row?.preferences ?? {}) as Record<string, unknown>;
  return { ...DEFAULTS, ...stored };
}

export async function updatePreferences(
  slackId: string,
  partial: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ preferences: maltsters.preferences })
    .from(maltsters)
    .where(eq(maltsters.slackId, slackId));

  const stored = (row?.preferences ?? {}) as Record<string, unknown>;
  const merged = { ...stored, ...partial };

  await db
    .update(maltsters)
    .set({ preferences: merged })
    .where(eq(maltsters.slackId, slackId));

  return { ...DEFAULTS, ...merged };
}

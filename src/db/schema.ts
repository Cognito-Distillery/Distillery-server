import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  uniqueIndex,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const maltsters = pgTable("maltsters", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slackId: text("slack_id").unique().notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const malts = pgTable(
  "malts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    maltsterId: uuid("maltster_id")
      .notNull()
      .references(() => maltsters.id),
    localId: text("local_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("DISTILLED_READY"),
    summary: text("summary").notNull(),
    context: text("context").notNull().default(""),
    memo: text("memo").notNull().default(""),
    embedding: vector("embedding", { dimensions: 1536 }),
    syncedAt: bigint("synced_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("malts_maltster_local_idx").on(table.maltsterId, table.localId),
    index("malts_embedding_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

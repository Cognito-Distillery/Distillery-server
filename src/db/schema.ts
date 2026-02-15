import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  real,
  uniqueIndex,
  index,
  vector,
  jsonb,
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
  preferences: jsonb("preferences").default(sql`'{}'::jsonb`),
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

export const aiSettings = pgTable("ai_settings", {
  singletonKey: text("singleton_key").primaryKey().default("default"),
  embeddingModel: text("embedding_model").notNull().default("text-embedding-3-small"),
  chatProvider: text("chat_provider").notNull().default("openai"),
  chatModel: text("chat_model").notNull().default("gpt-4o-mini"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pipelineSettings = pgTable("pipeline_settings", {
  singletonKey: text("singleton_key").primaryKey().default("default"),
  intervalMinutes: integer("interval_minutes").notNull().default(30),
  similarityThreshold: real("similarity_threshold").notNull().default(0.75),
  topK: integer("top_k").notNull().default(5),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const searchHistory = pgTable("search_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  maltsterId: uuid("maltster_id").notNull().references(() => maltsters.id),
  query: text("query").notNull(),
  mode: text("mode").notNull(),
  resultCount: bigint("result_count", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("search_history_maltster_idx").on(table.maltsterId, table.createdAt),
]);

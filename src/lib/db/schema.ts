import {
  blob,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    /** Russian translation of `description`; cleared when Metacritic changes the original. */
    descriptionRu: text("description_ru"),
    releaseDate: text("release_date"),
    coverUrl: text("cover_url"),
    cardImageUrl: text("card_image_url"),
    heroUrl: text("hero_url"),
    developer: text("developer"),
    publisher: text("publisher"),
    genres: json<string[]>("genres").notNull().default([]),
    metascore: integer("metascore"),
    userscore: real("userscore"),
    criticReviewCount: integer("critic_review_count").notNull().default(0),
    userReviewCount: integer("user_review_count").notNull().default(0),
    videoUrl: text("video_url"),
    videoTitle: text("video_title"),
    metacriticUrl: text("metacritic_url").notNull(),
    mustPlay: integer("must_play", { mode: "boolean" }).notNull().default(false),
    source: text("source").notNull(),
    firstSeenAt: integer("first_seen_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("games_title_idx").on(t.title), index("games_updated_idx").on(t.updatedAt)],
);

export const gamePlatforms = sqliteTable(
  "game_platforms",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    metascore: integer("metascore"),
    criticReviewCount: integer("critic_review_count").notNull().default(0),
    userscore: real("userscore"),
    userReviewCount: integer("user_review_count").notNull().default(0),
    releaseDate: text("release_date"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.slug] }), index("platform_slug_idx").on(t.slug)],
);

export type SummaryKind = "critic" | "user";

export const gameSummaries = sqliteTable(
  "game_summaries",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SummaryKind>().notNull(),
    likes: json<string[]>("likes").notNull(),
    dislikes: json<string[]>("dislikes").notNull(),
    verdict: text("verdict").notNull(),
    reviewCount: integer("review_count").notNull(),
    model: text("model").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.kind] })],
);

export const gameInsights = sqliteTable("game_insights", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  videoUrl: text("video_url").notNull(),
  videoTitle: text("video_title").notNull(),
  channel: text("channel"),
  views: integer("views"),
  durationSec: integer("duration_sec"),
  thumbnailUrl: text("thumbnail_url"),
  transcript: text("transcript").notNull(),
  conclusion: text("conclusion").notNull(),
  highlights: json<string[]>("highlights").notNull().default([]),
  model: text("model").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const gameCustomFields = sqliteTable(
  "game_custom_fields",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.key] })],
);

export const gameEmbeddings = sqliteTable("game_embeddings", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  vector: blob("vector", { mode: "buffer" }).notNull(),
  sourceHash: text("source_hash").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const gameSimilar = sqliteTable(
  "game_similar",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    similarId: integer("similar_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.similarId] })],
);

export type RunStatus = "running" | "success" | "failed";
export type NodeStatus = "idle" | "queued" | "running" | "success" | "failed" | "skipped";

export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trigger: text("trigger").$type<"schedule" | "manual">().notNull(),
  status: text("status").$type<RunStatus>().notNull(),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  day: text("day").notNull(),
  phase: text("phase"),
  total: integer("total").notNull().default(0),
  processed: integer("processed").notNull().default(0),
  added: integer("added").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  currentStep: text("current_step"),
  currentGame: text("current_game"),
  note: text("note"),
});

export interface NodeLog {
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
}

export const runNodes = sqliteTable(
  "run_nodes",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    status: text("status").$type<NodeStatus>().notNull(),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
    done: integer("done").notNull().default(0),
    total: integer("total").notNull().default(0),
    input: json<unknown>("input"),
    output: json<unknown>("output"),
    logs: json<NodeLog[]>("logs").notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId] })],
);

export const runEvents = sqliteTable(
  "run_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").references(() => runs.id, { onDelete: "cascade" }),
    ts: integer("ts").notNull(),
    level: text("level").$type<"info" | "success" | "warn" | "error">().notNull(),
    nodeId: text("node_id"),
    message: text("message").notNull(),
    detail: text("detail"),
  },
  (t) => [index("run_events_run_idx").on(t.runId)],
);

export const runRequests = sqliteTable("run_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestedAt: integer("requested_at").notNull(),
  status: text("status").$type<"pending" | "taken">().notNull(),
  runId: integer("run_id"),
});

export const dailyState = sqliteTable("daily_state", {
  day: text("day").primaryKey(),
  phase: text("phase").$type<"new-releases" | "browse">().notNull(),
  page: integer("page").notNull().default(1),
  processed: json<string[]>("processed").notNull().default([]),
  videoSeconds: integer("video_seconds").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const pipelineNodes = sqliteTable("pipeline_nodes", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  prompt: text("prompt"),
  params: json<Record<string, unknown>>("params").notNull().default({}),
  parentId: text("parent_id"),
  sort: integer("sort").notNull().default(0),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
});

export const aiCalls = sqliteTable(
  "ai_calls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: integer("ts").notNull(),
    provider: text("provider").$type<"google" | "openai">().notNull(),
    model: text("model").notNull(),
    capability: text("capability").$type<"text" | "video" | "embedding">().notNull(),
    purpose: text("purpose").notNull(),
    runId: integer("run_id"),
    gameId: integer("game_id"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status").$type<"ok" | "error" | "rate_limited">().notNull(),
    error: text("error"),
    costUsd: real("cost_usd").notNull().default(0),
  },
  (t) => [index("ai_calls_ts_idx").on(t.ts)],
);

export const aiModelState = sqliteTable("ai_model_state", {
  model: text("model").primaryKey(),
  minuteBucket: text("minute_bucket").notNull().default(""),
  minuteRequests: integer("minute_requests").notNull().default(0),
  minuteTokens: integer("minute_tokens").notNull().default(0),
  dayBucket: text("day_bucket").notNull().default(""),
  dayRequests: integer("day_requests").notNull().default(0),
  dayTokens: integer("day_tokens").notNull().default(0),
  cooldownUntil: integer("cooldown_until").notNull().default(0),
  lastError: text("last_error"),
});

export const workerHeartbeat = sqliteTable("worker_heartbeat", {
  id: integer("id").primaryKey(),
  pid: integer("pid").notNull(),
  startedAt: integer("started_at").notNull(),
  beatAt: integer("beat_at").notNull(),
  state: text("state").$type<"idle" | "running">().notNull(),
  nextRunAt: integer("next_run_at"),
});

export interface KeyInsight {
  kind: "up" | "down" | "opportunity";
  text: string;
}

export const analyticsInsights = sqliteTable("analytics_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at").notNull(),
  runId: integer("run_id"),
  insights: json<KeyInsight[]>("insights").notNull(),
  model: text("model").notNull(),
});

export const libraryEvents = sqliteTable(
  "library_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: integer("ts").notNull(),
    kind: text("kind").$type<"added" | "updated">().notNull(),
    gameId: integer("game_id").notNull(),
    title: text("title").notNull(),
  },
  (t) => [index("library_events_ts_idx").on(t.ts)],
);

export type Game = typeof games.$inferSelect;
export type GamePlatform = typeof gamePlatforms.$inferSelect;
export type GameSummary = typeof gameSummaries.$inferSelect;
export type GameInsight = typeof gameInsights.$inferSelect;
export type PipelineNodeRow = typeof pipelineNodes.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunNode = typeof runNodes.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;

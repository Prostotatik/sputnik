import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  aiCalls,
  gameCustomFields,
  gameInsights,
  gamePlatforms,
  games,
  gameSimilar,
  gameSummaries,
  pipelineNodes,
  runEvents,
  runNodes,
  runs,
  workerHeartbeat,
} from "@/lib/db/schema";
import { dayKey } from "@/lib/time";
import { openAiApiKey } from "@/lib/env";
import { isUnlimited, MODELS } from "./ai/catalog";
import { usageSnapshot } from "./ai/router";
import { listNodes, nodeOfType } from "./pipeline/repo";
import { loadDailyState } from "./selection";

export type GameSort = "metascore" | "userscore" | "release" | "updated";
export const GAME_SORTS: GameSort[] = ["release", "metascore", "userscore", "updated"];
/** The library is a feed of new games, so the newest release comes first by default. */
export const DEFAULT_GAME_SORT: GameSort = "release";

export interface GameListQuery {
  q?: string;
  platform?: string;
  sort?: GameSort;
  offset?: number;
  limit?: number;
}

export interface GameListItem {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  metascore: number | null;
  userscore: number | null;
  releaseDate: string | null;
  updatedAt: number;
  genres: string[];
  platforms: string[];
}

function platformsByGame(db: Db, ids: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (!ids.length) return map;
  const rows = db.select({ gameId: gamePlatforms.gameId, name: gamePlatforms.name }).from(gamePlatforms).where(inArray(gamePlatforms.gameId, ids)).all();
  for (const r of rows) map.set(r.gameId, [...(map.get(r.gameId) ?? []), r.name]);
  return map;
}

export function listGames(db: Db, query: GameListQuery): { items: GameListItem[]; total: number } {
  const where: SQL[] = [];
  const q = query.q?.trim();
  if (q) where.push(sql`lower(${games.title}) like ${`%${q.toLowerCase()}%`}`);
  if (query.platform) {
    where.push(sql`exists (select 1 from ${gamePlatforms} where ${gamePlatforms.gameId} = ${games.id} and ${gamePlatforms.name} = ${query.platform})`);
  }
  const cond = where.length ? and(...where) : undefined;
  const order: Record<GameSort, SQL[]> = {
    metascore: [sql`${games.metascore} is null`, sql`${games.metascore} desc`, sql`${games.userscore} desc`],
    userscore: [sql`${games.userscore} is null`, sql`${games.userscore} desc`, sql`${games.metascore} desc`],
    // Same-day releases: the most recently discovered first.
    release: [sql`${games.releaseDate} is null`, sql`${games.releaseDate} desc`, sql`${games.firstSeenAt} desc`],
    updated: [sql`${games.updatedAt} desc`],
  };
  const rows = db
    .select({
      id: games.id,
      slug: games.slug,
      title: games.title,
      coverUrl: games.coverUrl,
      metascore: games.metascore,
      userscore: games.userscore,
      releaseDate: games.releaseDate,
      updatedAt: games.updatedAt,
      genres: games.genres,
    })
    .from(games)
    .where(cond)
    .orderBy(...order[query.sort ?? DEFAULT_GAME_SORT], games.id)
    .limit(Math.min(100, query.limit ?? 20))
    .offset(query.offset ?? 0)
    .all();
  const total = db.select({ n: sql<number>`count(*)` }).from(games).where(cond).get()?.n ?? 0;
  const plats = platformsByGame(db, rows.map((r) => r.id));
  return { items: rows.map((r) => ({ ...r, platforms: plats.get(r.id) ?? [] })), total };
}

export function listPlatforms(db: Db): { name: string; count: number }[] {
  return db
    .select({ name: gamePlatforms.name, count: sql<number>`count(*)` })
    .from(gamePlatforms)
    .groupBy(gamePlatforms.name)
    .orderBy(sql`count(*) desc`)
    .all();
}

export function gameDetail(db: Db, slug: string) {
  const game = db.select().from(games).where(eq(games.slug, slug)).get();
  if (!game) return null;
  const platforms = db.select().from(gamePlatforms).where(eq(gamePlatforms.gameId, game.id)).all();
  const summaries = db.select().from(gameSummaries).where(eq(gameSummaries.gameId, game.id)).all();
  const insight = db.select().from(gameInsights).where(eq(gameInsights.gameId, game.id)).get() ?? null;
  const customFields = db.select().from(gameCustomFields).where(eq(gameCustomFields.gameId, game.id)).all();
  const similarRows = db
    .select({ id: games.id, slug: games.slug, title: games.title, coverUrl: games.coverUrl, heroUrl: games.heroUrl, metascore: games.metascore, score: gameSimilar.score })
    .from(gameSimilar)
    .innerJoin(games, eq(games.id, gameSimilar.similarId))
    .where(eq(gameSimilar.gameId, game.id))
    .orderBy(gameSimilar.rank)
    .all();
  const plats = platformsByGame(db, similarRows.map((s) => s.id));
  // Only show custom fields whose node still exists.
  // Labels come from the node, so renaming a rule renames the field on every card.
  const labels = new Map(
    listNodes(db)
      .filter((n) => n.type === "custom_prompt")
      .map((n) => {
        const p = n.params as { fieldKey: string; label: string };
        return [p.fieldKey, p.label] as const;
      }),
  );
  return {
    // The card shows the Russian description when there is one; the original stays for sync and similarity.
    game: { ...game, description: game.descriptionRu ?? game.description },
    platforms,
    critic: summaries.find((s) => s.kind === "critic") ?? null,
    user: summaries.find((s) => s.kind === "user") ?? null,
    insight,
    customFields: customFields.filter((f) => labels.has(f.key)).map((f) => ({ ...f, label: labels.get(f.key)! })),
    similar: similarRows.map((s) => ({ ...s, platforms: plats.get(s.id) ?? [] })),
  };
}

export type GameDetailData = NonNullable<ReturnType<typeof gameDetail>>;

const HEARTBEAT_STALE_MS = 30_000;

/** Realtime service status used by the SSE stream and every tab. */
export function statusSnapshot(db: Db, now = Date.now()) {
  const hb = db.select().from(workerHeartbeat).where(eq(workerHeartbeat.id, 1)).get();
  const online = Boolean(hb && now - hb.beatAt < HEARTBEAT_STALE_MS);
  const latest = db.select().from(runs).orderBy(desc(runs.id)).get() ?? null;
  const active = latest?.status === "running" ? latest : null;
  const nodes = latest ? db.select().from(runNodes).where(eq(runNodes.runId, latest.id)).all() : [];
  const events = latest
    ? db.select().from(runEvents).where(eq(runEvents.runId, latest.id)).orderBy(desc(runEvents.id)).limit(12).all()
    : [];
  const sync = nodeOfType(listNodes(db), "sync")!;
  const today = dayKey(new Date(now), sync.params.timezone);
  const totalGames = db.select({ n: sql<number>`count(*)` }).from(games).get()?.n ?? 0;
  const lastUpdate = db.select({ t: sql<number | null>`max(${games.updatedAt})` }).from(games).get()?.t ?? null;
  const count = (s: string) => nodes.filter((n) => n.status === s).length;
  const throughput = db
    .select({ ts: runEvents.ts })
    .from(runEvents)
    .where(gte(runEvents.ts, now - 3_600_000))
    .all();
  const spark = Array.from({ length: 20 }, (_, i) => {
    const from = now - 3_600_000 + i * 180_000;
    return throughput.filter((e) => e.ts >= from && e.ts < from + 180_000).length;
  });
  return {
    now,
    worker: {
      online,
      state: online ? (hb?.state ?? "idle") : "offline",
      pid: hb?.pid ?? null,
      beatAt: hb?.beatAt ?? null,
      startedAt: hb?.startedAt ?? null,
      nextRunAt: hb?.nextRunAt ?? null,
      intervalMinutes: sync.params.intervalMinutes,
    },
    run: latest && {
      id: latest.id,
      status: latest.status,
      trigger: latest.trigger,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      total: latest.total,
      processed: latest.processed,
      added: latest.added,
      updated: latest.updated,
      errors: latest.errors,
      currentStep: latest.currentStep,
      currentGame: latest.currentGame,
      note: latest.note,
    },
    active: Boolean(active),
    nodes: nodes.map((n) => ({ nodeId: n.nodeId, status: n.status, startedAt: n.startedAt, finishedAt: n.finishedAt, done: n.done, total: n.total })),
    workers: { active: count("running"), idle: count("queued") + count("success") + count("skipped"), error: count("failed"), total: nodes.length },
    events: events.map((e) => ({ id: e.id, ts: e.ts, level: e.level, message: e.message, detail: e.detail, nodeId: e.nodeId })),
    totals: { games: totalGames, processedToday: loadDailyState(db, today).processed.length, lastUpdate },
    activity: spark,
  };
}

export type StatusSnapshot = ReturnType<typeof statusSnapshot>;

export function runList(db: Db, limit = 30) {
  return db.select().from(runs).orderBy(desc(runs.id)).limit(limit).all();
}

/** Pipeline graph + node execution data for a run (latest when omitted). */
export function workersView(db: Db, runId?: number) {
  const nodes = listNodes(db);
  const run = runId ? db.select().from(runs).where(eq(runs.id, runId)).get() : db.select().from(runs).orderBy(desc(runs.id)).get();
  const exec = run ? db.select().from(runNodes).where(eq(runNodes.runId, run.id)).all() : [];
  const events = run ? db.select().from(runEvents).where(eq(runEvents.runId, run.id)).orderBy(desc(runEvents.id)).limit(40).all() : [];
  const updatedAt = db.select({ t: sql<number>`max(${pipelineNodes.updatedAt})` }).from(pipelineNodes).get()?.t ?? 0;
  const openai = Boolean(openAiApiKey());
  const models = MODELS.filter((m) => m.provider === "google" || openai).map((m) => ({ id: m.id, label: m.label, capabilities: m.capabilities, rpd: isUnlimited(m.rpd) ? null : m.rpd }));
  return { nodes, run: run ?? null, exec, events, rulesUpdatedAt: updatedAt, models };
}

const DAY = 86_400_000;

export function monitoringView(db: Db, now = Date.now()) {
  const since = now - 14 * DAY;
  const calls = db.select().from(aiCalls).where(gte(aiCalls.ts, since)).all();
  const startOfToday = Date.parse(`${dayKey(new Date(now), "UTC")}T00:00:00Z`);
  const today = calls.filter((c) => c.ts >= startOfToday);
  const sum = (xs: typeof calls, f: (c: (typeof calls)[number]) => number) => xs.reduce((s, c) => s + f(c), 0);

  const days = Array.from({ length: 14 }, (_, i) => {
    const from = startOfToday - (13 - i) * DAY;
    const rows = calls.filter((c) => c.ts >= from && c.ts < from + DAY);
    return {
      day: new Date(from).toISOString().slice(5, 10),
      requests: rows.length,
      tokens: sum(rows, (c) => c.inputTokens + c.outputTokens),
      cost: sum(rows, (c) => c.costUsd),
      errors: rows.filter((c) => c.status !== "ok").length,
    };
  });

  const byModel = new Map<string, { model: string; requests: number; inputTokens: number; outputTokens: number; cost: number; errors: number; latency: number }>();
  for (const c of today) {
    const m = byModel.get(c.model) ?? { model: c.model, requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, errors: 0, latency: 0 };
    m.requests++;
    m.inputTokens += c.inputTokens;
    m.outputTokens += c.outputTokens;
    m.cost += c.costUsd;
    if (c.status !== "ok") m.errors++;
    m.latency += c.latencyMs;
    byModel.set(c.model, m);
  }
  const byPurpose = new Map<string, { purpose: string; requests: number; tokens: number }>();
  for (const c of today) {
    const key = c.purpose.startsWith("custom:") ? "custom" : c.purpose;
    const p = byPurpose.get(key) ?? { purpose: key, requests: 0, tokens: 0 };
    p.requests++;
    p.tokens += c.inputTokens + c.outputTokens;
    byPurpose.set(key, p);
  }

  const recentRuns = runList(db, 20);
  const errors = db
    .select()
    .from(runEvents)
    .where(inArray(runEvents.level, ["error", "warn"]))
    .orderBy(desc(runEvents.id))
    .limit(15)
    .all();
  const failedCalls = db
    .select()
    .from(aiCalls)
    .where(and(gte(aiCalls.ts, since), sql`${aiCalls.status} != 'ok'`))
    .orderBy(desc(aiCalls.id))
    .limit(10)
    .all();

  return {
    today: {
      requests: today.length,
      inputTokens: sum(today, (c) => c.inputTokens),
      outputTokens: sum(today, (c) => c.outputTokens),
      cost: sum(today, (c) => c.costUsd),
      errors: today.filter((c) => c.status !== "ok").length,
      avgLatency: today.length ? Math.round(sum(today, (c) => c.latencyMs) / today.length) : 0,
    },
    days,
    models: [...byModel.values()].map((m) => ({ ...m, latency: m.requests ? Math.round(m.latency / m.requests) : 0 })).sort((a, b) => b.requests - a.requests),
    purposes: [...byPurpose.values()].sort((a, b) => b.tokens - a.tokens),
    quotas: usageSnapshot(db, now),
    runs: recentRuns,
    errors,
    failedCalls: failedCalls.map((c) => ({ id: c.id, ts: c.ts, model: c.model, purpose: c.purpose, status: c.status, error: c.error })),
  };
}

export type MonitoringData = ReturnType<typeof monitoringView>;
export type WorkersData = ReturnType<typeof workersView>;

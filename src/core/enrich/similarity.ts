import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { gameEmbeddings, gamePlatforms, games, gameSimilar } from "@/lib/db/schema";

const MIN_SCORE = 0.25;

export interface SimilarityItem {
  id: number;
  genres: string[];
  developer: string | null;
  platforms: string[];
  vector: Float32Array | null;
}

export interface EmbeddingSource {
  title: string;
  genres: string[];
  developer: string | null;
  description: string | null;
}

export function embeddingText(g: EmbeddingSource): string {
  return [
    g.title,
    g.genres.length ? `Genres: ${g.genres.join(", ")}` : "",
    g.developer ? `Developer: ${g.developer}` : "",
    (g.description ?? "").slice(0, 1500),
  ]
    .filter(Boolean)
    .join("\n");
}

export function textHash(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export function encodeVector(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer);
}

export function decodeVector(buf: Buffer): Float32Array {
  const copy = new Uint8Array(buf).slice().buffer;
  return new Float32Array(copy);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a.map((s) => s.toLowerCase()));
  const sb = new Set(b.map((s) => s.toLowerCase()));
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Metadata similarity in [0, 1]: genres 0.5, developer 0.3, platforms 0.2. */
export function metadataScore(a: SimilarityItem, b: SimilarityItem): number {
  const dev = a.developer && b.developer && a.developer.toLowerCase() === b.developer.toLowerCase() ? 1 : 0;
  return 0.5 * jaccard(a.genres, b.genres) + 0.3 * dev + 0.2 * jaccard(a.platforms, b.platforms);
}

/** Blends semantic similarity with metadata overlap; falls back to metadata when vectors are missing. */
export function similarity(a: SimilarityItem, b: SimilarityItem): number {
  const meta = metadataScore(a, b);
  if (a.vector && b.vector && a.vector.length === b.vector.length) {
    // Embedding cosines for related texts cluster around 0.5-0.9; stretch that range to [0, 1].
    const sem = Math.min(1, Math.max(0, (cosine(a.vector, b.vector) - 0.5) / 0.4));
    return 0.7 * sem + 0.3 * meta;
  }
  return meta;
}

export function topSimilar(target: SimilarityItem, others: SimilarityItem[], k: number): { id: number; score: number }[] {
  return others
    .filter((o) => o.id !== target.id)
    .map((o) => ({ id: o.id, score: similarity(target, o) }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}

export function loadSimilarityItems(db: Db): SimilarityItem[] {
  const rows = db.select({ id: games.id, genres: games.genres, developer: games.developer }).from(games).all();
  const platforms = db.select({ gameId: gamePlatforms.gameId, name: gamePlatforms.name }).from(gamePlatforms).all();
  const vectors = db.select({ gameId: gameEmbeddings.gameId, vector: gameEmbeddings.vector }).from(gameEmbeddings).all();
  const byGame = new Map<number, string[]>();
  for (const p of platforms) byGame.set(p.gameId, [...(byGame.get(p.gameId) ?? []), p.name]);
  const vecByGame = new Map(vectors.map((v) => [v.gameId, decodeVector(v.vector)]));
  return rows.map((r) => ({
    id: r.id,
    genres: r.genres,
    developer: r.developer,
    platforms: byGame.get(r.id) ?? [],
    vector: vecByGame.get(r.id) ?? null,
  }));
}

function writeList(db: Db, gameId: number, list: { id: number; score: number }[]): void {
  db.delete(gameSimilar).where(eq(gameSimilar.gameId, gameId)).run();
  if (list.length) {
    db.insert(gameSimilar)
      .values(list.map((s, rank) => ({ gameId, similarId: s.id, score: s.score, rank })))
      .run();
  }
}

/**
 * Recomputes neighbours of `touched` games against the whole library and inserts touched games
 * into other games' lists where they now rank in the top K. Cost is O(touched × library).
 */
export function refreshSimilar(db: Db, touched: number[], k: number): number {
  if (!touched.length) return 0;
  const items = loadSimilarityItems(db);
  const byId = new Map(items.map((i) => [i.id, i]));
  const touchedSet = new Set(touched);
  const existing = db.select().from(gameSimilar).orderBy(gameSimilar.gameId, gameSimilar.rank).all();
  const lists = new Map<number, { id: number; score: number }[]>();
  for (const row of existing) {
    if (touchedSet.has(row.gameId)) continue;
    lists.set(row.gameId, [...(lists.get(row.gameId) ?? []), { id: row.similarId, score: row.score }]);
  }

  let updated = 0;
  db.transaction((tx) => {
    for (const id of touched) {
      const target = byId.get(id);
      if (!target) continue;
      writeList(tx as unknown as Db, id, topSimilar(target, items, k));
      updated++;
    }
    for (const other of items) {
      if (touchedSet.has(other.id)) continue;
      const current = (lists.get(other.id) ?? []).filter((s) => !touchedSet.has(s.id));
      const candidates = touched
        .map((t) => byId.get(t))
        .filter((t): t is SimilarityItem => Boolean(t))
        .map((t) => ({ id: t.id, score: similarity(other, t) }))
        .filter((s) => s.score >= MIN_SCORE);
      const merged = [...current, ...candidates].sort((x, y) => y.score - x.score).slice(0, k);
      const before = JSON.stringify(lists.get(other.id) ?? []);
      if (JSON.stringify(merged) !== before) {
        writeList(tx as unknown as Db, other.id, merged);
        updated++;
      }
    }
  });
  return updated;
}

export function saveEmbedding(db: Db, gameId: number, model: string, values: number[], sourceHash: string): void {
  const row = { gameId, model, vector: encodeVector(values), sourceHash, updatedAt: Date.now() };
  db.insert(gameEmbeddings).values(row).onConflictDoUpdate({ target: gameEmbeddings.gameId, set: row }).run();
}

export function embeddingHash(db: Db, gameId: number): string | undefined {
  return db.select({ h: gameEmbeddings.sourceHash }).from(gameEmbeddings).where(eq(gameEmbeddings.gameId, gameId)).get()?.h;
}

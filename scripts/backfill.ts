/**
 * Backfills AI data for games that were processed while the AI provider was unavailable.
 *
 *   tsx scripts/backfill.ts dump-reviews <out.json>       review samples for games with reviews but no summary
 *   tsx scripts/backfill.ts save-summaries <in.json> <model>  stores summaries written outside the worker
 *   tsx scripts/backfill.ts reprocess                     reruns the pipeline for games missing embeddings or let's-play insights
 *
 * Run it from the project root with the same environment as the worker.
 */
import fs from "node:fs";
import { and, eq, notInArray, or, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { gameEmbeddings, gameInsights, games, gameSummaries, type SummaryKind } from "@/lib/db/schema";
import { AiService } from "@/core/ai/service";
import { balancedSample, saveSummary, summaryValidator } from "@/core/enrich/summaries";
import { MetacriticClient } from "@/core/metacritic/client";
import { listNodes, nodeOfType, ensurePipeline } from "@/core/pipeline/repo";
import { activeRun } from "@/core/runs";
import { realPoints } from "@/lib/opinions";
import { executeRun } from "@/worker/runner";

const db = getDb();
ensurePipeline(db);
const [mode, ...args] = process.argv.slice(2);

function mc(): MetacriticClient {
  return new MetacriticClient({ delayMs: nodeOfType(listNodes(db), "sync")!.params.requestDelayMs });
}

function missingSummaries(): { gameId: number; slug: string; title: string; genres: string[]; developer: string | null; kind: SummaryKind; reviewCount: number }[] {
  const out = [];
  for (const g of db.select().from(games).where(or(gt(games.criticReviewCount, 0), gt(games.userReviewCount, 0))).all()) {
    for (const kind of ["critic", "user"] as const) {
      const reviewCount = kind === "critic" ? g.criticReviewCount : g.userReviewCount;
      if (reviewCount <= 0) continue;
      const existing = db.select().from(gameSummaries).where(and(eq(gameSummaries.gameId, g.id), eq(gameSummaries.kind, kind))).get();
      if (existing) continue;
      out.push({ gameId: g.id, slug: g.slug, title: g.title, genres: g.genres, developer: g.developer, kind, reviewCount });
    }
  }
  return out;
}

async function dumpReviews(file: string): Promise<void> {
  const client = mc();
  const nodes = listNodes(db);
  const out = [];
  for (const m of missingSummaries()) {
    const node = nodeOfType(nodes, m.kind === "critic" ? "critic_summary" : "user_summary")!;
    const max = node.params.maxReviews;
    const half = Math.ceil(max / 2);
    const pos = await client.reviews(m.kind, m.slug, "positive", half);
    const neg = await client.reviews(m.kind, m.slug, "negative", half);
    const extra = neg.items.length < half / 2 ? (await client.reviews(m.kind, m.slug, "neutral", half)).items : [];
    const sample = balancedSample(pos.items, [...neg.items, ...extra], max);
    out.push({ ...m, reviews: sample.map((r) => ({ score: r.score, platform: r.platform, quote: r.quote })) });
    console.log(`${m.title} (${m.kind}): ${sample.length} reviews`);
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} review samples to ${file}`);
}

const savedSummary = summaryValidator.extend({ gameId: z.number().int(), kind: z.enum(["critic", "user"]), reviewCount: z.number().int().positive() });

function saveSummaries(file: string, model: string): void {
  const items = z.array(savedSummary).parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const clean = (list: string[]) => realPoints(list.map((s) => s.trim().replace(/\.$/, "")).filter(Boolean)).slice(0, 5);
  for (const s of items) {
    saveSummary(db, s.gameId, s.kind, { likes: clean(s.likes), dislikes: clean(s.dislikes), verdict: s.verdict.trim() }, s.reviewCount, model);
  }
  console.log(`Saved ${items.length} summaries as ${model}`);
}

async function reprocess(): Promise<void> {
  const embedded = db.select({ id: gameEmbeddings.gameId }).from(gameEmbeddings).all().map((r) => r.id);
  const withInsight = db.select({ id: gameInsights.gameId }).from(gameInsights).all().map((r) => r.id);
  const rows = db
    .select()
    .from(games)
    .where(
      or(
        embedded.length ? notInArray(games.id, embedded) : sql`1`,
        and(sql`${games.criticReviewCount} + ${games.userReviewCount} > 0`, withInsight.length ? notInArray(games.id, withInsight) : sql`1`),
      ),
    )
    .all();
  if (!rows.length) {
    console.log("Nothing to reprocess");
    return;
  }
  const candidates = rows.map((g) => ({
    slug: g.slug,
    title: g.title,
    releaseDate: g.releaseDate,
    platforms: [],
    genres: g.genres,
    metascore: g.metascore,
    imageUrl: g.coverUrl,
    source: g.source === "new-releases" ? ("new-releases" as const) : ("browse" as const),
  }));
  console.log(`Reprocessing ${candidates.length} games`);
  const id = await executeRun({ db, mc: mc(), ai: new AiService(db) }, "manual", null, { candidates });
  console.log(`Run #${id} finished`);
}

async function main(): Promise<void> {
  if (activeRun(db)) throw new Error("A run is in progress; try again when it finishes.");
  if (mode === "dump-reviews" && args[0]) await dumpReviews(args[0]);
  else if (mode === "save-summaries" && args[0] && args[1]) saveSummaries(args[0], args[1]);
  else if (mode === "reprocess") await reprocess();
  else throw new Error("Usage: backfill.ts dump-reviews <out.json> | save-summaries <in.json> <model> | reprocess");
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

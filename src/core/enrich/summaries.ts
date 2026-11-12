import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { gameSummaries, type SummaryKind } from "@/lib/db/schema";
import type { AiContext, AiService } from "../ai/service";
import type { Review } from "../metacritic/map";
import { realPoints } from "@/lib/opinions";
import { renderPrompt } from "../pipeline/defaults";

const QUOTE_LIMIT = 600;

export const summarySchema = {
  type: "object",
  properties: {
    likes: { type: "array", items: { type: "string" } },
    dislikes: { type: "array", items: { type: "string" } },
    verdict: { type: "string" },
  },
  required: ["likes", "dislikes", "verdict"],
};

export const summaryValidator = z.object({
  likes: z.array(z.string().min(1)).max(8),
  dislikes: z.array(z.string().min(1)).max(8),
  verdict: z.string().min(1),
});

export type ReviewSummary = z.infer<typeof summaryValidator>;

/** Interleaves positive and negative reviews so both sides are represented, up to `max`. */
export function balancedSample(positive: Review[], negative: Review[], max: number): Review[] {
  const out: Review[] = [];
  const seen = new Set<string>();
  const queues = [[...positive], [...negative]];
  while (out.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      const r = q.shift();
      if (!r || out.length >= max) continue;
      const key = r.quote.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export function formatReviews(reviews: Review[]): string {
  return reviews
    .map((r, i) => {
      const quote = r.quote.length > QUOTE_LIMIT ? `${r.quote.slice(0, QUOTE_LIMIT)}…` : r.quote;
      return `${i + 1}. [${r.score ?? "?"}${r.platform ? `, ${r.platform}` : ""}] ${quote}`;
    })
    .join("\n");
}

/** A summary is (re)generated only when there are reviews and the count changed since the last one. */
export function needsSummary(existing: { reviewCount: number } | undefined, reviewCount: number): boolean {
  if (reviewCount <= 0) return false;
  return !existing || existing.reviewCount !== reviewCount;
}

export function getSummary(db: Db, gameId: number, kind: SummaryKind) {
  return db
    .select()
    .from(gameSummaries)
    .where(and(eq(gameSummaries.gameId, gameId), eq(gameSummaries.kind, kind)))
    .get();
}

export interface SummaryGame {
  title: string;
  genres: string[];
  developer: string | null;
}

export async function summarizeReviews(
  ai: AiService,
  ctx: AiContext,
  template: string,
  game: SummaryGame,
  reviews: Review[],
): Promise<{ summary: ReviewSummary; model: string; prompt: string }> {
  const prompt = renderPrompt(template, {
    title: game.title,
    genres: game.genres.join(", ") || "жанр не указан",
    developer: game.developer ?? "не указан",
    reviews: formatReviews(reviews),
  });
  const res = await ai.json(ctx, prompt, summarySchema, summaryValidator);
  const clean = (list: string[]) => realPoints(list.map((s) => s.trim().replace(/\.$/, "")).filter(Boolean)).slice(0, 5);
  return {
    summary: { likes: clean(res.value.likes), dislikes: clean(res.value.dislikes), verdict: res.value.verdict.trim() },
    model: res.model,
    prompt,
  };
}

export function saveSummary(
  db: Db,
  gameId: number,
  kind: SummaryKind,
  summary: ReviewSummary,
  reviewCount: number,
  model: string,
): void {
  const values = { gameId, kind, ...summary, reviewCount, model, updatedAt: Date.now() };
  db.insert(gameSummaries)
    .values(values)
    .onConflictDoUpdate({ target: [gameSummaries.gameId, gameSummaries.kind], set: values })
    .run();
}

import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { aiCalls, analyticsInsights, gameCustomFields, gamePlatforms, games } from "@/lib/db/schema";
import type { AiContext, AiService } from "../ai/service";
import { metricsForPrompt, type AnalyticsData } from "../analytics";
import { renderPrompt } from "../pipeline/defaults";
import { getSummary } from "./summaries";
import { getInsight } from "./youtube";

export interface GameContext {
  title: string;
  genres: string[];
  platforms: string[];
  developer: string | null;
  description: string | null;
  metascore: number | null;
  userscore: number | null;
  criticVerdict: string | null;
  userVerdict: string | null;
  letsplayConclusion: string | null;
}

export function gamePromptVars(g: GameContext): Record<string, string> {
  return {
    title: g.title,
    genres: g.genres.join(", ") || "unknown genre",
    platforms: g.platforms.join(", ") || "unknown",
    developer: g.developer ?? "unknown",
    description: (g.description ?? "").slice(0, 1500),
    metascore: g.metascore === null ? "n/a" : String(g.metascore),
    userscore: g.userscore === null ? "n/a" : String(g.userscore),
    criticVerdict: g.criticVerdict ?? "n/a",
    userVerdict: g.userVerdict ?? "n/a",
    letsplay: g.letsplayConclusion ?? "n/a",
  };
}

export function gameContext(db: Db, gameId: number): GameContext {
  const g = db.select().from(games).where(eq(games.id, gameId)).get()!;
  const platforms = db.select({ name: gamePlatforms.name }).from(gamePlatforms).where(eq(gamePlatforms.gameId, gameId)).all();
  return {
    title: g.title,
    genres: g.genres,
    platforms: platforms.map((p) => p.name),
    developer: g.developer,
    description: g.description,
    metascore: g.metascore,
    userscore: g.userscore,
    criticVerdict: getSummary(db, gameId, "critic")?.verdict ?? null,
    userVerdict: getSummary(db, gameId, "user")?.verdict ?? null,
    letsplayConclusion: getInsight(db, gameId)?.conclusion ?? null,
  };
}

/** The site has no login, so rule tests share a small daily budget instead of drawing on the whole AI quota. */
export const RULE_TEST_DAILY_LIMIT = 30;
export const RULE_TEST_PURPOSE = "custom:test";

/** AI calls made by rule tests since UTC midnight (a test that falls through the rotation counts each model tried). */
export function ruleTestsToday(db: Db, now = Date.now()): number {
  const since = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(aiCalls)
      .where(and(eq(aiCalls.purpose, RULE_TEST_PURPOSE), gte(aiCalls.ts, since)))
      .get()?.n ?? 0
  );
}

/** Runs a custom rule's prompt against one library game without storing the answer (the "Test" button). */
export async function previewCustomField(
  db: Db,
  ai: AiService,
  input: { slug: string; prompt: string; preferredModel?: string },
): Promise<{ value: string; model: string; prompt: string; game: string } | null> {
  const row = db.select({ id: games.id, title: games.title }).from(games).where(eq(games.slug, input.slug)).get();
  if (!row) return null;
  const prompt = renderPrompt(input.prompt, gamePromptVars(gameContext(db, row.id)));
  const res = await ai.text({ purpose: RULE_TEST_PURPOSE, gameId: row.id, preferredModel: input.preferredModel }, prompt);
  return { value: res.value.trim().slice(0, 2000), model: res.model, prompt, game: row.title };
}

/** Runs a user-defined prompt node for one game and stores the answer as a custom field. */
export async function runCustomField(
  db: Db,
  ai: AiService,
  ctx: AiContext & { gameId: number },
  node: { prompt: string; fieldKey: string; label: string },
  game: GameContext,
): Promise<{ value: string; model: string; prompt: string }> {
  const prompt = renderPrompt(node.prompt, gamePromptVars(game));
  const res = await ai.text(ctx, prompt);
  const value = res.value.trim().slice(0, 2000);
  const row = { gameId: ctx.gameId, key: node.fieldKey, label: node.label, value, updatedAt: Date.now() };
  db.insert(gameCustomFields)
    .values(row)
    .onConflictDoUpdate({ target: [gameCustomFields.gameId, gameCustomFields.key], set: row })
    .run();
  return { value, model: res.model, prompt };
}

const insightsSchema = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["up", "down", "opportunity"] },
          text: { type: "string" },
        },
        required: ["kind", "text"],
      },
    },
  },
  required: ["insights"],
};

const insightsValidator = z.object({
  insights: z.array(z.object({ kind: z.enum(["up", "down", "opportunity"]), text: z.string().min(5) })).min(1).max(5),
});

/** Generates and stores market key insights from aggregated analytics. */
export async function generateKeyInsights(
  db: Db,
  ai: AiService,
  ctx: AiContext,
  template: string,
  analytics: AnalyticsData,
): Promise<{ items: z.infer<typeof insightsValidator>["insights"]; model: string; prompt: string } | null> {
  if ((analytics.kpis.totalGames.value ?? 0) < 3) return null;
  const prompt = renderPrompt(template, { metrics: metricsForPrompt(analytics) });
  const res = await ai.json(ctx, prompt, insightsSchema, insightsValidator);
  const items = res.value.insights.slice(0, 3);
  db.insert(analyticsInsights).values({ createdAt: Date.now(), runId: ctx.runId ?? null, insights: items, model: res.model }).run();
  return { items, model: res.model, prompt };
}

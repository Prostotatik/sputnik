import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { analyticsInsights, gameCustomFields, gameInsights, games, gameSummaries, pipelineNodes } from "@/lib/db/schema";
import { realPoints } from "@/lib/opinions";
import type { AiService } from "../ai/service";
import { customDescription, DEFAULT_CUSTOM_PROMPT } from "../pipeline/defaults";
import { summarySchema, summaryValidator } from "./summaries";
import { isRussian, translateDescription, TRANSLATE_MODEL } from "./translate";
import { letsplaySchema, letsplayValidator } from "./youtube";

/** Free models only, so translating the library never spends the Gemini quota the worker relies on. */
export const LIBRARY_TRANSLATE_MODELS = [TRANSLATE_MODEL, "gemma-4-26b-a4b-it"];

const jsonPrompt = (what: string, value: unknown) => `Переведи на русский язык ${what} в JSON ниже.
Сохрани структуру и ключи, переводи только текстовые значения. Названия игр, студий, платформ, каналов и имена оставь как в оригинале.
Ответь только JSON.

${JSON.stringify(value, null, 2)}`;

const insightsValidator = z.object({ insights: z.array(z.object({ kind: z.enum(["up", "down", "opportunity"]), text: z.string().min(1) })) });
const insightsSchema = {
  type: "object",
  properties: { insights: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, text: { type: "string" } }, required: ["kind", "text"] } } },
  required: ["insights"],
};
const customNodeValidator = z.object({ label: z.string().min(1).max(60), question: z.string() });
const customNodeSchema = { type: "object", properties: { label: { type: "string" }, question: { type: "string" } }, required: ["label", "question"] };

export interface LibraryTodo {
  descriptions: number;
  summaries: number;
  letsplays: number;
  customFields: number;
  customRules: number;
  marketInsights: number;
}

export interface TranslateOptions {
  dryRun?: boolean;
  limit?: number;
  log?: (line: string) => void;
  /** Called when every allowed model is out of quota; resolve to retry, reject to stop. */
  onQuota?: (err: Error) => Promise<void>;
}

const english = (text: string | null | undefined) => Boolean(text && text.trim() && !isRussian(text));

function pending(db: Db) {
  const descriptions = db
    .select({ id: games.id, title: games.title, description: games.description })
    .from(games)
    .where(and(isNotNull(games.description), isNull(games.descriptionRu)))
    .all();
  const summaries = db.select().from(gameSummaries).all().filter((s) => english([s.verdict, ...s.likes, ...s.dislikes].join(" ")));
  const letsplays = db.select().from(gameInsights).all().filter((i) => english(i.conclusion));
  const customFields = db.select().from(gameCustomFields).all().filter((f) => english(f.value));
  const customRules = db
    .select()
    .from(pipelineNodes)
    .where(eq(pipelineNodes.isCustom, true))
    .all()
    .filter((n) => english(n.name));
  const latest = db.select().from(analyticsInsights).orderBy(desc(analyticsInsights.id)).limit(1).all().filter((r) => english(r.insights.map((i) => i.text).join(" ")));
  return { descriptions, summaries, letsplays, customFields, customRules, latest };
}

export function libraryTodo(db: Db): LibraryTodo {
  const p = pending(db);
  return {
    descriptions: p.descriptions.length,
    summaries: p.summaries.length,
    letsplays: p.letsplays.length,
    customFields: p.customFields.length,
    customRules: p.customRules.length,
    marketInsights: p.latest.length,
  };
}

/**
 * Translates what the library already holds into Russian: descriptions, review summaries, let's-play
 * verdicts, custom fields and rules, and the latest market insights. Rows already in Russian are skipped,
 * so it can be stopped and run again. Titles, developers, platforms and transcripts are left alone.
 */
export async function translateLibrary(db: Db, ai: AiService, opts: TranslateOptions = {}): Promise<{ done: number; failed: number; todo: LibraryTodo }> {
  const log = opts.log ?? (() => {});
  const todo = libraryTodo(db);
  if (opts.dryRun) return { done: 0, failed: 0, todo };
  const p = pending(db);
  const ctx = { purpose: "translate", preferredModel: TRANSLATE_MODEL };
  let done = 0;
  let failed = 0;
  const limit = opts.limit ?? Infinity;

  const attempt = async (label: string, fn: () => Promise<void>) => {
    if (done + failed >= limit) return;
    for (;;) {
      try {
        await fn();
        done++;
        log(`ok   ${label}`);
        return;
      } catch (err) {
        if ((err as Error).name === "QuotaExhaustedError" && opts.onQuota) {
          await opts.onQuota(err as Error);
          continue;
        }
        failed++;
        log(`fail ${label}: ${(err as Error).message}`);
        return;
      }
    }
  };

  // Custom rules first: their labels are shown on every card.
  for (const n of p.customRules) {
    await attempt(`rule ${n.name}`, async () => {
      const question = n.prompt?.startsWith(DEFAULT_CUSTOM_PROMPT) ? n.prompt.slice(DEFAULT_CUSTOM_PROMPT.length) : "";
      const res = await ai.json(ctx, jsonPrompt("название поля и вопрос", { label: n.name, question }), customNodeSchema, customNodeValidator);
      const label = res.value.label.trim().slice(0, 60);
      db.update(pipelineNodes)
        .set({
          name: label,
          description: customDescription(label),
          params: { ...(n.params as Record<string, unknown>), label },
          prompt: question && n.prompt ? DEFAULT_CUSTOM_PROMPT + res.value.question.trim() : n.prompt,
          updatedAt: Date.now(),
        })
        .where(eq(pipelineNodes.id, n.id))
        .run();
      db.update(gameCustomFields).set({ label }).where(eq(gameCustomFields.key, String((n.params as { fieldKey?: string }).fieldKey ?? ""))).run();
    });
  }

  for (const s of p.summaries) {
    await attempt(`summary ${s.kind} #${s.gameId}`, async () => {
      const res = await ai.json(ctx, jsonPrompt("сводку отзывов", { likes: s.likes, dislikes: s.dislikes, verdict: s.verdict }), summarySchema, summaryValidator);
      const clean = (list: string[]) => realPoints(list.map((x) => x.trim().replace(/\.$/, "")).filter(Boolean)).slice(0, 5);
      db.update(gameSummaries)
        .set({ likes: clean(res.value.likes), dislikes: clean(res.value.dislikes), verdict: res.value.verdict.trim() })
        .where(and(eq(gameSummaries.gameId, s.gameId), eq(gameSummaries.kind, s.kind)))
        .run();
    });
  }

  for (const i of p.letsplays) {
    await attempt(`let's-play #${i.gameId}`, async () => {
      const res = await ai.json(ctx, jsonPrompt("вывод блогера об игре", { conclusion: i.conclusion, highlights: i.highlights }), letsplaySchema, letsplayValidator);
      db.update(gameInsights).set({ conclusion: res.value.conclusion.trim(), highlights: res.value.highlights }).where(eq(gameInsights.gameId, i.gameId)).run();
    });
  }

  for (const g of p.descriptions) {
    await attempt(`description ${g.title}`, async () => {
      const text = g.description!;
      const value = isRussian(text) ? text : (await translateDescription(ai, { ...ctx, gameId: g.id }, text)).value;
      db.update(games).set({ descriptionRu: value }).where(eq(games.id, g.id)).run();
    });
  }

  for (const f of p.customFields) {
    await attempt(`field ${f.key} #${f.gameId}`, async () => {
      const res = await ai.text({ ...ctx, gameId: f.gameId }, `Переведи на русский язык текст ниже. Названия игр, студий и платформ оставь как в оригинале. Ответь только переводом.\n\n${f.value}`);
      db.update(gameCustomFields).set({ value: res.value.trim().slice(0, 2000) }).where(and(eq(gameCustomFields.gameId, f.gameId), eq(gameCustomFields.key, f.key))).run();
    });
  }

  for (const r of p.latest) {
    await attempt(`market insights #${r.id}`, async () => {
      const res = await ai.json(ctx, jsonPrompt("инсайты рынка (поле kind не переводи)", { insights: r.insights }), insightsSchema, insightsValidator);
      if (res.value.insights.length !== r.insights.length) throw new Error("число инсайтов изменилось");
      db.update(analyticsInsights)
        .set({ insights: res.value.insights.map((x, k) => ({ kind: r.insights[k].kind, text: x.text.trim() })) })
        .where(eq(analyticsInsights.id, r.id))
        .run();
    });
  }

  return { done, failed, todo };
}

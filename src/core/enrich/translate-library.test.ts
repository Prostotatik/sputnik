import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { analyticsInsights, gameCustomFields, gameInsights, games, gameSummaries, pipelineNodes } from "@/lib/db/schema";
import type { AiService } from "../ai/service";
import { DEFAULT_CUSTOM_PROMPT } from "../pipeline/defaults";
import { addCustomNode, listNodes } from "../pipeline/repo";
import { AiCallError, QuotaExhaustedError } from "../ai/router";
import { batchByChars, libraryTodo, translateLibrary } from "./translate-library";

/** Fake model: returns the same structure with a Russian prefix in front of every string value. */
function fakeAi(fail: string[] = []): AiService & { calls: number } {
  const ru = (v: unknown): unknown =>
    typeof v === "string" ? `Это русский перевод текста: ${v}` : Array.isArray(v) ? v.map(ru) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "kind" ? x : ru(x)])) : v;
  const ai = {
    calls: 0,
    json: async (_ctx: unknown, prompt: string) => {
      ai.calls++;
      if (fail.some((f) => prompt.includes(f))) throw new Error("bad answer");
      return { value: ru(JSON.parse(prompt.slice(prompt.indexOf("{")))), model: "fake" };
    },
    text: async (_ctx: unknown, prompt: string) => {
      ai.calls++;
      return { value: `Это русский перевод текста: ${prompt.split("\n").pop()}`, model: "fake" };
    },
  };
  return ai as unknown as AiService & { calls: number };
}

function seed() {
  const db = openDb(":memory:");
  listNodes(db);
  const base = { metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1, genres: [] };
  db.insert(games).values([
    { ...base, slug: "a", title: "Alpha", description: "A dark fantasy RPG." },
    { ...base, slug: "b", title: "Beta", description: "Ролевая игра в мрачном мире.", descriptionRu: "Ролевая игра в мрачном мире." },
  ]).run();
  db.insert(gameSummaries).values([
    { gameId: 1, kind: "critic", likes: ["Great combat"], dislikes: ["Bugs"], verdict: "A strong debut.", reviewCount: 3, model: "m", updatedAt: 1 },
    { gameId: 2, kind: "critic", likes: ["Сильный сюжет"], dislikes: [], verdict: "Хорошая игра.", reviewCount: 3, model: "m", updatedAt: 1 },
  ]).run();
  db.insert(gameInsights).values({ gameId: 1, videoId: "v", videoUrl: "u", videoTitle: "t", views: 1, durationSec: 1, transcript: "x", conclusion: "The blogger loves it.", highlights: ["combat"], model: "m", updatedAt: 1 }).run();
  addCustomNode(db, { label: "Monetization", fieldKey: "monetization", prompt: `${DEFAULT_CUSTOM_PROMPT}How does it make money?` });
  db.insert(gameCustomFields).values({ gameId: 1, key: "monetization", label: "Monetization", value: "Premium, no microtransactions.", updatedAt: 1 }).run();
  db.insert(analyticsInsights).values({ createdAt: 1, insights: [{ kind: "up", text: "Action is growing" }], model: "m" }).run();
  return db;
}

describe("translateLibrary", () => {
  it("counts only what is still in English and changes nothing on a dry run", async () => {
    const db = seed();
    const ai = fakeAi();
    const res = await translateLibrary(db, ai, { dryRun: true });
    expect(res.todo).toEqual({ descriptions: 1, summaries: 1, letsplays: 1, customFields: 1, customRules: 1, marketInsights: 1 });
    expect(ai.calls).toBe(0);
  });

  it("translates every kind of stored text and is idempotent", async () => {
    const db = seed();
    const ai = fakeAi();
    const res = await translateLibrary(db, ai);
    expect(res).toMatchObject({ done: 6, failed: 0 });
    expect(db.select().from(games).all().find((g) => g.slug === "a")!.descriptionRu).toBe("Это русский перевод текста: A dark fantasy RPG.");
    expect(db.select().from(gameSummaries).all().find((s) => s.gameId === 1)).toMatchObject({ likes: ["Это русский перевод текста: Great combat"], verdict: "Это русский перевод текста: A strong debut.", reviewCount: 3 });
    expect(db.select().from(gameInsights).get()).toMatchObject({ conclusion: "Это русский перевод текста: The blogger loves it.", transcript: "x" });
    const rule = db.select().from(pipelineNodes).all().find((n) => n.id === "custom_monetization")!;
    expect(rule).toMatchObject({ name: "Это русский перевод текста: Monetization", prompt: `${DEFAULT_CUSTOM_PROMPT}Это русский перевод текста: How does it make money?` });
    expect((rule.params as { fieldKey: string; label: string })).toMatchObject({ fieldKey: "monetization", label: "Это русский перевод текста: Monetization" });
    expect(db.select().from(gameCustomFields).get()).toMatchObject({ label: "Это русский перевод текста: Monetization", value: "Это русский перевод текста: Premium, no microtransactions." });
    expect(db.select().from(analyticsInsights).get()!.insights).toEqual([{ kind: "up", text: "Это русский перевод текста: Action is growing" }]);
    expect(libraryTodo(db)).toEqual({ descriptions: 0, summaries: 0, letsplays: 0, customFields: 0, customRules: 0, marketInsights: 0 });

    const calls = ai.calls;
    await translateLibrary(db, ai);
    expect(ai.calls).toBe(calls);
  });

  it("keeps going past a failed item and respects the limit", async () => {
    const db = seed();
    const res = await translateLibrary(db, fakeAi(["A strong debut"]));
    expect(res).toMatchObject({ done: 5, failed: 1 });
    expect(libraryTodo(db).summaries).toBe(1);

    const limited = await translateLibrary(seed(), fakeAi(), { limit: 2 });
    expect(limited.done).toBe(2);
  });
});

describe("translateLibrary edge cases", () => {
  it("stores only requested ids from a description batch and leaves the rest for the next run", async () => {
    const db = seed();
    const ai = fakeAi();
    const json = ai.json.bind(ai) as unknown as (ctx: unknown, prompt: string) => Promise<{ value: unknown; model: string }>;
    ai.json = (async (ctx: unknown, prompt: string) => {
      const res = await json(ctx, prompt);
      const v = res.value as { items?: { id: number; text: string }[] };
      if (v.items) v.items = v.items.map((i) => ({ ...i, id: i.id + 100 }));
      return res;
    }) as typeof ai.json;
    await translateLibrary(db, ai);
    expect(db.select().from(games).all().find((g) => g.slug === "a")!.descriptionRu).toBeNull();
    expect(libraryTodo(db).descriptions).toBe(1);
  });

  it("waits only when no model is usable and fails fast when the models answered badly", async () => {
    const db = seed();
    let waits = 0;
    let n = 0;
    const ai = {
      json: async () => {
        n++;
        // First call: nothing usable yet (quota); then every model tried and failed.
        if (n === 1) throw new QuotaExhaustedError("text", []);
        throw new QuotaExhaustedError("text", ["gemini-3.5-flash-lite"]);
      },
      text: async () => {
        throw new AiCallError("boom", "other");
      },
    } as unknown as AiService;
    const res = await translateLibrary(db, ai, { onQuota: async () => void waits++ });
    expect(waits).toBe(1);
    expect(res.failed).toBe(6);
    expect(res.done).toBe(0);
  });

  it("stops at the call cap", async () => {
    const res = await translateLibrary(seed(), fakeAi(), { maxCalls: 2 });
    expect(res.calls).toBe(2);
    expect(res.done).toBe(2);
  });
});

describe("batchByChars", () => {
  it("packs items up to the budget and gives oversized items their own batch", () => {
    expect(batchByChars([500, 700, 900, 3000, 100], (n) => n, 2000)).toEqual([[500, 700], [900], [3000], [100]]);
  });
});

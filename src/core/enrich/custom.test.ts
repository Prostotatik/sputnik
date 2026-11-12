import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { analyticsInsights, gameCustomFields, gamePlatforms, games } from "@/lib/db/schema";
import type { AiService } from "../ai/service";
import { computeAnalytics } from "../analytics";
import { generateKeyInsights, previewCustomField, runCustomField, type GameContext } from "./custom";

const game: GameContext = {
  title: "Elden Ring",
  genres: ["Action RPG"],
  platforms: ["PC"],
  developer: "From Software",
  description: "Open world",
  metascore: 96,
  userscore: 8.4,
  criticVerdict: "Masterpiece",
  userVerdict: "Loved",
  letsplayConclusion: null,
};

function fakeAi(answer: unknown): AiService & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    text: async (_ctx: unknown, prompt: string) => {
      prompts.push(prompt);
      return { value: String(answer), model: "fake" };
    },
    json: async (_ctx: unknown, prompt: string) => {
      prompts.push(prompt);
      return { value: answer, model: "fake" };
    },
  } as unknown as AiService & { prompts: string[] };
}

describe("custom prompt nodes", () => {
  it("stores the answer as a per-game custom field", async () => {
    const db = openDb(":memory:");
    const { id } = db
      .insert(games)
      .values({ slug: "er", title: "Elden Ring", metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
      .returning({ id: games.id })
      .get();
    const ai = fakeAi("Premium, no microtransactions.");
    await runCustomField(db, ai, { purpose: "custom", gameId: id }, { prompt: "Monetization of {{title}} on {{platforms}}?", fieldKey: "monetization", label: "Monetization" }, game);
    expect(ai.prompts[0]).toBe("Monetization of Elden Ring on PC?");
    expect(db.select().from(gameCustomFields).all()).toEqual([
      expect.objectContaining({ gameId: id, key: "monetization", label: "Monetization", value: "Premium, no microtransactions." }),
    ]);
  });
});

describe("custom rule preview", () => {
  it("renders the prompt from library data and stores nothing", async () => {
    const db = openDb(":memory:");
    const { id } = db
      .insert(games)
      .values({ slug: "er", title: "Elden Ring", genres: ["Action RPG"], metascore: 96, metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
      .returning({ id: games.id })
      .get();
    db.insert(gamePlatforms).values({ gameId: id, slug: "pc", name: "PC" }).run();
    const ai = fakeAi("  Premium.  ");
    const res = await previewCustomField(db, ai, { slug: "er", prompt: "{{title}} ({{genres}}) on {{platforms}}, meta {{metascore}}, critics: {{criticVerdict}}" });
    expect(res).toEqual({ value: "Premium.", model: "fake", game: "Elden Ring", prompt: "Elden Ring (Action RPG) on PC, meta 96, critics: нет данных" });
    expect(db.select().from(gameCustomFields).all()).toHaveLength(0);
    expect(await previewCustomField(db, ai, { slug: "missing", prompt: "x {{title}}" })).toBeNull();
  });
});

describe("key insights", () => {
  it("skips tiny libraries and stores insights otherwise", async () => {
    const db = openDb(":memory:");
    const ai = fakeAi({ insights: [{ kind: "up", text: "Action RPGs are rising fast." }] });
    expect(await generateKeyInsights(db, ai, { purpose: "insights" }, "{{metrics}}", computeAnalytics(db, { days: 30 }))).toBeNull();
    const today = new Date().toISOString().slice(0, 10);
    for (const slug of ["a", "b", "c"]) {
      db.insert(games)
        .values({ slug, title: slug, genres: ["Action"], releaseDate: today, metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
        .run();
    }
    const res = await generateKeyInsights(db, ai, { purpose: "insights" }, "Metrics:\n{{metrics}}", computeAnalytics(db, { days: 30 }));
    expect(res?.items).toHaveLength(1);
    expect(ai.prompts[0]).toContain("Доля жанров: Action 100%");
    expect(db.select().from(analyticsInsights).all()).toHaveLength(1);
  });
});

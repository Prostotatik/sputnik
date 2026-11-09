import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { gameCustomFields, gameInsights, games, gameSummaries, runNodes, runs } from "@/lib/db/schema";
import type { AiService } from "@/core/ai/service";
import type { MetacriticClient } from "@/core/metacritic/client";
import product from "@/core/metacritic/__fixtures__/product-elden-ring.json";
import { mapProduct, type FinderItem } from "@/core/metacritic/map";
import { addCustomNode, listNodes, updateNode } from "@/core/pipeline/repo";
import { loadDailyState } from "@/core/selection";
import { dayKey } from "@/lib/time";
import { executeRun } from "./runner";

const base = mapProduct(product);
const item = (slug: string): FinderItem => ({ slug, title: slug, releaseDate: null, platforms: [], genres: [], metascore: null, imageUrl: null });

function fakeMc(newReleases: string[], failing: string[] = []): MetacriticClient {
  return {
    newReleases: async () => newReleases.map(item),
    browseNew: async (page: number) => ({ items: page === 1 ? ["x1", "x2", "x3"].map(item) : [], total: 3 }),
    product: async (slug: string) => {
      if (failing.includes(slug)) throw new Error("boom");
      return { ...base, slug, title: `Game ${slug}`, releaseDate: new Date().toISOString().slice(0, 10), metacriticUrl: `https://www.metacritic.com/game/${slug}/` };
    },
    stats: async (kind: string) => ({ score: kind === "critic" ? 90 : 8, reviewCount: 4, positiveCount: 3, neutralCount: 0, negativeCount: 1 }),
    reviews: async (_k: string, _s: string, sentiment: string) => ({
      items: [{ score: sentiment === "positive" ? 9 : 3, quote: `${sentiment} review`, author: null, date: null, platform: null }],
      total: 1,
    }),
  } as unknown as MetacriticClient;
}

function fakeAi(): AiService & { calls: string[]; prompts: string[] } {
  const calls: string[] = [];
  const prompts: string[] = [];
  return {
    calls,
    prompts,
    json: async (ctx: { purpose: string }, prompt: string) => {
      calls.push(ctx.purpose);
      prompts.push(prompt);
      if (ctx.purpose === "insights") return { value: { insights: [{ kind: "up", text: "Action is growing a lot" }] }, model: "fake" };
      if (ctx.purpose === "letsplay_summary") return { value: { conclusion: "The blogger loves it", highlights: ["combat"] }, model: "fake" };
      return { value: { likes: ["World"], dislikes: ["Bugs"], verdict: "Great" }, model: "fake" };
    },
    text: async (ctx: { purpose: string }, prompt: string) => {
      calls.push(ctx.purpose);
      prompts.push(prompt);
      return { value: "Premium, no microtransactions", model: "fake" };
    },
    transcribeYoutube: async (ctx: { purpose: string }) => {
      calls.push(ctx.purpose);
      return { value: "So this boss is incredible, I love the combat in this game ".repeat(10), model: "fake" };
    },
    embedding: async () => ({ value: [1, 0, 0], model: "fake-emb" }),
  } as unknown as AiService & { calls: string[]; prompts: string[] };
}

const youtubeSearch = async () => [
  { id: "v1", title: "Game a1 let's play part 1", channel: "Chan", views: 1000, durationSec: 3600, url: "https://www.youtube.com/watch?v=v1", thumbnailUrl: "" },
];

describe("executeRun", () => {
  it("reprocesses explicit candidates without touching the daily selection", async () => {
    const db = openDb(":memory:");
    listNodes(db);
    const ai = fakeAi();
    const mc = fakeMc(["n1", "n2"]);
    const candidates = [{ ...item("old1"), source: "browse" as const }, { ...item("old2"), source: "browse" as const }];
    await executeRun({ db, mc, ai, youtubeSearch }, "manual", null, { candidates });
    const run = db.select().from(runs).get()!;
    expect(run).toMatchObject({ status: "success", total: 2, processed: 2, added: 2, errors: 0 });
    expect(db.select().from(games).all().map((g) => g.slug).sort()).toEqual(["old1", "old2"]);
    const today = dayKey(new Date(), "Europe/Moscow");
    const state = loadDailyState(db, today);
    expect(state.phase).toBe("new-releases");
    expect(state.processed).toEqual([]);
  });

  it("processes New Releases end-to-end and isolates per-game failures", async () => {
    const db = openDb(":memory:");
    listNodes(db);
    updateNode(db, "sync", { params: { gamesPerRun: 4 } });
    const ai = fakeAi();
    const id = await executeRun({ db, mc: fakeMc(["a1", "a2", "a3", "a4"], ["a2"]), ai, youtubeSearch }, "manual");
    const run = db.select().from(runs).get()!;
    expect(run).toMatchObject({ id, status: "success", total: 4, processed: 4, added: 3, errors: 1 });
    expect(db.select().from(games).all()).toHaveLength(3);
    expect(db.select().from(gameSummaries).all()).toHaveLength(6);
    expect(db.select().from(gameInsights).all().map((i) => i.conclusion)).toContain("The blogger loves it");
    expect(ai.calls).toContain("insights");
    const today = dayKey(new Date(), "Europe/Moscow");
    expect(loadDailyState(db, today).processed).toEqual(["a1", "a2", "a3", "a4"]);
    const nodes = db.select().from(runNodes).all();
    expect(nodes.find((n) => n.nodeId === "parse")?.status).toBe("success");
    expect(nodes.find((n) => n.nodeId === "fetch")?.output).toMatchObject({ games: expect.any(Array) });
  });

  it("uses edited rules on the next run: disabled YouTube node makes no searches", async () => {
    const db = openDb(":memory:");
    listNodes(db);
    updateNode(db, "sync", { params: { gamesPerRun: 2 } });
    updateNode(db, "youtube", { enabled: false });
    let searches = 0;
    const ai = fakeAi();
    await executeRun({ db, mc: fakeMc(["a1", "a2"]), ai, youtubeSearch: async () => (searches++, []) }, "schedule");
    expect(searches).toBe(0);
    expect(ai.calls).not.toContain("transcribe");
    expect(db.select().from(runNodes).all().find((n) => n.nodeId === "youtube")?.status).toBe("skipped");

    // Second run of the day continues from See All, skipping processed games.
    await executeRun({ db, mc: fakeMc(["a1", "a2"]), ai, youtubeSearch }, "schedule");
    expect(db.select().from(games).all().map((g) => g.slug).sort()).toEqual(["a1", "a2", "x1", "x2"]);
  });

  it("uses an edited prompt on the next run and stores custom rule output on the game", async () => {
    const db = openDb(":memory:");
    listNodes(db);
    updateNode(db, "sync", { params: { gamesPerRun: 1 } });
    updateNode(db, "youtube", { enabled: false });
    updateNode(db, "reviews", { prompt: "EDITED critic prompt for {{title}}: {{reviews}}" });
    const added = addCustomNode(db, { label: "Monetization", fieldKey: "monetization", prompt: "How is {{title}} monetised on {{platforms}}?" });
    expect(added.ok).toBe(true);
    const ai = fakeAi();
    await executeRun({ db, mc: fakeMc(["a1"]), ai, youtubeSearch }, "manual");
    expect(ai.prompts.some((p) => p.startsWith("EDITED critic prompt for Game a1:"))).toBe(true);
    const custom = ai.prompts.find((p) => p.startsWith("How is Game a1 monetised on "));
    expect(custom).toBeDefined();
    expect(custom).toContain("PlayStation 5");
    expect(custom).not.toContain("{{");
    expect(db.select().from(gameCustomFields).all()).toEqual([
      expect.objectContaining({ key: "monetization", label: "Monetization", value: "Premium, no microtransactions" }),
    ]);
    expect(db.select().from(runNodes).all().find((n) => n.nodeId === "custom_monetization")?.status).toBe("success");
  });
});

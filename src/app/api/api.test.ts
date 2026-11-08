import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sputnik-api-"));
process.env.SPUTNIK_DATA_DIR = dir;

// Imported after the data dir is set so getDb() opens a temporary database.
const { getDb } = await import("@/lib/db/client");
const { gamePlatforms, games } = await import("@/lib/db/schema");
const runs = await import("./runs/route");
const gamesRoute = await import("./games/route");
const pipeline = await import("./pipeline/[id]/route");
const exportRoute = await import("./analytics/export/route");

beforeAll(() => {
  const db = getDb();
  const add = (slug: string, title: string, metascore: number | null, platform: string) => {
    const { id } = db
      .insert(games)
      .values({ slug, title, metascore, genres: ["Action"], releaseDate: new Date().toISOString().slice(0, 10), metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
      .returning({ id: games.id })
      .get();
    db.insert(gamePlatforms).values({ gameId: id, slug: platform.toLowerCase(), name: platform }).run();
  };
  add("elden-ring", "Elden Ring", 96, "PlayStation 5");
  add("hades", "Hades", 93, "PC");
  add("tbd", "Unscored Game", null, "PC");
});

const ctx = <T extends object>(params: T) => ({ params: Promise.resolve(params) }) as never;

describe("API", () => {
  it("Run Now returns 202 then 409 while a run is requested", async () => {
    expect((await runs.POST()).status).toBe(202);
    const second = await runs.POST();
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: expect.stringContaining("already") });
  });

  it("filters games by title and platform and sorts unscored last", async () => {
    const all = await (await gamesRoute.GET(new Request("http://x/api/games?sort=metascore"))).json();
    expect(all.items.map((g: { slug: string }) => g.slug)).toEqual(["elden-ring", "hades", "tbd"]);
    const search = await (await gamesRoute.GET(new Request("http://x/api/games?q=ELDEN"))).json();
    expect(search.total).toBe(1);
    const pc = await (await gamesRoute.GET(new Request("http://x/api/games?platform=PC"))).json();
    expect(pc.items.map((g: { slug: string }) => g.slug)).toEqual(["hades", "tbd"]);
  });

  it("rejects invalid pipeline params with 400", async () => {
    const res = await pipeline.PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ params: { gamesPerRun: 0 } }) }),
      ctx({ id: "sync" }),
    );
    expect(res.status).toBe(400);
  });

  it("exports analytics as CSV", async () => {
    const res = exportRoute.GET(new Request("http://x/api/analytics/export?days=30"));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\n")[0]).toBe("section,name,metric,value");
    expect(text).toContain("genre_share,Action,games,3");
  });
});

describe("CSV export safety", async () => {
  const { toCsv } = await import("@/core/analytics-export");
  const { computeAnalytics } = await import("@/core/analytics");
  it("prefixes formula-like cells and keeps negative numbers", () => {
    const data = computeAnalytics(getDb(), { days: 30 });
    data.topGames = [{ slug: "x", title: "=HYPERLINK(\"http://evil\")", coverUrl: null, userReviews: -1, userscore: null, metascore: null, interestShare: 0 }];
    const csv = toCsv(data);
    expect(csv).toContain(`top_game,"'=HYPERLINK(""http://evil"")",user_reviews,-1`);
  });
});

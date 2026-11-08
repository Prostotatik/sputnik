import { describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { gamePlatforms, games } from "@/lib/db/schema";
import { computeAnalytics } from "./analytics";

const NOW = Date.parse("2026-11-08T12:00:00Z");

function add(db: Db, slug: string, genre: string, daysAgo: number, platforms: string[], userReviews: number, metascore: number | null) {
  const releaseDate = new Date(NOW - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const { id } = db
    .insert(games)
    .values({ slug, title: slug, genres: [genre], releaseDate, metascore, userReviewCount: userReviews, metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
    .returning({ id: games.id })
    .get();
  for (const p of platforms) db.insert(gamePlatforms).values({ gameId: id, slug: p.toLowerCase(), name: p }).run();
}

describe("computeAnalytics", () => {
  it("returns empty sections for an empty library", () => {
    const a = computeAnalytics(openDb(":memory:"), { days: 30, now: NOW });
    expect(a.kpis.totalGames.value).toBe(0);
    expect(a.genreShare).toEqual([]);
    expect(a.topGames).toEqual([]);
    expect(a.combinations.venn).toBeNull();
  });

  it("computes KPIs with deltas, genre share, opportunities and platform filter", () => {
    const db = openDb(":memory:");
    add(db, "a", "Action", 2, ["PC", "PS5"], 1000, 90);
    add(db, "b", "Action", 5, ["PC"], 10, 70);
    add(db, "c", "RPG", 3, ["PC", "PS5"], 5000, 80);
    add(db, "d", "Puzzle", 40, ["Switch"], 1, 60);
    const a = computeAnalytics(db, { days: 30, now: NOW });
    expect(a.kpis.totalGames).toMatchObject({ value: 3, previous: 1, delta: 2 });
    expect(a.kpis.avgMetascore.value).toBe(80);
    expect(a.genreShare[0]).toMatchObject({ genre: "Action", count: 2 });
    expect(a.combinations.venn).toMatchObject({ a: "PC", b: "PS5", both: 2 });
    expect(a.topGames[0].slug).toBe("c");
    expect(a.opportunities.find((o) => o.genre === "RPG")?.quadrant).toBe("opportunity");
    const ps5 = computeAnalytics(db, { days: 30, platform: "PS5", now: NOW });
    expect(ps5.kpis.totalGames.value).toBe(2);
  });
});

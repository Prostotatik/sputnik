import { describe, expect, it, vi } from "vitest";
import finder from "./__fixtures__/finder.json";
import product from "./__fixtures__/product-elden-ring.json";
import criticReviews from "./__fixtures__/critic-reviews.json";
import userReviews from "./__fixtures__/user-reviews.json";
import { MetacriticClient } from "./client";
import { mapFinder, mapProduct, mapReviews, mapStats } from "./map";

describe("Metacritic mapping", () => {
  it("maps finder items", () => {
    const { items, total } = mapFinder(finder);
    expect(total).toBeGreaterThan(1000);
    expect(items[0]).toMatchObject({
      slug: "travellin-cats-advent-calendar",
      platforms: ["PC"],
      genres: ["Hidden Object"],
      metascore: null,
    });
    expect(items[0].imageUrl).toMatch(/^https:\/\/www\.metacritic\.com\/a\/img\/catalog\/provider\//);
  });

  it("maps product details with developer, genres, images, video and platforms", () => {
    const g = mapProduct(product);
    expect(g).toMatchObject({
      slug: "elden-ring",
      title: "Elden Ring",
      developer: "From Software",
      genres: ["Action RPG"],
      mustPlay: true,
      metacriticUrl: "https://www.metacritic.com/game/elden-ring/",
    });
    expect(g.description).toContain("FromSoftware");
    expect(g.coverUrl).toContain("6-1-824956-52.jpg");
    expect(g.videoUrl).toContain("jwplayer");
    const pc = g.platforms.find((p) => p.slug === "pc");
    expect(pc).toMatchObject({ name: "PC", metascore: 94 });
    expect(g.platforms.find((p) => p.slug === "xbox-one")?.metascore).toBeNull();
    expect(g.platforms.length).toBe(5);
  });

  it("maps reviews and stats", () => {
    const critic = mapReviews(criticReviews);
    expect(critic.items[0]).toMatchObject({ score: 100, author: "Areajugones", platform: "PlayStation 5" });
    const user = mapReviews(userReviews);
    expect(user.items[0].author).toBe("Mehrunes");
    expect(mapStats({ data: { item: { score: 7.6, reviewCount: 6924 } } })).toMatchObject({ score: 7.6, reviewCount: 6924 });
    expect(mapStats({})).toMatchObject({ score: null, reviewCount: 0 });
    expect(mapStats({ data: { item: { score: 0, reviewCount: 2, sentiment: "tbd" } } }).score).toBeNull();
  });
});

describe("MetacriticClient", () => {
  it("throttles sequential requests and builds See All page offsets", async () => {
    const urls: string[] = [];
    const times: number[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      times.push(Date.now());
      return new Response(JSON.stringify(finder), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new MetacriticClient({ delayMs: 50, fetchImpl });
    await Promise.all([client.browseNew(3), client.newReleases(20)]);
    expect(urls[0]).toContain("offset=48&limit=24");
    expect(urls[0]).not.toContain("metaScoreMin");
    expect(urls[1]).toContain("metaScoreMin=1");
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
  });

  it("retries on 5xx and fails on 404", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      return n === 1 ? new Response("", { status: 503 }) : new Response(JSON.stringify(product), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new MetacriticClient({ delayMs: 0, fetchImpl });
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 500 });
    await expect(client.product("elden-ring")).resolves.toMatchObject({ slug: "elden-ring" });
    vi.useRealTimers();
    const notFound = new MetacriticClient({
      delayMs: 0,
      fetchImpl: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
    });
    await expect(notFound.product("missing")).rejects.toMatchObject({ status: 404 });
  });
});

import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import type { FinderItem } from "./metacritic/map";
import {
  freshState,
  loadDailyState,
  markProcessed,
  rollover,
  saveDailyState,
  selectCandidates,
  type SelectionSource,
} from "./selection";

const item = (slug: string): FinderItem => ({
  slug,
  title: slug,
  releaseDate: null,
  platforms: [],
  genres: [],
  metascore: null,
  imageUrl: null,
});

const range = (prefix: string, from: number, n: number) => Array.from({ length: n }, (_, i) => item(`${prefix}${from + i}`));

function source(newReleases: FinderItem[], pageSize = 24): SelectionSource & { pages: number[] } {
  // See All begins with some of the new releases, then older games.
  const all = [...newReleases.slice(0, 5), ...range("b", 0, 500)];
  const pages: number[] = [];
  return {
    pages,
    newReleases: async (limit) => newReleases.slice(0, limit),
    browseNew: async (page, size = pageSize) => {
      pages.push(page);
      return { items: all.slice((page - 1) * size, page * size), total: all.length };
    },
  };
}

const opts = { quota: 20, newReleasesLimit: 20, pageSize: 24, maxPages: 10 };

describe("daily selection", () => {
  it("first run of the day takes the 20 New Releases and does not touch See All", async () => {
    const src = source(range("n", 0, 20));
    const res = await selectCandidates(freshState("2026-11-08"), src, opts);
    expect(res.candidates.map((c) => c.slug)).toEqual(range("n", 0, 20).map((i) => i.slug));
    expect(res.candidates.every((c) => c.source === "new-releases")).toBe(true);
    expect(res.state.phase).toBe("browse");
    expect(src.pages).toEqual([]);
  });

  it("later run skips games processed today and advances through See All pages", async () => {
    const src = source(range("n", 0, 20));
    const first = await selectCandidates(freshState("2026-11-08"), src, opts);
    const state = { ...first.state, processed: first.candidates.map((c) => c.slug) };
    const second = await selectCandidates(state, src, opts);
    expect(second.candidates).toHaveLength(20);
    expect(second.candidates.some((c) => c.slug.startsWith("n"))).toBe(false);
    expect(second.candidates[0]).toMatchObject({ slug: "b0", source: "browse", page: 1 });
    // Page 1 has 24 items (5 already processed) -> 19 picked, 1 from page 2.
    expect(second.pagesVisited).toEqual([1, 2]);
    expect(second.state.page).toBe(2);

    const third = await selectCandidates(
      { ...second.state, processed: [...state.processed, ...second.candidates.map((c) => c.slug)] },
      src,
      opts,
    );
    expect(third.candidates[0].slug).toBe("b20");
    expect(new Set(third.candidates.map((c) => c.slug)).size).toBe(20);
  });

  it("fills the quota from See All when New Releases are partly processed", async () => {
    const src = source(range("n", 0, 20));
    const state = { ...freshState("d"), processed: range("n", 0, 15).map((i) => i.slug) };
    const res = await selectCandidates(state, src, opts);
    expect(res.candidates.filter((c) => c.source === "new-releases")).toHaveLength(5);
    expect(res.candidates).toHaveLength(20);
  });

  it("resets on day rollover", () => {
    const old = { ...freshState("2026-11-07"), phase: "browse" as const, page: 7, processed: ["a"] };
    expect(rollover(old, "2026-11-08")).toEqual(freshState("2026-11-08"));
    expect(rollover(old, "2026-11-07")).toBe(old);
  });

  it("persists processed slugs per day", () => {
    const db = openDb(":memory:");
    saveDailyState(db, { ...freshState("2026-11-08"), phase: "browse", page: 3 });
    markProcessed(db, "2026-11-08", "elden-ring");
    expect(loadDailyState(db, "2026-11-08")).toMatchObject({ page: 3, processed: ["elden-ring"] });
    expect(loadDailyState(db, "2026-11-09")).toEqual(freshState("2026-11-09"));
  });
});

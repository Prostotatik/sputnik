import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import type { Review } from "../metacritic/map";
import { balancedSample, formatReviews, getSummary, needsSummary, saveSummary } from "./summaries";

const review = (score: number, quote: string): Review => ({ score, quote, author: null, date: null, platform: null });

describe("review summaries", () => {
  it("builds a balanced sample from both ends", () => {
    const pos = [review(10, "great"), review(9, "good"), review(9, "fun"), review(8, "nice")];
    const neg = [review(1, "bad"), review(2, "awful")];
    const sample = balancedSample(pos, neg, 4);
    expect(sample.map((r) => r.quote)).toEqual(["great", "bad", "good", "awful"]);
    expect(balancedSample(pos, [], 3)).toHaveLength(3);
  });

  it("skips when there are no reviews and regenerates only when the count changed", () => {
    expect(needsSummary(undefined, 0)).toBe(false);
    expect(needsSummary(undefined, 3)).toBe(true);
    expect(needsSummary({ reviewCount: 3 }, 3)).toBe(false);
    expect(needsSummary({ reviewCount: 3 }, 5)).toBe(true);
  });

  it("formats reviews with scores and truncates long quotes", () => {
    const text = formatReviews([review(7, "x".repeat(700))]);
    expect(text.startsWith("1. [7] ")).toBe(true);
    expect(text.length).toBeLessThan(620);
  });

  it("upserts a summary per game and kind", () => {
    const db = openDb(":memory:");
    const { id } = db
      .insert(games)
      .values({ slug: "g", title: "G", metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
      .returning({ id: games.id })
      .get();
    saveSummary(db, id, "critic", { likes: ["a"], dislikes: ["b"], verdict: "v" }, 3, "m");
    saveSummary(db, id, "critic", { likes: ["c"], dislikes: [], verdict: "w" }, 5, "m");
    expect(getSummary(db, id, "critic")).toMatchObject({ likes: ["c"], reviewCount: 5 });
    expect(getSummary(db, id, "user")).toBeUndefined();
  });
});

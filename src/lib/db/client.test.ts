import { describe, expect, it } from "vitest";
import { openDb } from "./client";
import { games } from "./schema";

describe("openDb", () => {
  it("applies migrations to an in-memory database", () => {
    const db = openDb(":memory:");
    db.insert(games)
      .values({ slug: "x", title: "X", metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
      .run();
    expect(db.select().from(games).all()).toHaveLength(1);
  });
});

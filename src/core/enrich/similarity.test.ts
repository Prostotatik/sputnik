import { describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { gamePlatforms, games, gameSimilar } from "@/lib/db/schema";
import {
  cosine,
  decodeVector,
  encodeVector,
  metadataScore,
  refreshSimilar,
  saveEmbedding,
  similarity,
  topSimilar,
  type SimilarityItem,
} from "./similarity";

const item = (id: number, genres: string[], developer: string | null, platforms: string[], vector: number[] | null = null): SimilarityItem => ({
  id,
  genres,
  developer,
  platforms,
  vector: vector ? new Float32Array(vector) : null,
});

describe("similarity", () => {
  it("round-trips vectors and computes cosine", () => {
    const v = decodeVector(encodeVector([1, 0, 0.5]));
    expect(Array.from(v)).toEqual([1, 0, 0.5]);
    expect(cosine(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBeCloseTo(1);
    expect(cosine(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
  });

  it("ranks by metadata when vectors are missing", () => {
    const target = item(1, ["Action RPG"], "FromSoftware", ["PC", "PS5"]);
    const others = [
      item(2, ["Action RPG"], "FromSoftware", ["PS5"]),
      item(3, ["Action RPG"], "Other", ["Switch"]),
      item(4, ["Puzzle"], "Other", ["iOS"]),
      target,
    ];
    const top = topSimilar(target, others, 8);
    expect(top.map((t) => t.id)).toEqual([2, 3]);
    expect(metadataScore(target, others[0])).toBeGreaterThan(0.8);
  });

  it("uses embeddings when both games have vectors", () => {
    const a = item(1, ["Puzzle"], null, [], [1, 0, 0]);
    const close = item(2, ["Shooter"], null, [], [0.99, 0.1, 0]);
    const far = item(3, ["Puzzle"], null, [], [0, 1, 0]);
    expect(similarity(a, close)).toBeGreaterThan(similarity(a, far));
  });
});

function addGame(db: Db, slug: string, genres: string[], developer: string, platform: string): number {
  const { id } = db
    .insert(games)
    .values({ slug, title: slug, genres, developer, metacriticUrl: "u", source: "browse", firstSeenAt: 1, updatedAt: 1 })
    .returning({ id: games.id })
    .get();
  db.insert(gamePlatforms).values({ gameId: id, slug: platform.toLowerCase(), name: platform }).run();
  return id;
}

describe("refreshSimilar", () => {
  it("computes neighbours for new games and adds them to existing games' lists", () => {
    const db = openDb(":memory:");
    const a = addGame(db, "a", ["Action RPG"], "From", "PC");
    const b = addGame(db, "b", ["Puzzle"], "Other", "iOS");
    refreshSimilar(db, [a, b], 8);
    expect(db.select().from(gameSimilar).all()).toHaveLength(0);

    const c = addGame(db, "c", ["Action RPG"], "From", "PC");
    saveEmbedding(db, c, "m", [1, 0], "h");
    refreshSimilar(db, [c], 8);
    const rows = db.select().from(gameSimilar).all();
    expect(rows.find((r) => r.gameId === c)?.similarId).toBe(a);
    expect(rows.find((r) => r.gameId === a)?.similarId).toBe(c);
    expect(rows.some((r) => r.gameId === b || r.similarId === b)).toBe(false);
  });
});

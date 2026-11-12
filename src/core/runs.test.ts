import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { gamePlatforms, games, libraryEvents, runNodes, runs } from "@/lib/db/schema";
import product from "./metacritic/__fixtures__/product-elden-ring.json";
import { mapProduct } from "./metacritic/map";
import { upsertGame, type ScoreBundle } from "./repo/games";
import { RunTracker, activeRun, recoverStaleRuns, requestRun, takePendingRequest } from "./runs";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

const stats = (score: number | null, reviewCount: number) => ({
  score,
  reviewCount,
  positiveCount: 0,
  neutralCount: 0,
  negativeCount: 0,
});

const scores: ScoreBundle = {
  critic: stats(96, 86),
  user: stats(8.4, 25061),
  platformUser: { pc: stats(7.6, 6924) },
};

describe("upsertGame", () => {
  it("inserts once and updates on re-visit without duplicates", () => {
    const details = mapProduct(product);
    const first = upsertGame(db, details, scores, "new-releases", 1000);
    expect(first.created).toBe(true);
    const second = upsertGame(db, { ...details, description: "updated" }, { ...scores, user: stats(8.5, 25100) }, "browse", 2000);
    expect(second).toEqual({ id: first.id, created: false });
    const rows = db.select().from(games).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ description: "updated", userscore: 8.5, updatedAt: 2000, firstSeenAt: 1000, source: "new-releases", metascore: 96 });
    const platforms = db.select().from(gamePlatforms).all();
    expect(platforms).toHaveLength(5);
    expect(platforms.find((p) => p.slug === "pc")).toMatchObject({ metascore: 94, userscore: 7.6 });
    expect(db.select().from(libraryEvents).all().map((e) => e.kind)).toEqual(["added", "updated"]);
  });
});

describe("runs", () => {
  it("allows only one active or pending run", () => {
    expect(requestRun(db).ok).toBe(true);
    expect(requestRun(db)).toMatchObject({ ok: false });
    const requestId = takePendingRequest(db);
    expect(requestId).not.toBeNull();
    RunTracker.start(db, "manual", "2026-11-08", [], requestId);
    expect(requestRun(db)).toMatchObject({ ok: false, reason: expect.stringContaining("уже идёт") });
  });

  it("recovers stale running runs on worker start", () => {
    const run = RunTracker.start(db, "schedule", "2026-11-08", [
      { id: "fetch", enabled: true },
      { id: "youtube", enabled: true },
    ]);
    run.nodeStart("fetch");
    expect(recoverStaleRuns(db)).toBe(1);
    expect(activeRun(db)).toBeUndefined();
    expect(db.select().from(runs).get()).toMatchObject({ status: "failed", note: expect.stringContaining("restarted") });
    const nodes = db.select().from(runNodes).all();
    expect(nodes.find((n) => n.nodeId === "fetch")?.status).toBe("failed");
    expect(nodes.find((n) => n.nodeId === "youtube")?.status).toBe("skipped");
  });

  it("tracks node lifecycle and redacts secrets in logs", () => {
    const run = RunTracker.start(db, "manual", "d", [
      { id: "a", enabled: true },
      { id: "b", enabled: false },
    ]);
    run.nodeStart("a", 2);
    run.nodeLog("a", "info", "called with key=AIzaSyA1234567890abcdefghijk");
    run.nodeData("a", { input: { url: "x?key=secret" } });
    run.nodeIncrement("a");
    run.nodeStart("b");
    run.finish("success");
    const nodes = db.select().from(runNodes).all();
    const a = nodes.find((n) => n.nodeId === "a")!;
    expect(a).toMatchObject({ status: "success", done: 1, total: 2 });
    expect(JSON.stringify(a)).not.toContain("AIzaSy");
    expect(JSON.stringify(a.input)).toContain("key=[redacted]");
    expect(nodes.find((n) => n.nodeId === "b")?.status).toBe("skipped");
  });
});

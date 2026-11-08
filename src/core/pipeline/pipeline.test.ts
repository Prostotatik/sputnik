import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { renderPrompt } from "./defaults";
import {
  addCustomNode,
  deleteCustomNode,
  getNode,
  listNodes,
  nodeOfType,
  resetPipeline,
  updateNode,
} from "./repo";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("pipeline rules", () => {
  it("seeds the default TZ pipeline", () => {
    const nodes = listNodes(db);
    const sync = nodeOfType(nodes, "sync")!;
    expect(sync.params).toMatchObject({ intervalMinutes: 60, gamesPerRun: 20 });
    expect(nodes.map((n) => n.type)).toEqual(
      expect.arrayContaining(["fetch_games", "critic_summary", "user_summary", "youtube_search", "transcribe", "similar"]),
    );
  });

  it("rejects games-per-run 0 and keeps the previous value", () => {
    listNodes(db);
    const res = updateNode(db, "sync", { params: { gamesPerRun: 0 } });
    expect(res.ok).toBe(false);
    expect(getNode(db, "sync")!.params).toMatchObject({ gamesPerRun: 20 });
  });

  it("rejects an unknown time zone and a too-short prompt", () => {
    listNodes(db);
    expect(updateNode(db, "sync", { params: { timezone: "Mars/Base" } }).ok).toBe(false);
    expect(updateNode(db, "reviews", { prompt: "short" }).ok).toBe(false);
  });

  it("saves a valid edit", () => {
    listNodes(db);
    const res = updateNode(db, "reviews", { prompt: "Summarise critics for {{title}} please", enabled: false });
    expect(res.ok).toBe(true);
    expect(getNode(db, "reviews")).toMatchObject({ enabled: false, prompt: "Summarise critics for {{title}} please" });
  });

  it("adds, rejects duplicate and deletes custom prompt nodes; reset removes them", () => {
    listNodes(db);
    const added = addCustomNode(db, { label: "Monetization", fieldKey: "monetization" });
    expect(added.ok).toBe(true);
    expect(addCustomNode(db, { label: "Again", fieldKey: "monetization" }).ok).toBe(false);
    expect(addCustomNode(db, { label: "Bad", fieldKey: "Bad Key" }).ok).toBe(false);
    addCustomNode(db, { label: "Audience", fieldKey: "audience" });
    expect(deleteCustomNode(db, "custom_audience")).toBe(true);
    expect(deleteCustomNode(db, "sync")).toBe(false);
    resetPipeline(db);
    expect(listNodes(db).some((n) => n.isCustom)).toBe(false);
  });

  it("renders prompt placeholders", () => {
    expect(renderPrompt("Hi {{title}} {{missing}}!", { title: "Elden Ring" })).toBe("Hi Elden Ring !");
  });
});

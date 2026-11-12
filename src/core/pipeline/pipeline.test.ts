import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { pipelineNodes } from "@/lib/db/schema";
import { DEFAULT_CUSTOM_PROMPT, defaultPipeline, renderPrompt } from "./defaults";
import { LEGACY_CUSTOM_PROMPT, LEGACY_NODES, LEGACY_PROMPTS } from "./legacy";
import {
  addCustomNode,
  deleteCustomNode,
  getNode,
  listNodes,
  nodeOfType,
  resetPipeline,
  updateNode,
  upgradeLegacyNodes,
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
    const added = addCustomNode(db, { label: "Monetization", fieldKey: "monetization", preferredModel: "gemma-4-31b-it" });
    expect(added.ok).toBe(true);
    // Custom rules run last for each game, so the graph draws them after the let's-play verdict.
    expect(added.ok && added.value).toMatchObject({ parentId: "letsplay", params: { preferredModel: "gemma-4-31b-it" } });
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

describe("upgradeLegacyNodes", () => {
  it("moves untouched English defaults to Russian and keeps user edits", () => {
    const fresh = openDb(":memory:");
    const now = Date.now();
    fresh
      .insert(pipelineNodes)
      .values(
        defaultPipeline().map((n) => ({
          ...n,
          name: LEGACY_NODES[n.id].name,
          description: LEGACY_NODES[n.id].description,
          prompt: n.id === "users" ? "My own players prompt" : (LEGACY_PROMPTS[n.id] ?? n.prompt),
          updatedAt: now,
        })),
      )
      .run();
    fresh
      .insert(pipelineNodes)
      .values({
        id: "custom_monetization",
        type: "custom_prompt",
        name: "Monetization",
        description: 'Custom field "Monetization" generated for every processed game.',
        enabled: true,
        prompt: `${LEGACY_CUSTOM_PROMPT}Monetization?`,
        params: { fieldKey: "monetization", label: "Monetization", requireReviews: false, preferredModel: "" },
        parentId: "letsplay",
        sort: 10,
        isCustom: true,
        updatedAt: now,
      })
      .run();

    const nodes = listNodes(fresh);
    const byId = (id: string) => nodes.find((n) => n.id === id)!;
    expect(byId("reviews")).toMatchObject({ name: "Сводка критиков", description: "Что нравится и не нравится критикам." });
    expect(byId("reviews").prompt).toContain("Пиши на русском языке");
    expect(byId("users").prompt).toBe("My own players prompt");
    expect(byId("custom_monetization").description).toBe("Своё поле «Monetization» для каждой обработанной игры.");
    expect(byId("custom_monetization").prompt).toBe(`${DEFAULT_CUSTOM_PROMPT}Monetization?`);
    expect(upgradeLegacyNodes(fresh)).toBe(0);
  });
});

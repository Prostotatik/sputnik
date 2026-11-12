import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/lib/db/client";
import { aiCalls, aiModelState } from "@/lib/db/schema";
import { AiCallError, AiRouter, QuotaExhaustedError, currentState, redactSecrets } from "./router";

let db: Db;
let clock: number;
const now = () => clock;

beforeEach(() => {
  db = openDb(":memory:");
  clock = Date.parse("2026-11-08T12:00:00Z");
});

const ok = (model: { id: string }) => Promise.resolve({ value: model.id, inputTokens: 100, outputTokens: 20 });

describe("AiRouter", () => {
  it("uses the first text model and logs the call", async () => {
    const router = new AiRouter(db, { openai: false, now });
    const res = await router.route({ capability: "text", purpose: "t", estimatedTokens: 100, call: ok });
    expect(res.model).toBe("gemini-3.5-flash-lite");
    const calls = db.select().from(aiCalls).all();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ status: "ok", inputTokens: 100, outputTokens: 20 });
  });

  it("falls back when the preferred model hit its daily limit", async () => {
    db.insert(aiModelState)
      .values({ model: "gemini-3.5-flash-lite", dayBucket: "2026-11-08", dayRequests: 500, minuteBucket: "" })
      .run();
    const router = new AiRouter(db, { openai: false, now });
    const res = await router.route({ capability: "text", purpose: "t", estimatedTokens: 100, call: ok });
    expect(res.model).toBe("gemini-3.1-flash-lite");
  });

  it("resets daily counters on a new Pacific day", () => {
    db.insert(aiModelState)
      .values({ model: "gemini-3.5-flash-lite", dayBucket: "2026-11-07", dayRequests: 500, minuteBucket: "" })
      .run();
    expect(currentState(db, "gemini-3.5-flash-lite", clock).dayRequests).toBe(0);
  });

  it("rotates to the next model on 429 and cools the failed one down", async () => {
    const router = new AiRouter(db, { openai: false, now });
    const res = await router.route({
      capability: "text",
      purpose: "t",
      estimatedTokens: 100,
      call: (m) =>
        m.id === "gemini-3.5-flash-lite" ? Promise.reject(new AiCallError("429", "rate_limit")) : ok(m),
    });
    expect(res.model).toBe("gemini-3.1-flash-lite");
    expect(currentState(db, "gemini-3.5-flash-lite", clock).cooldownUntil).toBeGreaterThan(clock);
    const statuses = db.select().from(aiCalls).all().map((c) => c.status);
    expect(statuses).toEqual(["rate_limited", "ok"]);
  });

  it("persists counters across router instances (restart)", async () => {
    await new AiRouter(db, { openai: false, now }).route({ capability: "text", purpose: "t", estimatedTokens: 10, call: ok });
    await new AiRouter(db, { openai: false, now }).route({ capability: "text", purpose: "t", estimatedTokens: 10, call: ok });
    expect(currentState(db, "gemini-3.5-flash-lite", clock).dayRequests).toBe(2);
  });

  it("skips low-TPM models for large requests and only uses video-capable models for video", async () => {
    const router = new AiRouter(db, { openai: false, now });
    const seen: string[] = [];
    await expect(
      router.route({
        capability: "video",
        purpose: "v",
        estimatedTokens: 20_000,
        call: (m) => {
          seen.push(m.id);
          return Promise.reject(new AiCallError("bad", "invalid"));
        },
      }),
    ).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(seen.some((id) => id.startsWith("gemma"))).toBe(false);
  });

  it("throws QuotaExhausted without OpenAI when every model is exhausted", async () => {
    for (const model of ["gemini-embedding-2", "gemini-embedding-001"]) {
      db.insert(aiModelState).values({ model, dayBucket: "2026-11-08", dayRequests: 1000, minuteBucket: "" }).run();
    }
    const router = new AiRouter(db, { openai: false, now });
    await expect(router.route({ capability: "embedding", purpose: "e", estimatedTokens: 10, call: ok })).rejects.toBeInstanceOf(
      QuotaExhaustedError,
    );
    const withOpenAi = new AiRouter(db, { openai: true, now });
    const res = await withOpenAi.route({ capability: "embedding", purpose: "e", estimatedTokens: 10, call: ok });
    expect(res.model).toBe("text-embedding-3-small");
  });

  it("never leaves the allow-list", async () => {
    const router = new AiRouter(db, { openai: false, now, allow: ["gemma-4-31b-it"] });
    const fail = () => Promise.reject(new AiCallError("busy", "overloaded"));
    expect((await router.route({ capability: "text", purpose: "t", estimatedTokens: 10, call: ok })).model).toBe("gemma-4-31b-it");
    await expect(router.route({ capability: "text", purpose: "t", estimatedTokens: 10, call: fail })).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(new Set(db.select().from(aiCalls).all().map((c) => c.model))).toEqual(new Set(["gemma-4-31b-it"]));
  });

  it("redacts API keys from error text", () => {
    expect(redactSecrets("bad AIzaSyA1234567890abcdefghijk key ?key=abc&x=1")).toBe("bad [redacted] key ?key=[redacted]&x=1");
  });
});

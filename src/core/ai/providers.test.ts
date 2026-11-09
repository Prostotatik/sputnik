import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { aiCalls } from "@/lib/db/schema";
import { parseModelJson } from "./json";
import { modelSpec } from "./catalog";
import { embed, generate } from "./providers";
import { AiService } from "./service";
import { AiRouter } from "./router";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const r = responses.shift()!;
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

describe("Gemini provider", () => {
  it("sends the key in a header, never in the URL or body", async () => {
    process.env["GOOGLE-AI-KEY"] = "AIzaTESTKEY_abcdefghijklmnopqrstu";
    const calls = stubFetch([
      { status: 200, body: { candidates: [{ content: { parts: [{ text: "hi" }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } } },
    ]);
    const res = await generate(modelSpec("gemini-3.5-flash-lite")!, { prompt: "hello" });
    expect(res).toEqual({ value: "hi", inputTokens: 5, outputTokens: 1 });
    expect(calls[0].url).not.toContain("key=");
    expect(String(calls[0].init.body)).not.toContain("AIzaTESTKEY");
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIzaTESTKEY_abcdefghijklmnopqrstu");
  });

  it("routes through GEMINI_BASE_URL with the gateway token when configured", async () => {
    process.env["GOOGLE-AI-KEY"] = "AIzaTESTKEY_abcdefghijklmnopqrstu";
    process.env.GEMINI_BASE_URL = "https://gateway.example/v1/acct/gw/google-ai-studio/v1beta/";
    process.env.CF_AIG_TOKEN = "cf-test-token";
    try {
      const calls = stubFetch([
        { status: 200, body: { candidates: [{ content: { parts: [{ text: "hi" }] } }] } },
        { status: 200, body: { embedding: { values: [0.1, 0.2] } } },
      ]);
      await generate(modelSpec("gemini-3.5-flash-lite")!, { prompt: "hello" });
      await embed(modelSpec("gemini-embedding-001")!, "hello");
      expect(calls[0].url).toBe("https://gateway.example/v1/acct/gw/google-ai-studio/v1beta/models/gemini-3.5-flash-lite:generateContent");
      expect(calls[1].url).toBe("https://gateway.example/v1/acct/gw/google-ai-studio/v1beta/models/gemini-embedding-001:embedContent");
      for (const c of calls) {
        const headers = c.init.headers as Record<string, string>;
        expect(headers["cf-aig-authorization"]).toBe("Bearer cf-test-token");
        expect(headers["x-goog-api-key"]).toBe("AIzaTESTKEY_abcdefghijklmnopqrstu");
      }
    } finally {
      delete process.env.GEMINI_BASE_URL;
      delete process.env.CF_AIG_TOKEN;
    }
  });

  it("calls Google directly without a gateway header by default", async () => {
    process.env["GOOGLE-AI-KEY"] = "AIzaTESTKEY_abcdefghijklmnopqrstu";
    const calls = stubFetch([{ status: 200, body: { candidates: [{ content: { parts: [{ text: "hi" }] } }] } }]);
    await generate(modelSpec("gemini-3.5-flash-lite")!, { prompt: "hello" });
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect((calls[0].init.headers as Record<string, string>)["cf-aig-authorization"]).toBeUndefined();
  });

  it("maps 429 to a rate-limit error with retry delay and redacts keys in messages", async () => {
    process.env["GOOGLE-AI-KEY"] = "AIzaTESTKEY_abcdefghijklmnopqrstu";
    stubFetch([
      { status: 429, body: { error: { message: "quota for key AIzaTESTKEY_abcdefghijklmnopqrstu", details: [{ retryDelay: "12s" }] } } },
    ]);
    await expect(generate(modelSpec("gemini-3.5-flash-lite")!, { prompt: "x" })).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 12000,
      message: expect.not.stringContaining("AIzaTESTKEY"),
    });
  });
});

describe("AiService.json", () => {
  it("retries on another model when JSON does not match the schema and logs both calls", async () => {
    process.env["GOOGLE-AI-KEY"] = "AIzaTESTKEY_abcdefghijklmnopqrstu";
    stubFetch([
      { status: 200, body: { candidates: [{ content: { parts: [{ text: "not json" }] } }] } },
      { status: 200, body: { candidates: [{ content: { parts: [{ text: '```json\n{"a": 1}\n```' }] } }] } },
    ]);
    const db = openDb(":memory:");
    const ai = new AiService(db, new AiRouter(db, { openai: false }));
    const res = await ai.json({ purpose: "test" }, "p", { type: "object" }, z.object({ a: z.number() }));
    expect(res.value).toEqual({ a: 1 });
    expect(res.model).toBe("gemini-3.1-flash-lite");
    const logged = db.select().from(aiCalls).all();
    expect(logged.map((c) => c.status)).toEqual(["error", "ok"]);
    expect(JSON.stringify(logged)).not.toContain("AIzaTESTKEY");
  });
});

describe("parseModelJson", () => {
  it("handles fences and prose", () => {
    expect(parseModelJson('Sure! {"x": [1,2]} done')).toEqual({ x: [1, 2] });
    expect(parseModelJson("```\n[1]\n```")).toEqual([1]);
    expect(() => parseModelJson("nothing")).toThrow();
  });
});

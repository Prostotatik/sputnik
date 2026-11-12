import { describe, expect, it } from "vitest";
import { isRussian, translateDescription } from "./translate";
import type { AiService } from "../ai/service";

describe("isRussian", () => {
  it("detects mostly Cyrillic text", () => {
    expect(isRussian("Ролевой экшен от FromSoftware в мире Elden Ring")).toBe(true);
    expect(isRussian("An action RPG by FromSoftware")).toBe(false);
    expect(isRussian("123 !!!")).toBe(false);
  });
});

describe("translateDescription", () => {
  it("keeps the rule's model choice and strips quotes", async () => {
    let preferred: string | undefined;
    const ai = { text: async (ctx: { preferredModel?: string }) => ((preferred = ctx.preferredModel), { value: " «Перевод» ", model: "m" }) } as unknown as AiService;
    expect(await translateDescription(ai, { purpose: "translate", preferredModel: "" }, "Text")).toEqual({ value: "Перевод", model: "m" });
    expect(preferred).toBe("");
  });
});

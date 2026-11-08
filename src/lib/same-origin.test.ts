import { describe, expect, it } from "vitest";
import { isAllowedMutation } from "./same-origin";

const h = (init: Record<string, string>) => new Headers(init);

describe("isAllowedMutation", () => {
  it("allows reads and same-origin writes", () => {
    expect(isAllowedMutation("GET", h({ "sec-fetch-site": "cross-site" }), "localhost:3000")).toBe(true);
    expect(isAllowedMutation("POST", h({ "sec-fetch-site": "same-origin", origin: "http://localhost:3000" }), "localhost:3000")).toBe(true);
    expect(isAllowedMutation("POST", h({}), "localhost:3000")).toBe(true);
  });

  it("blocks cross-site writes", () => {
    expect(isAllowedMutation("POST", h({ "sec-fetch-site": "cross-site" }), "localhost:3000")).toBe(false);
    expect(isAllowedMutation("PATCH", h({ origin: "https://evil.example" }), "localhost:3000")).toBe(false);
  });
});

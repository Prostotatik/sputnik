import { describe, expect, it } from "vitest";
import { allowedHostnames, isAllowedRequest } from "./same-origin";

const h = (init: Record<string, string>) => new Headers(init);
const local = allowedHostnames("");

describe("isAllowedRequest", () => {
  it("allows local reads and same-origin writes", () => {
    expect(isAllowedRequest("GET", h({ host: "localhost:3000" }), local)).toBe(true);
    expect(isAllowedRequest("POST", h({ host: "localhost:3000", "sec-fetch-site": "same-origin", origin: "http://localhost:3000" }), local)).toBe(true);
    expect(isAllowedRequest("POST", h({ host: "127.0.0.1:3000" }), local)).toBe(true);
  });

  it("blocks cross-site writes", () => {
    expect(isAllowedRequest("POST", h({ host: "localhost:3000", "sec-fetch-site": "cross-site" }), local)).toBe(false);
    expect(isAllowedRequest("PATCH", h({ host: "localhost:3000", origin: "https://evil.example" }), local)).toBe(false);
  });

  it("blocks DNS rebinding: unknown Host even when Origin matches it", () => {
    expect(isAllowedRequest("GET", h({ host: "evil.example:3000" }), local)).toBe(false);
    expect(isAllowedRequest("POST", h({ host: "evil.example:3000", origin: "http://evil.example:3000" }), local)).toBe(false);
  });

  it("accepts hosts listed in SPUTNIK_ALLOWED_HOSTS", () => {
    const allowed = allowedHostnames("sputnik.lan, 192.168.1.10");
    expect(isAllowedRequest("POST", h({ host: "sputnik.lan:3000", origin: "http://sputnik.lan:3000" }), allowed)).toBe(true);
    expect(isAllowedRequest("GET", h({ host: "192.168.1.10:3000" }), allowed)).toBe(true);
  });
});

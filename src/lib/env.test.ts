import { describe, expect, it } from "vitest";
import { googleApiKey } from "./env";

describe("env", () => {
  it("reads the dash-named GOOGLE-AI-KEY variable", () => {
    process.env["GOOGLE-AI-KEY"] = "test-key";
    expect(googleApiKey()).toBe("test-key");
  });
});

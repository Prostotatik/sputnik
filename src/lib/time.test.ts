import { describe, expect, it } from "vitest";
import { dayKey } from "./time";

describe("dayKey", () => {
  it("uses the requested time zone", () => {
    const d = new Date("2026-11-08T22:30:00Z");
    expect(dayKey(d, "UTC")).toBe("2026-11-08");
    expect(dayKey(d, "Europe/Moscow")).toBe("2026-11-09");
  });
});

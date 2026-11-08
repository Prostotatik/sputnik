import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import { FAILED_RETRY_MS, nextRunAt } from "./schedule";

describe("nextRunAt", () => {
  it("runs immediately with no history, hourly after success, and retries soon after a failure", () => {
    const db = openDb(":memory:");
    expect(nextRunAt(db, 1_000)).toBe(1_000);
    db.insert(runs).values({ trigger: "schedule", status: "success", startedAt: 0, finishedAt: 60_000, day: "d" }).run();
    expect(nextRunAt(db)).toBe(60 * 60_000);
    db.insert(runs).values({ trigger: "schedule", status: "failed", startedAt: 3_600_000, finishedAt: 3_603_000, day: "d" }).run();
    expect(nextRunAt(db)).toBe(3_603_000 + FAILED_RETRY_MS);
  });
});

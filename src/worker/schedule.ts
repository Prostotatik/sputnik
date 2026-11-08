import { desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import { listNodes, nodeOfType } from "@/core/pipeline/repo";

/** Retry delay after a failed run (e.g. no network right after the machine woke up). */
export const FAILED_RETRY_MS = 5 * 60_000;

/** Next scheduled start: interval after the last run started, or sooner when the last run failed. */
export function nextRunAt(db: Db, now = Date.now()): number {
  const sync = nodeOfType(listNodes(db), "sync")!;
  const last = db.select({ startedAt: runs.startedAt, finishedAt: runs.finishedAt, status: runs.status }).from(runs).orderBy(desc(runs.id)).get();
  if (!last) return now;
  const regular = last.startedAt + sync.params.intervalMinutes * 60_000;
  if (last.status === "failed") return Math.min(regular, (last.finishedAt ?? last.startedAt) + FAILED_RETRY_MS);
  return regular;
}

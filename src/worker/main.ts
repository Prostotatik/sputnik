import { desc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { runs, workerHeartbeat } from "@/lib/db/schema";
import { AiService } from "@/core/ai/service";
import { MetacriticClient } from "@/core/metacritic/client";
import { ensurePipeline, listNodes, nodeOfType } from "@/core/pipeline/repo";
import { activeRun, recoverStaleRuns, takePendingRequest } from "@/core/runs";
import { executeRun } from "./runner";

const POLL_MS = 2_000;
const HEARTBEAT_MS = 5_000;

const log = (msg: string) => console.log(`[worker ${new Date().toISOString()}] ${msg}`);

/** Next scheduled start: interval after the last scheduled or manual run started, or now. */
export function nextRunAt(db: Db, now = Date.now()): number {
  const sync = nodeOfType(listNodes(db), "sync")!;
  const last = db.select({ startedAt: runs.startedAt }).from(runs).orderBy(desc(runs.id)).get();
  return last ? last.startedAt + sync.params.intervalMinutes * 60_000 : now;
}

function beat(db: Db, startedAt: number, state: "idle" | "running"): void {
  const row = { id: 1, pid: process.pid, startedAt, beatAt: Date.now(), state, nextRunAt: nextRunAt(db) };
  db.insert(workerHeartbeat).values(row).onConflictDoUpdate({ target: workerHeartbeat.id, set: row }).run();
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const db = getDb();
  ensurePipeline(db);
  const recovered = recoverStaleRuns(db);
  if (recovered) log(`Marked ${recovered} stale run(s) as failed`);

  const startedAt = Date.now();
  let busy = false;
  const deps = () => {
    const sync = nodeOfType(listNodes(db), "sync")!;
    return { db, mc: new MetacriticClient({ delayMs: sync.params.requestDelayMs }), ai: new AiService(db) };
  };

  const run = async (trigger: "schedule" | "manual", requestId: number | null) => {
    busy = true;
    beat(db, startedAt, "running");
    log(`Starting ${trigger} run`);
    try {
      const id = await executeRun(deps(), trigger, requestId);
      const r = db.select().from(runs).where(eq(runs.id, id)).get();
      log(`Run #${id} ${r?.status}: added ${r?.added}, updated ${r?.updated}, errors ${r?.errors}`);
    } catch (err) {
      log(`Run crashed: ${(err as Error).stack ?? err}`);
    } finally {
      busy = false;
      beat(db, startedAt, "idle");
    }
  };

  beat(db, startedAt, "idle");
  const heartbeat = setInterval(() => beat(db, startedAt, busy ? "running" : "idle"), HEARTBEAT_MS);
  if (once) {
    await run("manual", takePendingRequest(db));
    clearInterval(heartbeat);
    return;
  }
  log(`Worker started (pid ${process.pid}); next run at ${new Date(nextRunAt(db)).toISOString()}`);

  const tick = async () => {
    if (busy || activeRun(db)) return;
    const requestId = takePendingRequest(db);
    if (requestId !== null) return run("manual", requestId);
    if (Date.now() >= nextRunAt(db)) return run("schedule", null);
  };
  const loop = () => {
    tick()
      .catch((err) => log(`Tick failed: ${(err as Error).message}`))
      .finally(() => setTimeout(loop, POLL_MS));
  };
  loop();

  const stop = () => {
    log("Stopping");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

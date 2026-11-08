import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  runEvents,
  runNodes,
  runRequests,
  runs,
  type NodeLog,
  type NodeStatus,
  type Run,
  type RunStatus,
} from "@/lib/db/schema";
import { redactSecrets } from "./ai/router";

const MAX_NODE_LOGS = 200;

export function activeRun(db: Db): Run | undefined {
  return db.select().from(runs).where(eq(runs.status, "running")).orderBy(desc(runs.id)).get();
}

/** Marks runs left `running` by a crashed worker as failed. Returns how many were recovered. */
export function recoverStaleRuns(db: Db, now = Date.now()): number {
  const stale = db.select({ id: runs.id }).from(runs).where(eq(runs.status, "running")).all();
  for (const { id } of stale) {
    db.update(runs)
      .set({ status: "failed", finishedAt: now, note: "Worker restarted while the run was active", currentStep: null })
      .where(eq(runs.id, id))
      .run();
    db.update(runNodes)
      .set({ status: "failed", finishedAt: now })
      .where(and(eq(runNodes.runId, id), eq(runNodes.status, "running")))
      .run();
    db.update(runNodes)
      .set({ status: "skipped" })
      .where(and(eq(runNodes.runId, id), eq(runNodes.status, "queued")))
      .run();
  }
  return stale.length;
}

export type RequestRunResult = { ok: true; requestId: number } | { ok: false; reason: string };

/** Queues a manual run unless a run is active or already requested. */
export function requestRun(db: Db, now = Date.now()): RequestRunResult {
  return db.transaction((tx) => {
    const running = tx.select({ id: runs.id }).from(runs).where(eq(runs.status, "running")).get();
    if (running) return { ok: false as const, reason: `Run #${running.id} is already in progress` };
    const pending = tx.select({ id: runRequests.id }).from(runRequests).where(eq(runRequests.status, "pending")).get();
    if (pending) return { ok: false as const, reason: "A run has already been requested and will start shortly" };
    const { id } = tx.insert(runRequests).values({ requestedAt: now, status: "pending" }).returning({ id: runRequests.id }).get();
    return { ok: true as const, requestId: id };
  });
}

export function takePendingRequest(db: Db): number | null {
  const pending = db.select().from(runRequests).where(eq(runRequests.status, "pending")).get();
  if (!pending) return null;
  db.update(runRequests).set({ status: "taken" }).where(eq(runRequests.id, pending.id)).run();
  return pending.id;
}

/** Records the lifecycle of one run: node statuses, logs, events and counters. */
export class RunTracker {
  readonly id: number;

  private constructor(
    private readonly db: Db,
    id: number,
  ) {
    this.id = id;
  }

  static start(db: Db, trigger: "schedule" | "manual", day: string, nodes: { id: string; enabled: boolean }[], requestId?: number | null): RunTracker {
    const { id } = db
      .insert(runs)
      .values({ trigger, status: "running", startedAt: Date.now(), day, currentStep: "Starting" })
      .returning({ id: runs.id })
      .get();
    if (nodes.length) {
      db.insert(runNodes)
        .values(nodes.map((n) => ({ runId: id, nodeId: n.id, status: (n.enabled ? "queued" : "skipped") as NodeStatus })))
        .run();
    }
    if (requestId) db.update(runRequests).set({ runId: id }).where(eq(runRequests.id, requestId)).run();
    const tracker = new RunTracker(db, id);
    tracker.event("info", `Started new run (${trigger})`);
    return tracker;
  }

  update(patch: Partial<Pick<Run, "phase" | "total" | "processed" | "added" | "updated" | "errors" | "currentStep" | "currentGame">>): void {
    this.db.update(runs).set(patch).where(eq(runs.id, this.id)).run();
  }

  get(): Run {
    return this.db.select().from(runs).where(eq(runs.id, this.id)).get()!;
  }

  event(level: "info" | "success" | "warn" | "error", message: string, nodeId?: string, detail?: string): void {
    this.db
      .insert(runEvents)
      .values({ runId: this.id, ts: Date.now(), level, nodeId: nodeId ?? null, message: redactSecrets(message), detail: detail ? redactSecrets(detail) : null })
      .run();
  }

  private node(nodeId: string) {
    return this.db.select().from(runNodes).where(and(eq(runNodes.runId, this.id), eq(runNodes.nodeId, nodeId))).get();
  }

  nodeStart(nodeId: string, total = 0): void {
    const n = this.node(nodeId);
    if (!n || n.status === "skipped") return;
    if (n.status !== "running") {
      this.db
        .update(runNodes)
        .set({ status: "running", startedAt: n.startedAt ?? Date.now(), total: Math.max(n.total, total) })
        .where(and(eq(runNodes.runId, this.id), eq(runNodes.nodeId, nodeId)))
        .run();
    }
  }

  nodeData(nodeId: string, data: { input?: unknown; output?: unknown; done?: number; total?: number }): void {
    const set: Record<string, unknown> = {};
    if (data.input !== undefined) set.input = sanitize(data.input);
    if (data.output !== undefined) set.output = sanitize(data.output);
    if (data.done !== undefined) set.done = data.done;
    if (data.total !== undefined) set.total = data.total;
    if (Object.keys(set).length) {
      this.db.update(runNodes).set(set).where(and(eq(runNodes.runId, this.id), eq(runNodes.nodeId, nodeId))).run();
    }
  }

  nodeIncrement(nodeId: string): void {
    const n = this.node(nodeId);
    if (n) this.nodeData(nodeId, { done: n.done + 1 });
  }

  nodeLog(nodeId: string, level: NodeLog["level"], message: string): void {
    const n = this.node(nodeId);
    if (!n) return;
    const logs = [...n.logs, { ts: Date.now(), level, message: redactSecrets(message) }].slice(-MAX_NODE_LOGS);
    this.db.update(runNodes).set({ logs }).where(and(eq(runNodes.runId, this.id), eq(runNodes.nodeId, nodeId))).run();
  }

  nodeFinish(nodeId: string, status: Extract<NodeStatus, "success" | "failed" | "skipped">): void {
    const n = this.node(nodeId);
    if (!n || n.status !== "running") return;
    this.db
      .update(runNodes)
      .set({ status, finishedAt: Date.now() })
      .where(and(eq(runNodes.runId, this.id), eq(runNodes.nodeId, nodeId)))
      .run();
  }

  finish(status: Exclude<RunStatus, "running">, note?: string): void {
    const now = Date.now();
    this.db.update(runs).set({ status, finishedAt: now, note: note ?? null, currentStep: null, currentGame: null }).where(eq(runs.id, this.id)).run();
    // Nodes that never ran are skipped; nodes still running are closed with the run status.
    this.db
      .update(runNodes)
      .set({ status: "skipped" })
      .where(and(eq(runNodes.runId, this.id), eq(runNodes.status, "queued")))
      .run();
    this.db
      .update(runNodes)
      .set({ status: status === "success" ? "success" : "failed", finishedAt: now })
      .where(and(eq(runNodes.runId, this.id), eq(runNodes.status, "running")))
      .run();
    const run = this.get();
    this.event(
      status === "success" ? "success" : "error",
      status === "success" ? "Worker finished successfully" : `Run failed${note ? `: ${note}` : ""}`,
      undefined,
      `Added: ${run.added}, Updated: ${run.updated}, Errors: ${run.errors}`,
    );
  }
}

/** Keeps node input/output small and free of secrets. */
function sanitize(value: unknown): unknown {
  const text = redactSecrets(JSON.stringify(value ?? null));
  if (text.length <= 20_000) return JSON.parse(text);
  return { truncated: true, preview: text.slice(0, 20_000) };
}

import { db, json } from "@/lib/api";
import { runList } from "@/core/queries";
import { requestRun } from "@/core/runs";

export const dynamic = "force-dynamic";

export function GET() {
  return json(runList(db()));
}

/** Run Now: queues a manual run; 409 when a run is active or already requested. */
export function POST() {
  const res = requestRun(db());
  return res.ok ? json(res, { status: 202 }) : json({ error: res.reason }, { status: 409 });
}

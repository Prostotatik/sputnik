import { db, json } from "@/lib/api";
import { statusSnapshot } from "@/core/queries";

export const dynamic = "force-dynamic";

/** Plain JSON status snapshot: the polling fallback when the SSE stream is buffered by a proxy. */
export function GET() {
  return json(statusSnapshot(db()));
}

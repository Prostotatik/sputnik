import { db, json } from "@/lib/api";
import { monitoringView } from "@/core/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return json(monitoringView(db()));
}

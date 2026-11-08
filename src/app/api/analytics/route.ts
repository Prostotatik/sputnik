import { db, intParam, json } from "@/lib/api";
import { computeAnalytics } from "@/core/analytics";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  return json(
    computeAnalytics(db(), {
      days: intParam(url.searchParams.get("days"), 30, 0, 3650),
      platform: url.searchParams.get("platform") || null,
    }),
  );
}

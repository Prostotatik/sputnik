import { db, intParam } from "@/lib/api";
import { computeAnalytics } from "@/core/analytics";
import { toCsv } from "@/core/analytics-export";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const data = computeAnalytics(db(), {
    days: intParam(url.searchParams.get("days"), 30, 0, 3650),
    platform: url.searchParams.get("platform") || null,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="sputnik-analytics-${stamp}.json"` },
    });
  }
  return new Response(toCsv(data), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sputnik-analytics-${stamp}.csv"` },
  });
}

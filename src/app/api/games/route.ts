import { db, intParam, json } from "@/lib/api";
import { listGames, type GameSort } from "@/core/queries";

export const dynamic = "force-dynamic";

const SORTS: GameSort[] = ["metascore", "userscore", "release", "updated"];

export function GET(req: Request) {
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") as GameSort | null;
  return json(
    listGames(db(), {
      q: url.searchParams.get("q") ?? undefined,
      platform: url.searchParams.get("platform") || undefined,
      sort: sort && SORTS.includes(sort) ? sort : "metascore",
      offset: intParam(url.searchParams.get("offset"), 0, 0, 1_000_000),
      limit: intParam(url.searchParams.get("limit"), 20, 1, 100),
    }),
  );
}

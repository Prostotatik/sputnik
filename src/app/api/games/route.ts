import { db, intParam, json } from "@/lib/api";
import { DEFAULT_GAME_SORT, GAME_SORTS, listGames, type GameSort } from "@/core/queries";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") as GameSort | null;
  return json(
    listGames(db(), {
      q: url.searchParams.get("q") ?? undefined,
      platform: url.searchParams.get("platform") || undefined,
      sort: sort && GAME_SORTS.includes(sort) ? sort : DEFAULT_GAME_SORT,
      offset: intParam(url.searchParams.get("offset"), 0, 0, 1_000_000),
      limit: intParam(url.searchParams.get("limit"), 20, 1, 100),
    }),
  );
}

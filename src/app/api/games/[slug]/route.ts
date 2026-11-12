import { db, json } from "@/lib/api";
import { gameDetail } from "@/core/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/games/[slug]">) {
  const { slug } = await ctx.params;
  const detail = gameDetail(db(), slug);
  return detail ? json(detail) : json({ error: "Игра не найдена" }, { status: 404 });
}

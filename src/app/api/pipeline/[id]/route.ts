import { db, json, readJson } from "@/lib/api";
import { deleteCustomNode, resetNode, updateNode, type NodePatch } from "@/core/pipeline/repo";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/pipeline/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(req);
  const patch: NodePatch = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.prompt === "string" || body.prompt === null) patch.prompt = body.prompt as string | null;
  if (body.params && typeof body.params === "object") patch.params = body.params as Record<string, unknown>;
  const res = updateNode(db(), id, patch);
  return res.ok ? json(res.value) : json({ errors: res.errors }, { status: res.errors[0] === "Шаг не найден" ? 404 : 400 });
}

/** { action: "reset" } restores one default node. */
export async function POST(req: Request, ctx: RouteContext<"/api/pipeline/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(req);
  if (body.action !== "reset") return json({ errors: ["Неизвестное действие"] }, { status: 400 });
  const res = resetNode(db(), id);
  return res.ok ? json(res.value) : json({ errors: res.errors }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/pipeline/[id]">) {
  const { id } = await ctx.params;
  return deleteCustomNode(db(), id) ? json({ ok: true }) : json({ errors: ["Удалить можно только своё правило"] }, { status: 400 });
}

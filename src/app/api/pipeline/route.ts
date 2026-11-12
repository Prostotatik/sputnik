import { db, intParam, json, readJson } from "@/lib/api";
import { addCustomNode, resetPipeline } from "@/core/pipeline/repo";
import { workersView } from "@/core/queries";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  return json(workersView(db(), runId ? intParam(runId, 0, 0, Number.MAX_SAFE_INTEGER) : undefined));
}

/** { action: "reset" } restores defaults; { action: "add", label, fieldKey, prompt?, parentId? } adds a custom node. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (body.action === "reset") {
    resetPipeline(db());
    return json({ ok: true });
  }
  if (body.action === "add") {
    const res = addCustomNode(db(), {
      label: String(body.label ?? ""),
      fieldKey: String(body.fieldKey ?? ""),
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      parentId: typeof body.parentId === "string" ? body.parentId : undefined,
      requireReviews: body.requireReviews === true,
      preferredModel: typeof body.preferredModel === "string" ? body.preferredModel : undefined,
    });
    return res.ok ? json(res.value, { status: 201 }) : json({ errors: res.errors }, { status: 400 });
  }
  return json({ errors: ["Неизвестное действие"] }, { status: 400 });
}

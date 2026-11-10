import { db, json, readJson } from "@/lib/api";
import { AiService } from "@/core/ai/service";
import { previewCustomField } from "@/core/enrich/custom";
import { validatePrompt } from "@/core/pipeline/types";

export const dynamic = "force-dynamic";

/** { slug, prompt, preferredModel? }: runs a custom rule prompt on one game once, without saving the answer. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const preferredModel = typeof body.preferredModel === "string" && body.preferredModel ? body.preferredModel : undefined;
  const errors = [...(slug ? [] : ["slug: pick a game to test on"]), ...validatePrompt("custom_prompt", prompt)];
  if (errors.length) return json({ errors }, { status: 400 });
  try {
    const res = await previewCustomField(db(), new AiService(db()), { slug, prompt, preferredModel });
    return res ? json(res) : json({ errors: ["Game not found"] }, { status: 404 });
  } catch (err) {
    return json({ errors: [`AI call failed: ${(err as Error).message}`] }, { status: 502 });
  }
}

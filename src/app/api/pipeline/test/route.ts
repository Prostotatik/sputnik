import { db, json, readJson } from "@/lib/api";
import { modelSpec } from "@/core/ai/catalog";
import { AiService } from "@/core/ai/service";
import { previewCustomField, RULE_TEST_DAILY_LIMIT, ruleTestsToday } from "@/core/enrich/custom";
import { validatePrompt } from "@/core/pipeline/types";

export const dynamic = "force-dynamic";

/** Tests in flight in this process. The check and the reservation run in one synchronous step, so parallel requests cannot overshoot the cap. */
let inFlight = 0;
const MAX_PARALLEL = 2;

/** { slug, prompt, preferredModel? }: runs a custom rule prompt on one game once, without saving the answer. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  // Only catalog text models; anything else falls back to the rotation.
  const preferredModel = typeof body.preferredModel === "string" && modelSpec(body.preferredModel)?.capabilities.includes("text") ? body.preferredModel : undefined;
  const errors = [...(slug ? [] : ["slug: pick a game to test on"]), ...validatePrompt("custom_prompt", prompt)];
  if (errors.length) return json({ errors }, { status: 400 });
  if (inFlight >= MAX_PARALLEL) return json({ errors: ["Another rule test is running. Try again in a few seconds."] }, { status: 429 });
  if (ruleTestsToday(db()) + inFlight >= RULE_TEST_DAILY_LIMIT) {
    return json({ errors: [`Rule tests are limited to ${RULE_TEST_DAILY_LIMIT} AI calls a day. Save the rule and let the next run fill it in.`] }, { status: 429 });
  }
  inFlight++;
  try {
    const res = await previewCustomField(db(), new AiService(db()), { slug, prompt, preferredModel });
    return res ? json(res) : json({ errors: ["Game not found"] }, { status: 404 });
  } catch (err) {
    return json({ errors: [`AI call failed: ${(err as Error).message}`] }, { status: 502 });
  } finally {
    inFlight--;
  }
}

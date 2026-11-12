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
  const errors = [...(slug ? [] : ["slug: выберите игру для проверки"]), ...validatePrompt("custom_prompt", prompt)];
  if (errors.length) return json({ errors }, { status: 400 });
  if (inFlight >= MAX_PARALLEL) return json({ errors: ["Уже идёт другая проверка правила. Попробуйте через несколько секунд."] }, { status: 429 });
  if (ruleTestsToday(db()) + inFlight >= RULE_TEST_DAILY_LIMIT) {
    return json({ errors: [`Проверки правил ограничены ${RULE_TEST_DAILY_LIMIT} вызовами ИИ в день. Сохраните правило, и следующий запуск заполнит поле сам.`] }, { status: 429 });
  }
  inFlight++;
  try {
    const res = await previewCustomField(db(), new AiService(db()), { slug, prompt, preferredModel });
    return res ? json(res) : json({ errors: ["Игра не найдена"] }, { status: 404 });
  } catch (err) {
    return json({ errors: [`Вызов ИИ не удался: ${(err as Error).message}`] }, { status: 502 });
  } finally {
    inFlight--;
  }
}

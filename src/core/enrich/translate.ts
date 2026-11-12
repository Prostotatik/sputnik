import type { AiContext, AiService } from "../ai/service";

/** Free Gemma first: it has a large daily quota, so translation never eats the Gemini quota the summaries rely on. */
export const TRANSLATE_MODEL = "gemma-4-31b-it";

const CYRILLIC = /[а-яё]/i;

/** True when the text is already (mostly) Russian, so translating it again would waste a call. */
export function isRussian(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return false;
  const cyr = letters.filter((ch) => CYRILLIC.test(ch)).length;
  // Russian texts about games carry many Latin names, so a third of Cyrillic letters is enough.
  return cyr / letters.length > 0.3;
}

export function translatePrompt(text: string): string {
  return `Переведи на русский язык описание видеоигры со страницы Metacritic.
Сохрани смысл, тон и абзацы. Названия игр, студий, персонажей и платформ оставь как в оригинале.
Ответь только переводом, без пояснений и кавычек.

Описание:
${text}`;
}

/** Translates a Metacritic game description into Russian. */
export async function translateDescription(
  ai: AiService,
  ctx: AiContext,
  text: string,
): Promise<{ value: string; model: string }> {
  const res = await ai.text({ ...ctx, preferredModel: ctx.preferredModel || TRANSLATE_MODEL }, translatePrompt(text.slice(0, 4000)));
  const value = res.value.trim().replace(/^["«]|["»]$/g, "");
  if (!value) throw new Error("пустой перевод");
  return { value, model: res.model };
}

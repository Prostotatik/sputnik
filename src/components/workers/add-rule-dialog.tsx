"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { DEFAULT_CUSTOM_PROMPT } from "@/core/pipeline/defaults";
import { Dialog } from "../ui";
import { Field, humanError, inputCls, ModelSelect, PARAM_INFO, PromptEditor, TestOnGame, Toggle, type ModelOption } from "./rule-editor";

const TEMPLATES: { label: string; question: string; requireReviews: boolean }[] = [
  { label: "Монетизация", question: "как игра зарабатывает (модель цены, DLC, микротранзакции) и как к этому относятся игроки?", requireReviews: true },
  { label: "Целевая аудитория", question: "кто целевая аудитория этой игры (возраст, тип игрока, платформы) и почему?", requireReviews: false },
  { label: "Конкуренты", question: "назови 3 известные игры, с которыми конкурирует эта, и чем она от них отличается.", requireReviews: false },
  { label: "Рекламный крючок", question: "напиши рекламный слоган в одно предложение для игроков в похожие игры.", requireReviews: false },
];

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Storage key from the field name; Russian names are transliterated ("Монетизация" → "monetizatsiya"). */
export const toKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);

/** Creates a custom rule: an AI prompt that runs for every processed game and adds a field to its card. */
export function AddRuleDialog({ models, onAdded }: { models: ModelOption[]; onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_CUSTOM_PROMPT);
  const [requireReviews, setRequireReviews] = useState(false);
  const [preferredModel, setPreferredModel] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fieldKey = toKey(label);

  const close = () => {
    setOpen(false);
    setErrors([]);
  };
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setLabel(t.label);
    setPrompt(`${DEFAULT_CUSTOM_PROMPT}${t.question}`);
    setRequireReviews(t.requireReviews);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", label: label.trim(), fieldKey, prompt, requireReviews, preferredModel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setErrors(body.errors ?? ["Не удалось добавить правило"]);
      setLabel("");
      setPrompt(DEFAULT_CUSTOM_PROMPT);
      setRequireReviews(false);
      setPreferredModel("");
      close();
      onAdded(body.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px]">
        <Plus className="h-4 w-4 text-dim" strokeWidth={1.5} /> Добавить правило
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Новое правило"
        subtitle="Промпт, который выполняется для каждой обработанной игры после сводок отзывов и вердикта летсплея. Ответ становится новым полем в карточке игры."
        className="sm:w-[min(760px,calc(100vw-32px))]"
        footer={
          <>
            <button type="button" onClick={close} className="btn-secondary h-9 px-4 text-[13px]">
              Отмена
            </button>
            <button type="submit" form="add-rule-form" disabled={busy || !label.trim()} className="btn-primary h-9 px-4 text-[13px] font-medium">
              Создать правило
            </button>
          </>
        }
      >
        <form
          id="add-rule-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <p className="mb-1.5 text-xs text-muted">Начните с примера</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => applyTemplate(t)} className="rounded-md border border-line bg-panel-3 px-2.5 py-1 text-xs text-muted hover:border-line-2 hover:text-fg">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label={PARAM_INFO.label.label} help={fieldKey ? `Хранится под ключом «${fieldKey}».` : "Например: Монетизация."}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Монетизация" required maxLength={60} className={inputCls} autoFocus />
          </Field>
          <PromptEditor value={prompt} onChange={setPrompt} type="custom_prompt" rows={10} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label={PARAM_INFO.requireReviews.label} help={PARAM_INFO.requireReviews.help} checked={requireReviews} onChange={setRequireReviews} />
            <Field label={PARAM_INFO.preferredModel.label} help={PARAM_INFO.preferredModel.help}>
              <ModelSelect value={preferredModel} onChange={setPreferredModel} models={models} capability="text" />
            </Field>
          </div>
          <TestOnGame prompt={prompt} preferredModel={preferredModel} />
          {errors.length > 0 && (
            <ul role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-xs text-bad">
              {errors.map((e) => (
                <li key={e}>{humanError(e)}</li>
              ))}
            </ul>
          )}
        </form>
      </Dialog>
    </>
  );
}

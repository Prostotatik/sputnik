"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { DEFAULT_CUSTOM_PROMPT } from "@/core/pipeline/defaults";
import { Dialog } from "../ui";
import { Field, inputCls, ModelSelect, PARAM_INFO, PromptEditor, TestOnGame, Toggle, type ModelOption } from "./rule-editor";

const TEMPLATES: { label: string; question: string; requireReviews: boolean }[] = [
  { label: "Monetization", question: "how does the game make money (price model, DLC, microtransactions), and how do players react to it?", requireReviews: true },
  { label: "Target audience", question: "who is the target audience of this game (age, player type, platforms), and why?", requireReviews: false },
  { label: "Comparable titles", question: "name 3 well-known games this one competes with, and what sets it apart from them.", requireReviews: false },
  { label: "Marketing hook", question: "write a one-sentence ad hook for this game aimed at players of similar games.", requireReviews: false },
];

const toKey = (label: string) =>
  label
    .toLowerCase()
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
      if (!res.ok) return setErrors(body.errors ?? ["Could not add the rule"]);
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
        <Plus className="h-4 w-4 text-dim" strokeWidth={1.5} /> Add rule
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="New rule"
        subtitle="A prompt that runs for every processed game, after the review summaries and the let's-play verdict. The answer becomes a new field on the game card."
        className="sm:w-[min(760px,calc(100vw-32px))]"
        footer={
          <>
            <button type="button" onClick={close} className="btn-secondary h-9 px-4 text-[13px]">
              Cancel
            </button>
            <button type="submit" form="add-rule-form" disabled={busy || !label.trim()} className="btn-primary h-9 px-4 text-[13px] font-medium">
              Create rule
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
            <p className="mb-1.5 text-xs text-muted">Start from an example</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => applyTemplate(t)} className="rounded-md border border-line bg-panel-3 px-2.5 py-1 text-xs text-muted hover:border-line-2 hover:text-fg">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label={PARAM_INFO.label.label} help={fieldKey ? `Stored as “${fieldKey}”.` : "For example: Monetization."}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Monetization" required maxLength={60} className={inputCls} autoFocus />
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
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </form>
      </Dialog>
    </>
  );
}

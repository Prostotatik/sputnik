"use client";

import clsx from "clsx";
import { Bot, CalendarDays, Clock3, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PipelineNode } from "@/core/pipeline/types";
import { PROMPT_NODE_TYPES } from "@/core/pipeline/types";
import type { NodeLog, RunNode } from "@/lib/db/schema";
import { clock, clockSeconds, duration } from "@/lib/client/format";
import { EmptyState } from "../shell";
import { NODE_META, STATUS_META, YoutubeGlyph } from "./node-meta";
import { Field, humanError, inputCls, ModelSelect, PARAM_INFO, PromptEditor, TestOnGame, Toggle, type ModelOption } from "./rule-editor";

export const TABS = ["Overview", "Rules", "Input", "Output", "Logs"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = { Overview: "Обзор", Rules: "Правила", Input: "Вход", Output: "Выход", Logs: "Логи" };

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <EmptyState title="В этом запуске ничего не записано" />;
  return <pre className="max-h-[260px] overflow-auto rounded-lg bg-deep p-3 text-xs leading-relaxed text-muted">{JSON.stringify(value, null, 2)}</pre>;
}

function paramText(value: unknown): string {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value === "" || value === null || value === undefined) return "Автоматически";
  return String(value);
}

function RulesForm({ node, models, onSaved, onDeleted }: { node: PipelineNode; models: ModelOption[]; onSaved: () => void; onDeleted: () => void }) {
  // The stored rules; "dirty" compares against them, so it clears once a save is refetched.
  const initial = { enabled: node.enabled, prompt: node.prompt ?? "", params: node.params as Record<string, unknown> };
  const [enabled, setEnabled] = useState(initial.enabled);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [params, setParams] = useState<Record<string, unknown>>(initial.params);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasPrompt = PROMPT_NODE_TYPES.includes(node.type);
  const dirty = enabled !== initial.enabled || prompt !== initial.prompt || JSON.stringify(params) !== JSON.stringify(initial.params);
  const setParam = (key: string, value: unknown) => setParams((p) => ({ ...p, [key]: value }));

  const call = async (method: string, url: string, body?: unknown) => {
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? `Запрос не удался (${res.status})`]);
        return null;
      }
      setErrors([]);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const data = await call("PATCH", `/api/pipeline/${node.id}`, { enabled, prompt: hasPrompt ? prompt : undefined, params, name: node.type === "custom_prompt" ? String(params.label ?? node.name) : undefined });
    if (data) {
      setSaved("Сохранено. Следующий запуск пойдёт по этим правилам.");
      onSaved();
    }
  };
  const reset = async () => {
    const data = await call("POST", `/api/pipeline/${node.id}`, { action: "reset" });
    if (data) {
      setEnabled(data.enabled);
      setPrompt(data.prompt ?? "");
      setParams(data.params);
      setSaved("Стандартные правила восстановлены.");
      onSaved();
    }
  };
  const remove = async () => {
    if (!window.confirm(`Удалить своё правило «${node.name}»? Его ответы пропадут из карточек игр.`)) return;
    if (await call("DELETE", `/api/pipeline/${node.id}`)) onDeleted();
  };

  const entries = Object.entries(params).filter(([key]) => key !== "preferredModel");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {node.type !== "sync" && <Toggle label="Выполнять этот шаг" help="Выключенные шаги пропускаются в следующем запуске, собранные данные остаются." checked={enabled} onChange={setEnabled} />}
      {entries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => {
            const info = PARAM_INFO[key] ?? { label: key, help: "" };
            if (typeof value === "boolean") {
              return (
                <div key={key} className="sm:col-span-2">
                  <Toggle label={info.label} help={info.help} checked={value} onChange={(v) => setParam(key, v)} />
                </div>
              );
            }
            return (
              <Field key={key} label={info.label} help={info.help} className={clsx(typeof value === "string" && String(value).length > 24 && "sm:col-span-2")}>
                <input
                  type={typeof value === "number" ? "number" : "text"}
                  value={String(value ?? "")}
                  onChange={(e) => setParam(key, typeof value === "number" ? Number(e.target.value) : e.target.value)}
                  className={clsx(inputCls, ["queryTemplate", "excludePattern", "fieldKey", "timezone"].includes(key) && "font-mono text-xs")}
                />
              </Field>
            );
          })}
        </div>
      )}
      {"preferredModel" in params && (
        <Field label={PARAM_INFO.preferredModel.label} help={PARAM_INFO.preferredModel.help}>
          <ModelSelect value={String(params.preferredModel ?? "")} onChange={(v) => setParam("preferredModel", v)} models={models} capability={node.type === "transcribe" ? "video" : "text"} />
        </Field>
      )}
      {hasPrompt && <PromptEditor value={prompt} onChange={setPrompt} type={node.type} />}
      {node.type === "custom_prompt" && <TestOnGame prompt={prompt} preferredModel={String(params.preferredModel ?? "")} />}
      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-xs text-bad">
          {errors.map((e) => (
            <li key={e}>{humanError(e)}</li>
          ))}
        </ul>
      )}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-2 rounded-b-[var(--radius-card)] border-t border-line bg-panel px-5 py-3">
        <button type="submit" disabled={busy || !dirty} className="btn-primary flex h-9 items-center gap-2 px-4 text-[13px]">
          <Save className="h-4 w-4" strokeWidth={1.5} /> Сохранить правила
        </button>
        {!node.isCustom && (
          <button type="button" onClick={reset} disabled={busy} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px]">
            <RotateCcw className="h-4 w-4 text-dim" strokeWidth={1.5} /> Вернуть стандартные
          </button>
        )}
        {node.isCustom && (
          <button type="button" onClick={remove} disabled={busy} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px] text-bad">
            <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Удалить правило
          </button>
        )}
        <span role="status" className={clsx("ml-auto text-xs", saved ? "text-good" : "text-dim")}>
          {saved ?? (dirty ? "Есть несохранённые изменения" : "")}
        </span>
      </div>
    </form>
  );
}

function RulesSummary({ node, onEdit }: { node: PipelineNode; onEdit: () => void }) {
  const entries = Object.entries(node.params as Record<string, unknown>);
  return (
    <div className="mt-4 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Текущие правила</p>
        <button type="button" onClick={onEdit} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-2">
          <Pencil className="h-3 w-3" /> Изменить
        </button>
      </div>
      {entries.length > 0 && (
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex min-w-0 justify-between gap-3">
              <dt className="truncate text-dim">{PARAM_INFO[key]?.label ?? key}</dt>
              <dd className="truncate font-mono text-fg" title={paramText(value)}>
                {paramText(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {node.prompt && <p className="mt-3 line-clamp-3 rounded-md bg-deep p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-line text-muted">{node.prompt}</p>}
    </div>
  );
}

export function NodeDetails({
  node,
  exec,
  runId,
  now,
  models,
  tab,
  onTab,
  onChanged,
  onDeleted,
}: {
  node: PipelineNode | null;
  exec: RunNode | null;
  runId: number | null;
  now: number;
  models: ModelOption[];
  tab: Tab;
  onTab: (t: Tab) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  if (!node) return <EmptyState title="Выберите шаг" className="card min-h-[420px]">Нажмите на шаг в графе, чтобы увидеть его последний запуск и поменять правила.</EmptyState>;
  const meta = NODE_META[node.type] ?? NODE_META.custom_prompt;
  const Icon = meta.icon;
  const status = node.enabled ? (exec?.status ?? "idle") : "skipped";
  const st = STATUS_META[status];
  const ms = exec?.startedAt ? (exec.finishedAt ?? (exec.status === "running" ? now : exec.startedAt)) - exec.startedAt : null;
  const index = runId ? `#${runId}.${node.id}` : node.id;

  return (
    <section className="card scroll-mt-4 p-5" aria-labelledby="node-title">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-medium">Подробности шага</h2>
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className={clsx("h-1.5 w-1.5 rounded-full", status === "running" && "live-dot")} style={{ background: st.color }} />
          {node.enabled ? st.label : "Выключен"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-panel-3 text-muted">
          {node.type === "youtube_search" ? <YoutubeGlyph className="h-5 w-7" /> : <Icon className="h-6 w-6" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1">
          <p id="node-title" className="text-xl font-medium">
            {node.name}
          </p>
          <p className="text-[13px] text-muted">
            {meta.kind} · {index}
          </p>
        </div>
        {tab !== "Rules" && (
          <button type="button" onClick={() => onTab("Rules")} className="btn-secondary flex h-9 shrink-0 items-center gap-2 px-3 text-[13px]">
            <Pencil className="h-3.5 w-3.5 text-dim" strokeWidth={1.5} /> Изменить правила
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Подробности шага" className="mt-5 flex gap-6 overflow-x-auto border-b border-line text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className={clsx("-mb-px border-b-2 pb-2.5 whitespace-nowrap", tab === t ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === "Overview" && (
          <div>
            <dl className="grid grid-cols-3 gap-4 text-xs text-muted">
              <div>
                <dt>Длительность</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <Clock3 className="h-4 w-4 text-muted" /> {duration(ms)}
                </dd>
              </div>
              <div>
                <dt>Начало</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <CalendarDays className="h-4 w-4 text-muted" /> {clock(exec?.startedAt)}
                </dd>
              </div>
              <div>
                <dt>Агент</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <Bot className="h-4 w-4 text-dim" strokeWidth={1.5} /> {meta.agent}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] text-muted">{node.description}</p>
            {exec && exec.total > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>Прогресс</span>
                  <span>
                    {exec.done} / {exec.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (exec.done / exec.total) * 100)}%` }} />
                </div>
              </div>
            )}
            <RulesSummary node={node} onEdit={() => onTab("Rules")} />
          </div>
        )}
        {tab === "Rules" && <RulesForm key={node.id} node={node} models={models} onSaved={onChanged} onDeleted={onDeleted} />}
        {tab === "Input" && <JsonBlock value={exec?.input} />}
        {tab === "Output" && <JsonBlock value={exec?.output} />}
        {tab === "Logs" &&
          ((exec?.logs ?? []).length === 0 ? (
            <EmptyState title="В этом запуске логов нет" />
          ) : (
            <ol className="max-h-[260px] space-y-1.5 overflow-auto font-mono text-xs">
              {(exec?.logs as NodeLog[]).map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 text-dim">{clockSeconds(l.ts)}</span>
                  <span className={clsx(l.level === "error" ? "text-bad" : l.level === "warn" ? "text-warn" : "text-muted")}>{l.message}</span>
                </li>
              ))}
            </ol>
          ))}
      </div>
    </section>
  );
}

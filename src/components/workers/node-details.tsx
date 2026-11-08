"use client";

import clsx from "clsx";
import { Bot, CalendarDays, Clock3, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PipelineNode } from "@/core/pipeline/types";
import { PROMPT_NODE_TYPES } from "@/core/pipeline/types";
import type { NodeLog, RunNode } from "@/lib/db/schema";
import { clock, duration } from "@/lib/client/format";
import { EmptyState } from "../shell";
import { NODE_META, STATUS_META, YoutubeGlyph } from "./node-meta";

const TABS = ["Overview", "Input", "Output", "Logs", "Settings"] as const;
type Tab = (typeof TABS)[number];

const PARAM_LABELS: Record<string, string> = {
  intervalMinutes: "Run every (minutes)",
  gamesPerRun: "Games per run",
  timezone: "Day boundary time zone",
  requestDelayMs: "Delay between Metacritic requests (ms)",
  newReleasesLimit: "Games taken from New Releases",
  browsePageSize: "See All page size",
  maxBrowsePages: "Max See All pages per run",
  userScoresPerPlatform: "Fetch Userscore per platform",
  maxReviews: "Reviews sampled per summary",
  preferredModel: "Preferred model (blank = rotation)",
  topK: "Similar games per game",
  useEmbeddings: "Use semantic embeddings",
  queryTemplate: "YouTube search query",
  minDurationMinutes: "Minimum video length (minutes)",
  excludePattern: "Exclude titles matching (regex)",
  maxCandidates: "Videos to try per game",
  requireReviews: "Only games that have reviews",
  startOffsetSec: "Transcribe from second",
  clipSeconds: "Clip length (seconds)",
  dailyBudgetMinutes: "Daily video budget (minutes)",
  minTranscriptChars: "Minimum narration length (chars)",
  fieldKey: "Field key",
  label: "Field label",
};

const PLACEHOLDERS: Record<string, string> = {
  critic_summary: "{{title}} {{genres}} {{developer}} {{reviews}}",
  user_summary: "{{title}} {{genres}} {{developer}} {{reviews}}",
  letsplay_summary: "{{title}} {{channel}} {{videoTitle}} {{transcript}}",
  insights: "{{metrics}}",
  custom_prompt: "{{title}} {{genres}} {{platforms}} {{developer}} {{description}} {{metascore}} {{userscore}} {{criticVerdict}} {{userVerdict}} {{letsplay}}",
  transcribe: "(video segment is attached automatically)",
};

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <EmptyState title="Nothing recorded for this run" />;
  return <pre className="max-h-[260px] overflow-auto rounded-lg bg-black/40 p-3 text-[11.5px] leading-relaxed text-fg/80">{JSON.stringify(value, null, 2)}</pre>;
}

function Settings({ node, onSaved, onDeleted }: { node: PipelineNode; onSaved: () => void; onDeleted: () => void }) {
  const [enabled, setEnabled] = useState(node.enabled);
  const [prompt, setPrompt] = useState(node.prompt ?? "");
  const [params, setParams] = useState<Record<string, unknown>>(node.params as Record<string, unknown>);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasPrompt = PROMPT_NODE_TYPES.includes(node.type);

  const call = async (method: string, url: string, body?: unknown) => {
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? `Request failed (${res.status})`]);
        return null;
      }
      setErrors([]);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const data = await call("PATCH", `/api/pipeline/${node.id}`, { enabled, prompt: hasPrompt ? prompt : undefined, params });
    if (data) {
      setSaved("Saved. The next run uses these rules.");
      onSaved();
    }
  };
  const reset = async () => {
    const data = await call("POST", `/api/pipeline/${node.id}`, { action: "reset" });
    if (data) {
      setEnabled(data.enabled);
      setPrompt(data.prompt ?? "");
      setParams(data.params);
      setSaved("Restored default rules.");
      onSaved();
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the custom rule "${node.name}"? Stored values stay hidden from game cards.`)) return;
    if (await call("DELETE", `/api/pipeline/${node.id}`)) onDeleted();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {node.type !== "sync" && (
        <label className="flex items-center justify-between gap-3 text-[13px]">
          <span>Run this step</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(params).map(([key, value]) => (
          <label key={key} className="flex flex-col gap-1.5 text-[12px] text-muted">
            {PARAM_LABELS[key] ?? key}
            {typeof value === "boolean" ? (
              <input type="checkbox" checked={value} onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.checked }))} className="h-4 w-4 accent-[var(--color-accent)]" />
            ) : (
              <input
                type={typeof value === "number" ? "number" : "text"}
                value={String(value ?? "")}
                onChange={(e) => setParams((p) => ({ ...p, [key]: typeof value === "number" ? Number(e.target.value) : e.target.value }))}
                className="h-9 rounded-lg border border-line-2 bg-black/30 px-3 text-[13px] text-fg focus:border-accent focus:outline-none"
              />
            )}
          </label>
        ))}
      </div>
      {hasPrompt && (
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="rounded-lg border border-line-2 bg-black/30 p-3 font-[inherit] text-[12.5px] leading-relaxed text-fg focus:border-accent focus:outline-none"
          />
          <span className="text-[11px] text-dim">Placeholders: {PLACEHOLDERS[node.type]}</span>
        </label>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-[12px] text-bad">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {saved && <p role="status" className="text-[12px] text-good">{saved}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex h-9 items-center gap-2 px-4 text-[12.5px]">
          <Save className="h-3.5 w-3.5" /> Save rules
        </button>
        {!node.isCustom && (
          <button type="button" onClick={reset} disabled={busy} className="pill flex h-9 items-center gap-2 px-4 text-[12.5px] text-muted hover:text-fg">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </button>
        )}
        {node.isCustom && (
          <button type="button" onClick={remove} disabled={busy} className="pill flex h-9 items-center gap-2 px-4 text-[12.5px] text-bad hover:border-bad/50">
            <Trash2 className="h-3.5 w-3.5" /> Delete rule
          </button>
        )}
      </div>
    </form>
  );
}

export function NodeDetails({
  node,
  exec,
  runId,
  now,
  onChanged,
  onDeleted,
}: {
  node: PipelineNode | null;
  exec: RunNode | null;
  runId: number | null;
  now: number;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  if (!node) return <EmptyState title="Select a node" className="card min-h-[420px]">Click a node in the graph to inspect its last execution and edit its rules.</EmptyState>;
  const meta = NODE_META[node.type] ?? NODE_META.custom_prompt;
  const Icon = meta.icon;
  const status = node.enabled ? (exec?.status ?? "idle") : "skipped";
  const st = STATUS_META[status];
  const ms = exec?.startedAt ? (exec.finishedAt ?? (exec.status === "running" ? now : exec.startedAt)) - exec.startedAt : null;
  const index = runId ? `#${runId}.${node.id}` : node.id;

  return (
    <section className="card p-5" aria-labelledby="node-title">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-semibold">Node Details</h2>
        <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]" style={{ color: st.color, borderColor: `${st.color}55`, background: `${st.color}14` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
          {node.enabled ? st.label : "Disabled"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-line-2" style={{ background: meta.tile }}>
          {node.type === "youtube_search" ? <YoutubeGlyph className="h-7 w-10" /> : <Icon className="h-9 w-9" style={{ color: meta.color }} strokeWidth={1.6} />}
        </span>
        <div>
          <p id="node-title" className="text-[22px] font-medium tracking-[-0.01em]">{node.name}</p>
          <p className="text-[13px] text-muted">{index}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Node details" className="mt-5 flex gap-6 overflow-x-auto border-b border-line text-[14px]">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx("-mb-px border-b-2 pb-2.5 whitespace-nowrap", tab === t ? "border-accent-2 text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === "Overview" && (
          <div>
            <dl className="grid grid-cols-3 gap-4 text-[12px] text-muted">
              <div>
                <dt>Duration</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <Clock3 className="h-4 w-4 text-muted" /> {duration(ms)}
                </dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <CalendarDays className="h-4 w-4 text-muted" /> {clock(exec?.startedAt)}
                </dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-fg">
                  <Bot className="h-4 w-4 text-violet" /> {meta.agent}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[13.5px] text-fg/85">{node.description}</p>
            {exec && exec.total > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                  <span>Progress</span>
                  <span>
                    {exec.done} / {exec.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <div className="h-full rounded-full bg-good transition-[width] duration-500" style={{ width: `${Math.min(100, (exec.done / exec.total) * 100)}%` }} />
                </div>
              </div>
            )}
            {node.prompt && (
              <div className="mt-4">
                <p className="mb-1.5 text-[12px] text-muted">Prompt</p>
                <p className="line-clamp-4 rounded-lg bg-black/40 p-3 text-[12px] leading-relaxed whitespace-pre-line text-fg/75">{node.prompt}</p>
              </div>
            )}
          </div>
        )}
        {tab === "Input" && <JsonBlock value={exec?.input} />}
        {tab === "Output" && <JsonBlock value={exec?.output} />}
        {tab === "Logs" &&
          ((exec?.logs ?? []).length === 0 ? (
            <EmptyState title="No log lines for this run" />
          ) : (
            <ol className="max-h-[260px] space-y-1.5 overflow-auto font-mono text-[11.5px]">
              {(exec?.logs as NodeLog[]).map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 text-dim">{new Date(l.ts).toLocaleTimeString("en-GB")}</span>
                  <span className={clsx(l.level === "error" ? "text-bad" : l.level === "warn" ? "text-warn" : "text-fg/80")}>{l.message}</span>
                </li>
              ))}
            </ol>
          ))}
        {tab === "Settings" && <Settings key={node.id} node={node} onSaved={onChanged} onDeleted={onDeleted} />}
      </div>
    </section>
  );
}

"use client";

import clsx from "clsx";
import { Plus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkersData } from "@/core/queries";
import type { Run } from "@/lib/db/schema";
import { clock, duration, num } from "@/lib/client/format";
import { useJson, useNow } from "@/lib/client/hooks";
import { EmptyState, RunNowButton, SearchBox, TelemetryDot, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle, Select } from "../ui";
import { NODE_META, STATUS_META } from "./node-meta";
import { NodeDetails } from "./node-details";
import { PipelineGraph, type NodeExec } from "./pipeline-graph";

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card min-w-40 flex-1 px-4 py-4 max-sm:basis-full">
      <p className="text-[13px] whitespace-nowrap text-muted">{label}</p>
      <p className="mt-2 text-2xl font-medium whitespace-nowrap tabular-nums">{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-dim">{sub}</p>}
    </div>
  );
}

function AddRule({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const submit = async () => {
    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", label, fieldKey: fieldKey || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }),
    });
    const body = await res.json();
    if (!res.ok) return setErrors(body.errors ?? ["Could not add the rule"]);
    setOpen(false);
    setLabel("");
    setFieldKey("");
    setErrors([]);
    onAdded(body.id);
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px]">
        <Plus className="h-4 w-4 text-dim" strokeWidth={1.5} /> Add rule
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="card flex flex-wrap items-end gap-3 p-3"
    >
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Field shown on game cards
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Monetization" required className="h-9 w-48 rounded-lg border border-line bg-panel-2 px-3 text-[13px] text-fg focus:border-line-2 focus:outline-none" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Key (optional)
        <input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="monetization" className="h-9 w-36 rounded-lg border border-line bg-panel-2 px-3 text-[13px] text-fg focus:border-line-2 focus:outline-none" />
      </label>
      <button type="submit" className="btn-primary h-9 px-4 text-[13px] font-medium">
        Add rule
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg">
        <X className="h-4 w-4" />
      </button>
      {errors.length > 0 && <p role="alert" className="w-full text-xs text-bad">{errors.join("; ")}</p>}
    </form>
  );
}

const LEGEND_KINDS = ["sync", "fetch_games", "parse_game", "similar", "critic_summary", "youtube_search", "transcribe", "insights", "custom_prompt"] as const;

export function WorkersView() {
  const { status } = useStatus();
  const now = useNow(1000);
  const [mode, setMode] = useState<"live" | "history">("live");
  const [historyRun, setHistoryRun] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>("fetch");
  const [filter, setFilter] = useState("");
  const [showAllEvents, setShowAllEvents] = useState(false);

  const runId = mode === "history" && historyRun ? historyRun : "";
  // Live mode refetches whenever the streamed run state changes.
  const liveKey = status?.run ? `${status.run.id}:${status.run.status}:${status.run.processed}:${status.nodes.map((n) => n.status + n.done).join("")}` : "none";
  const view = useJson<WorkersData>(`/api/pipeline?${runId ? `runId=${runId}` : `live=${encodeURIComponent(liveKey)}`}`);
  const runs = useJson<Run[]>(`/api/runs?k=${status?.run?.id ?? 0}:${status?.run?.status ?? ""}`);

  const data = view.data;
  const exec = useMemo(() => {
    const m = new Map<string, NodeExec>();
    for (const e of data?.exec ?? []) m.set(e.nodeId, e);
    return m;
  }, [data]);

  const nodes = useMemo(() => {
    const all = data?.nodes ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    const keep = new Set(all.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
    // Keep ancestors so the filtered graph stays connected.
    for (const id of [...keep]) {
      let p = all.find((n) => n.id === id)?.parentId;
      while (p) {
        keep.add(p);
        p = all.find((n) => n.id === p)?.parentId ?? null;
      }
    }
    return all.filter((n) => keep.has(n.id));
  }, [data, filter]);

  const run = data?.run ?? null;
  const selected = data?.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedExec = data?.exec.find((e) => e.nodeId === selectedId) ?? null;
  const enabledCount = (data?.nodes ?? []).filter((n) => n.enabled).length;
  const runningCount = (data?.exec ?? []).filter((e) => e.status === "running").length;
  const recentRuns = runs.data ?? [];
  const events = data?.events ?? [];

  const resetAll = async () => {
    if (!window.confirm("Reset every node to the default rules from the specification? Custom rules will be removed.")) return;
    await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    view.refresh();
  };

  return (
    <>
      <TopBar
        left={<SearchBox value={filter} onChange={setFilter} placeholder="Search steps" />}
        right={
          <>
            <AddRule
              onAdded={(id) => {
                setSelectedId(id);
                view.refresh();
              }}
            />
            <button type="button" onClick={resetAll} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px]">
              <RotateCcw className="h-4 w-4 text-dim" strokeWidth={1.5} /> Reset to defaults
            </button>
            <RunNowButton />
          </>
        }
      />

      <div className="relative z-10 px-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="mt-3 text-[32px] leading-[1.15] font-medium">Workers</h1>
            <p className="mt-1 text-sm text-muted">The collection pipeline and the rules each step follows</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-3 max-lg:basis-full lg:max-w-[700px] lg:flex-nowrap">
            <Kpi label="Steps running" value={`${runningCount} of ${enabledCount}`} sub="enabled steps" />
            <Kpi label="Processed today" value={num(status?.totals.processedToday ?? 0)} sub="games" />
            <Kpi label="Last run" value={clock(status?.run?.startedAt)} sub={status?.run ? (status.run.status === "failed" ? "failed" : status.run.status === "running" ? "in progress" : "finished") : "no runs yet"} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="pill flex p-0.5" role="tablist" aria-label="Mode">
            {(["live", "history"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  if (m === "history" && !historyRun && recentRuns[0]) setHistoryRun(String(recentRuns[0].id));
                }}
                className={clsx("flex h-8 items-center gap-2 rounded-lg px-4 text-[13px] transition-colors", mode === m ? "bg-panel-3 text-fg" : "text-muted hover:text-fg")}
              >
                {m === "live" && <TelemetryDot state={status?.active ? "running" : status?.worker.online ? "idle" : "offline"} />}
                {m === "live" ? "Live" : "History"}
              </button>
            ))}
          </div>
          {mode === "history" && (
            <Select
              label="Run"
              value={historyRun}
              onChange={setHistoryRun}
              options={recentRuns.map((r) => ({
                value: String(r.id),
                label: `Run #${r.id}, ${new Date(r.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, ${r.status}`,
              }))}
              className="w-72"
            />
          )}
          {run && (
            <p className="font-mono text-xs text-dim">
              Run #{run.id}, {run.trigger}, {run.processed}/{run.total} games, {run.added} added, {run.updated} updated
              {run.errors ? `, ${run.errors} errors` : ""}
            </p>
          )}
        </div>

        <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_160px]">
          <div className="relative min-w-0">
            {nodes.length ? (
              <PipelineGraph nodes={nodes} exec={exec} selectedId={selectedId} onSelect={setSelectedId} now={now} runLabel={run ? `#${run.id}` : null} />
            ) : (
              <EmptyState title={view.loading ? "Loading pipeline…" : "No nodes match this search"} className="h-[520px]" />
            )}
          </div>
          <aside className="card hidden h-fit space-y-2 p-4 text-[13px] lg:block" aria-label="Legend">
            {LEGEND_KINDS.map((t) => {
              const m = NODE_META[t];
              return (
                <p key={t} className="flex items-center gap-2.5 text-muted">
                  <m.icon className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.5} />
                  {m.kind}
                </p>
              );
            })}
            <p className="border-t border-line pt-3 text-xs text-dim">Status</p>
            {(["running", "queued", "success", "failed"] as const).map((s) => (
              <p key={s} className="flex items-center gap-2.5 text-muted">
                <span className="mx-[5px] h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].color }} />
                {{ running: "Running", queued: "Pending", success: "Success", failed: "Failed" }[s]}
              </p>
            ))}
          </aside>
        </div>

        <div className="mt-4 grid gap-5 pb-8 lg:grid-cols-[1.1fr_1fr]">
          <NodeDetails
            node={selected}
            exec={selectedExec}
            runId={run?.id ?? null}
            now={now}
            onChanged={view.refresh}
            onDeleted={() => {
              setSelectedId("sync");
              view.refresh();
            }}
          />
          <section className="card p-5" aria-labelledby="history-title">
            <CardTitle
              right={
                events.length > 6 && (
                  <button type="button" onClick={() => setShowAllEvents((s) => !s)} className="text-xs text-dim transition-colors hover:text-fg">
                    {showAllEvents ? "Show less" : "See all"}
                  </button>
                )
              }
            >
              <span id="history-title">Run history</span>
            </CardTitle>
            {events.length === 0 ? (
              <EmptyState title="No runs yet">Press Run now or wait for the hourly schedule.</EmptyState>
            ) : (
              <ol className="relative mt-4 space-y-4">
                <span className="absolute top-2 bottom-2 left-[3px] w-px bg-line-2" aria-hidden />
                {(showAllEvents ? events : events.slice(0, 6)).map((e) => (
                  <li key={e.id} className="relative flex gap-4">
                    <span
                      aria-hidden
                      className={clsx(
                        "z-10 mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ring-4 ring-panel",
                        e.level === "error" ? "bg-bad" : e.level === "warn" ? "bg-warn" : e.level === "success" ? "bg-good" : "bg-dim",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm break-words text-fg">{e.message}</p>
                      <p className="mt-0.5 font-mono text-xs break-words text-dim">
                        {clock(e.ts)}
                        {e.detail ? `, ${e.detail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {recentRuns.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <p className="mb-2 text-xs text-dim">Recent runs</p>
                <ul className="space-y-1.5 text-[13px]">
                  {recentRuns.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("history");
                          setHistoryRun(String(r.id));
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-panel-2"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[r.status === "running" ? "running" : r.status === "success" ? "success" : "failed"].color }} />
                          Run #{r.id}, {r.trigger}
                        </span>
                        <span className="font-mono text-xs text-dim">
                          {r.added} added, {r.updated} updated, {duration((r.finishedAt ?? now) - r.startedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

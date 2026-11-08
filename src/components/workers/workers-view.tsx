"use client";

import clsx from "clsx";
import { CheckCircle2, Clock3, Cpu, Plus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkersData } from "@/core/queries";
import type { Run } from "@/lib/db/schema";
import { clock, duration, num } from "@/lib/client/format";
import { useJson, useNow } from "@/lib/client/hooks";
import { Backdrop, EmptyState, RunNowButton, SearchBox, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle, Select, Sparkline } from "../ui";
import { NODE_META, STATUS_META } from "./node-meta";
import { NodeDetails } from "./node-details";
import { PipelineGraph, type NodeExec } from "./pipeline-graph";

function Kpi({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card-glass flex min-w-[160px] flex-1 items-end justify-between gap-2 px-4 py-4 max-sm:basis-full">
      <div>
        <p className="flex items-center gap-2.5 text-[13px] whitespace-nowrap text-muted">
          {icon}
          {label}
        </p>
        <p className="mt-2 text-[22px] font-semibold tracking-[-0.01em] whitespace-nowrap">{value}</p>
      </div>
      {children}
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
      <button type="button" onClick={() => setOpen(true)} className="pill flex h-10 items-center gap-2 px-4 text-[13px] text-fg hover:border-accent/60">
        <Plus className="h-4 w-4" /> Add rule
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
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Monetization" required className="h-9 w-48 rounded-lg border border-line-2 bg-black/30 px-3 text-[13px] text-fg focus:outline-none" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Key (optional)
        <input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="monetization" className="h-9 w-36 rounded-lg border border-line-2 bg-black/30 px-3 text-[13px] text-fg focus:outline-none" />
      </label>
      <button type="submit" className="btn-primary h-9 px-4 text-[12.5px]">
        Add rule
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg">
        <X className="h-4 w-4" />
      </button>
      {errors.length > 0 && <p role="alert" className="w-full text-[12px] text-bad">{errors.join("; ")}</p>}
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
  const processedSeries = [...recentRuns].reverse().map((r) => r.processed);
  const durationSeries = [...recentRuns].reverse().filter((r) => r.finishedAt).map((r) => (r.finishedAt! - r.startedAt) / 1000);
  const events = data?.events ?? [];

  const resetAll = async () => {
    if (!window.confirm("Reset every node to the default rules from the specification? Custom rules will be removed.")) return;
    await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    view.refresh();
  };

  return (
    <>
      <Backdrop tone="violet" />
      <TopBar
        left={<SearchBox value={filter} onChange={setFilter} placeholder="Search nodes..." />}
        right={
          <>
            <AddRule
              onAdded={(id) => {
                setSelectedId(id);
                view.refresh();
              }}
            />
            <button type="button" onClick={resetAll} className="pill flex h-10 items-center gap-2 px-4 text-[13px] text-muted hover:text-fg">
              <RotateCcw className="h-4 w-4" /> Reset to defaults
            </button>
            <RunNowButton />
          </>
        }
      />

      <div className="relative z-10 px-5 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[clamp(34px,3.6vw,44px)] font-semibold tracking-[-0.03em]">Workers</h1>
            <p className="mt-1 text-[15px] text-muted">Live view of agents, prompts and tool calls</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-3 lg:max-w-[700px] lg:flex-nowrap">
            <Kpi icon={<Cpu className="h-4 w-4 text-good" />} label="Active Workers" value={`${runningCount} / ${enabledCount}`}>
              <Sparkline values={durationSeries.length > 1 ? durationSeries : [0, 0]} width={70} height={34} fill={false} />
            </Kpi>
            <Kpi icon={<CheckCircle2 className="h-4 w-4 text-violet" />} label="Processed Today" value={`${num(status?.totals.processedToday ?? 0)} games`}>
              <Sparkline values={processedSeries.length > 1 ? processedSeries : [0, 0]} color="var(--color-violet)" width={70} height={34} fill={false} />
            </Kpi>
            <Kpi icon={<Clock3 className="h-4 w-4" />} label="Last Run" value={clock(status?.run?.startedAt)}>
              <span className={clsx("mb-2 h-2 w-2 rounded-full", status?.run?.status === "failed" ? "bg-bad" : "bg-good")} />
            </Kpi>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="pill flex p-1" role="tablist" aria-label="Mode">
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
                className={clsx("flex h-9 items-center gap-2 rounded-[10px] px-5 text-[14px]", mode === m ? "bg-panel-3 text-fg" : "text-muted hover:text-fg")}
              >
                {m === "live" && <span className="live-dot h-2 w-2 rounded-full bg-good" />}
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
                label: `Run #${r.id} · ${new Date(r.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${r.status}`,
              }))}
              className="w-[300px]"
            />
          )}
          {run && (
            <p className="text-[13px] text-muted">
              Run #{run.id} · {run.trigger} · {run.processed}/{run.total} games · {run.added} added · {run.updated} updated
              {run.errors ? ` · ${run.errors} errors` : ""}
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
          <aside className="card-glass hidden h-fit space-y-2.5 p-4 text-[12.5px] lg:block" aria-label="Legend">
            {LEGEND_KINDS.map((t) => {
              const m = NODE_META[t];
              return (
                <p key={t} className="flex items-center gap-2.5 text-fg/85">
                  <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: m.color }} />
                  {m.kind}
                </p>
              );
            })}
            <p className="border-t border-line pt-3 text-muted">Status</p>
            {(["running", "queued", "success", "failed"] as const).map((s) => (
              <p key={s} className="flex items-center gap-2.5 text-fg/85">
                <span className="h-3 w-3 rounded-full" style={{ background: STATUS_META[s].color }} />
                {{ running: "Running", queued: "Pending", success: "Success", failed: "Failed" }[s]}
              </p>
            ))}
          </aside>
        </div>

        <div className="mt-4 grid items-start gap-5 pb-8 lg:grid-cols-2">
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
                  <button type="button" onClick={() => setShowAllEvents((s) => !s)} className="text-[13px] text-muted hover:text-fg">
                    {showAllEvents ? "Show less" : "See all"}
                  </button>
                )
              }
            >
              <span id="history-title" className="text-[17px]">Run History</span>
            </CardTitle>
            {events.length === 0 ? (
              <EmptyState title="No runs yet">Press Run Now or wait for the hourly schedule.</EmptyState>
            ) : (
              <ol className="relative mt-5 space-y-5 pl-1">
                <span className="absolute top-3 bottom-3 left-[13px] w-px bg-line-2" aria-hidden />
                {(showAllEvents ? events : events.slice(0, 6)).map((e) => (
                  <li key={e.id} className="relative flex gap-4">
                    <span
                      className={clsx(
                        "z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full",
                        e.level === "error" ? "bg-bad" : e.level === "warn" ? "bg-warn" : e.level === "success" ? "bg-good" : "bg-[#3b9b4f]",
                      )}
                    >
                      {e.level === "error" ? <X className="h-3.5 w-3.5 text-black" /> : <CheckCircle2 className="h-4 w-4 text-black" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14.5px] break-words text-fg">{e.message}</p>
                      <p className="mt-0.5 text-[12.5px] break-words text-muted">
                        {clock(e.ts)}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {recentRuns.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <p className="mb-2 text-[12px] text-muted">Recent runs</p>
                <ul className="space-y-1.5 text-[12.5px]">
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
                          Run #{r.id} · {r.trigger}
                        </span>
                        <span className="text-muted">
                          {r.added} added · {r.updated} updated · {duration((r.finishedAt ?? now) - r.startedAt)}
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

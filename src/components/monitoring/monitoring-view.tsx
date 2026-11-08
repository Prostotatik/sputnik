"use client";

import clsx from "clsx";
import { AlertTriangle, Coins, Cpu, HeartPulse, Hourglass, Timer, Zap } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonitoringData } from "@/core/queries";
import { clock, compact, duration, num, timeAgo, timeUntil, usd } from "@/lib/client/format";
import { useJson, useNow } from "@/lib/client/hooks";
import { Backdrop, EmptyState, RunNowButton, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle } from "../ui";
import { STATUS_META } from "../workers/node-meta";

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="card-glass px-5 py-4">
      <p className="flex items-center gap-2.5 text-[13px] text-fg/75">
        {icon}
        {label}
      </p>
      <p className={clsx("mt-2.5 text-[26px] font-semibold tracking-[-0.02em] tabular-nums", tone === "bad" && "text-bad", tone === "warn" && "text-warn", tone === "good" && "text-good")}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-good";
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-panel-3" role="meter" aria-valuenow={used} aria-valuemax={unlimited ? undefined : limit} aria-label="Usage">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={clsx("text-[12px] tabular-nums", pct >= 90 ? "text-bad" : "text-muted")}>
        {num(used)} / {unlimited ? "∞" : compact(limit)}
      </span>
    </div>
  );
}

export function MonitoringView() {
  const { status } = useStatus();
  const now = useNow(2000);
  const version = status?.run ? `${status.run.id}:${status.run.status}:${status.run.processed}:${status.events[0]?.id ?? 0}` : "0";
  const { data } = useJson<MonitoringData>(`/api/monitoring?v=${encodeURIComponent(version)}`, { intervalMs: 15_000 });
  const run = status?.run;
  const active = Boolean(status?.active && run);
  const worker = status?.worker;

  return (
    <>
      <Backdrop tone="violet" />
      <TopBar left={<p className="text-[13px] text-muted">{worker?.online ? `Worker pid ${worker.pid} · heartbeat ${timeAgo(worker.beatAt, now)}` : "Worker is not sending heartbeats"}</p>} right={<RunNowButton />} />
      <div className="relative z-10 px-5 pb-8 md:px-6">
        <h1 className="text-[clamp(36px,3.8vw,48px)] font-semibold tracking-[-0.03em]">Monitoring</h1>
        <p className="mt-1 text-[15px] text-muted">Service health, throughput and AI token spend in real time</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat
            icon={<HeartPulse className={clsx("h-4 w-4", worker?.online ? "text-good" : "text-bad")} />}
            label="Worker"
            value={worker?.online ? (worker.state === "running" ? "Running" : "Idle") : "Offline"}
            tone={worker?.online ? "good" : "bad"}
            sub={worker?.startedAt && worker.online ? `Up ${duration(now - worker.startedAt)}` : "Start it with pnpm worker"}
          />
          <Stat icon={<Hourglass className="h-4 w-4 text-violet" />} label="Next run" value={active ? "—" : timeUntil(worker?.nextRunAt, now)} sub={worker?.nextRunAt ? clock(worker.nextRunAt) : "Hourly schedule"} />
          <Stat icon={<Cpu className="h-4 w-4 text-sky" />} label="Processed" value={`${num(status?.totals.processedToday)} today`} sub={`${num(status?.totals.games)} games in library`} />
          <Stat icon={<Zap className="h-4 w-4 text-yellow" />} label="AI requests today" value={num(data?.today.requests)} sub={`avg ${num(data?.today.avgLatency)} ms`} />
          <Stat icon={<Timer className="h-4 w-4 text-cyan" />} label="Tokens today" value={compact((data?.today.inputTokens ?? 0) + (data?.today.outputTokens ?? 0))} sub={`${compact(data?.today.inputTokens)} in · ${compact(data?.today.outputTokens)} out`} />
          <Stat icon={<Coins className="h-4 w-4 text-orange" />} label="Spend today (estimate)" value={usd(data?.today.cost ?? 0)} sub="Paid-tier equivalent; free tier bills $0" />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <section className="card p-5">
            <CardTitle right={<span className={clsx("rounded-full px-3 py-1 text-[12px]", active ? "bg-good/15 text-good" : "bg-panel-3 text-muted")}>{active ? "Running" : run ? `Last: ${run.status}` : "No runs"}</span>}>Current run</CardTitle>
            {!run ? (
              <EmptyState title="No runs yet">Press Run Now to start the first collection.</EmptyState>
            ) : (
              <>
                <p className="mt-3 text-[13px] text-muted">
                  Run #{run.id} · {run.trigger} · started {clock(run.startedAt)} · {duration((run.finishedAt ?? now) - run.startedAt)}
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="truncate">{active ? `${run.currentStep ?? "Working"}${run.currentGame ? ` — ${run.currentGame}` : ""}` : run.note ?? "Finished"}</span>
                    <span className="tabular-nums text-muted">
                      {run.processed} / {run.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-3">
                    <div className="h-full rounded-full bg-good transition-[width] duration-700" style={{ width: `${run.total ? (run.processed / run.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Added", run.added, "text-good"],
                    ["Updated", run.updated, "text-sky"],
                    ["Errors", run.errors, run.errors ? "text-bad" : "text-fg"],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="rounded-xl bg-panel-2 py-3">
                      <dt className="text-[12px] text-muted">{label}</dt>
                      <dd className={clsx("text-[20px] font-semibold", cls as string)}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                  {(status?.nodes ?? []).map((n) => (
                    <li key={n.nodeId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_META[n.status].color }} />
                        {n.nodeId}
                      </span>
                      <span className="text-muted">{n.total ? `${n.done}/${n.total}` : STATUS_META[n.status].label}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card p-5">
            <CardTitle
              right={
                <ul className="flex gap-4 text-[12px] text-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#6d70ff]" /> Tokens
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange" /> Est. cost
                  </li>
                </ul>
              }
            >
              Token usage, last 14 days
            </CardTitle>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={data?.days ?? []} margin={{ top: 16, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1e1e24" vertical={false} />
                <XAxis dataKey="day" stroke="#5c5c66" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="t" stroke="#5c5c66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => compact(v)} />
                <YAxis yAxisId="c" orientation="right" stroke="#5c5c66" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: "#111114", border: "1px solid #2e2e37", borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: "rgb(255 255 255 / 0.03)" }}
                  formatter={(v, n) => (n === "cost" ? [usd(Number(v)), "Est. cost"] : [compact(Number(v)), n === "tokens" ? "Tokens" : "Requests"])}
                />
                <Bar yAxisId="t" dataKey="tokens" fill="#6d70ff" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="c" dataKey="cost" stroke="#f97316" strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </section>
        </div>

        <section className="card mt-5 overflow-x-auto p-5">
          <CardTitle right={<span className="text-[12px] text-muted">Limits from doc/google-limits.md · daily window resets at midnight Pacific</span>}>Model quotas and rotation</CardTitle>
          <table className="mt-4 w-full min-w-[860px] text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-normal">Model</th>
                <th className="py-2 font-normal">Used for</th>
                <th className="py-2 font-normal">Requests today / RPD</th>
                <th className="py-2 font-normal">This minute / RPM</th>
                <th className="py-2 font-normal">Tokens today</th>
                <th className="py-2 font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              {(data?.quotas ?? []).map((q) => (
                <tr key={q.model} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5">
                    <p>{q.label}</p>
                    <p className="text-[11px] text-dim">{q.model}</p>
                  </td>
                  <td className="py-2.5 text-muted">{q.capabilities.join(", ")}</td>
                  <td className="py-2.5">
                    <UsageBar used={q.dayRequests} limit={q.rpd} />
                  </td>
                  <td className="py-2.5">
                    <UsageBar used={q.minuteRequests} limit={q.rpm} />
                  </td>
                  <td className="py-2.5 tabular-nums text-muted">{compact(q.dayTokens)}</td>
                  <td className="py-2.5 text-[12px]">
                    {q.provider === "openai" ? (
                      <span className="text-dim">Fallback (needs OPENAI_API_KEY)</span>
                    ) : q.coolingDown ? (
                      <span className="text-warn" title={q.lastError ?? undefined}>Cooling down</span>
                    ) : q.rpd > 0 && q.dayRequests >= q.rpd ? (
                      <span className="text-bad">Daily limit reached</span>
                    ) : (
                      <span className="text-good">Available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="card p-5">
            <CardTitle>AI usage by step today</CardTitle>
            {!data?.purposes.length ? (
              <EmptyState title="No AI calls today" />
            ) : (
              <ul className="mt-4 space-y-3">
                {data.purposes.map((p) => {
                  const max = data.purposes[0].tokens || 1;
                  return (
                    <li key={p.purpose} className="text-[13px]">
                      <div className="mb-1 flex justify-between">
                        <span>{p.purpose.replace(/_/g, " ")}</span>
                        <span className="tabular-nums text-muted">
                          {num(p.requests)} calls · {compact(p.tokens)} tokens
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#6d70ff,#a855f7)]" style={{ width: `${(p.tokens / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {data && data.models.length > 0 && (
              <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-[12.5px]">
                <thead className="text-[11.5px] text-muted">
                  <tr>
                    <th className="pb-1.5 font-normal">Model</th>
                    <th className="pb-1.5 font-normal">Calls</th>
                    <th className="pb-1.5 font-normal">In / out tokens</th>
                    <th className="pb-1.5 font-normal">Latency</th>
                    <th className="pb-1.5 font-normal">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <tr key={m.model} className="border-t border-line/60">
                      <td className="py-1.5">{m.model}</td>
                      <td className="py-1.5 tabular-nums">
                        {m.requests}
                        {m.errors ? <span className="text-bad"> ({m.errors} failed)</span> : null}
                      </td>
                      <td className="py-1.5 tabular-nums text-muted">
                        {compact(m.inputTokens)} / {compact(m.outputTokens)}
                      </td>
                      <td className="py-1.5 tabular-nums text-muted">{num(m.latency)} ms</td>
                      <td className="py-1.5 tabular-nums">{usd(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>

          <section className="card p-5">
            <CardTitle>Recent warnings and errors</CardTitle>
            {!data || (data.errors.length === 0 && data.failedCalls.length === 0) ? (
              <EmptyState title="No errors recorded">Failed runs, Metacritic errors and rejected AI calls appear here.</EmptyState>
            ) : (
              <ul className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                {[
                  ...data.errors.map((e) => ({ id: `e${e.id}`, ts: e.ts, level: e.level, text: e.message, meta: e.runId ? `Run #${e.runId}` : "" })),
                  ...data.failedCalls.map((c) => ({ id: `c${c.id}`, ts: c.ts, level: c.status === "rate_limited" ? "warn" : "error", text: c.error ?? c.status, meta: `${c.model} · ${c.purpose}` })),
                ]
                  .sort((a, b) => b.ts - a.ts)
                  .slice(0, 15)
                  .map((e) => (
                    <li key={e.id} className="flex gap-3 text-[12.5px]">
                      <AlertTriangle className={clsx("mt-0.5 h-4 w-4 shrink-0", e.level === "error" ? "text-bad" : "text-warn")} />
                      <div className="min-w-0">
                        <p className="break-words text-fg/85">{e.text}</p>
                        <p className="text-[11px] text-dim">
                          {timeAgo(e.ts, now)} {e.meta && `· ${e.meta}`}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card mt-5 overflow-x-auto p-5">
          <CardTitle>Run history</CardTitle>
          {!data?.runs.length ? (
            <EmptyState title="No runs yet" />
          ) : (
            <table className="mt-4 w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  {["Run", "Trigger", "Status", "Started", "Duration", "Games", "Added", "Updated", "Errors", "Note"].map((h) => (
                    <th key={h} className="py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2">#{r.id}</td>
                    <td className="py-2 text-muted">{r.trigger}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-1.5" style={{ color: STATUS_META[r.status === "running" ? "running" : r.status === "success" ? "success" : "failed"].color }}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {r.status}
                      </span>
                    </td>
                    <td className="py-2 text-muted">{new Date(r.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="py-2 tabular-nums">{duration((r.finishedAt ?? now) - r.startedAt)}</td>
                    <td className="py-2 tabular-nums">
                      {r.processed}/{r.total}
                    </td>
                    <td className="py-2 tabular-nums text-good">{r.added}</td>
                    <td className="py-2 tabular-nums text-sky">{r.updated}</td>
                    <td className={clsx("py-2 tabular-nums", r.errors ? "text-bad" : "text-muted")}>{r.errors}</td>
                    <td className="max-w-[260px] truncate py-2 text-[12px] text-muted" title={r.note ?? undefined}>
                      {r.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

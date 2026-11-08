"use client";

import { AlertTriangle, CheckCircle2, Clock3, Database } from "lucide-react";
import { compact, num, timeAgo, timeUntil } from "@/lib/client/format";
import { useNow } from "@/lib/client/hooks";
import { RunNowButton } from "./shell";
import { useStatus } from "./status";
import { Sparkline } from "./ui";

function ProgressRing({ pct, size = 78 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1f2a1f" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-good)"
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

/** Live strip with run progress, schedule, totals and worker states (games-ref bottom bar). */
export function ServiceMonitor() {
  const { status } = useStatus();
  const now = useNow(5000);
  const run = status?.run;
  const active = status?.active && run;
  const pct = active && run.total ? (run.processed / run.total) * 100 : run?.status === "success" ? 100 : 0;
  const nodeBars = (status?.nodes ?? []).map((n) => (n.status === "running" ? 1 : n.status === "success" ? 0.6 : n.status === "failed" ? 0.3 : 0.15));

  return (
    <section aria-label="Service monitor" className="card-glass mx-5 mb-6 grid gap-5 p-5 md:mx-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="flex items-center gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-semibold">Service Monitor</h2>
            <span className="flex items-center gap-1.5 text-xs text-good">
              <span className={status?.worker.online ? "live-dot h-1.5 w-1.5 rounded-full bg-good" : "h-1.5 w-1.5 rounded-full bg-bad"} />
              {status?.worker.online ? "Live" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing pct={pct} />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{active ? "Processing…" : run?.status === "failed" ? "Last run failed" : "Idle"}</p>
              <p className="mt-0.5 max-w-[190px] truncate text-muted" title={run?.currentStep ?? undefined}>
                {active ? run.currentStep ?? "Working" : run ? `Last run ${timeAgo(run.finishedAt ?? run.startedAt, now)}` : "No runs yet"}
              </p>
              {active && (
                <p className="text-muted">
                  ({run.processed} / {run.total})
                </p>
              )}
            </div>
          </div>
        </div>
        <span className="hidden xl:block">
          <Sparkline values={status?.activity ?? []} width={120} height={56} />
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-4 border-line lg:border-x lg:px-5">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Clock3 className="h-3.5 w-3.5 text-good" /> Next run
          </dt>
          <dd className="mt-2 text-lg font-medium">{active ? "after this run" : timeUntil(status?.worker.nextRunAt, now)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-good" /> Total processed
          </dt>
          <dd className="mt-2 text-lg font-medium">{num(status?.totals.games)} games</dd>
          <dd className="text-[11px] text-muted">{compact(status?.totals.processedToday)} today</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Database className="h-3.5 w-3.5" /> Last update
          </dt>
          <dd className="mt-2 text-lg font-medium">{timeAgo(status?.totals.lastUpdate, now)}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-6">
        <div>
          <h3 className="mb-2.5 text-[13px] font-medium">Workers</h3>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center gap-2 text-good">
              <span className="h-1.5 w-1.5 rounded-full bg-good" /> Active ({status?.workers.active ?? 0})
            </li>
            <li className="flex items-center gap-2 text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" /> Idle ({status?.workers.idle ?? 0})
            </li>
            <li className="flex items-center gap-2 text-bad">
              <AlertTriangle className="h-3 w-3" /> Error ({status?.workers.error ?? 0})
            </li>
          </ul>
        </div>
        <div className="flex h-14 items-end gap-[3px]" aria-hidden>
          {nodeBars.map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-good" style={{ height: `${Math.max(12, h * 100)}%`, opacity: 0.35 + h * 0.65 }} />
          ))}
        </div>
        <RunNowButton size="sm" className="ml-auto" />
      </div>
    </section>
  );
}

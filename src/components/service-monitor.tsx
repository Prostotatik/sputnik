"use client";

import { clock, duration, every, num, timeAgo, timeUntil } from "@/lib/client/format";
import { useNow } from "@/lib/client/hooks";
import { TelemetryDot } from "./shell";
import { useStatus } from "./status";

/** Live strip with run progress, schedule, totals and pipeline step counts. */
export function ServiceMonitor() {
  const { status } = useStatus();
  const now = useNow(5000);
  const run = status?.run;
  const active = Boolean(status?.active && run);
  const state = !status?.worker.online ? "offline" : active ? "running" : "idle";
  const interval = every(status?.worker.intervalMinutes);
  const lastRun =
    run && run.status !== "running"
      ? `Последний запуск в ${clock(run.startedAt)} ${run.status === "failed" ? "упал" : "завершился"} за ${duration((run.finishedAt ?? run.startedAt) - run.startedAt)}: добавлено ${run.added}, обновлено ${run.updated}${run.errors ? `, ошибок ${run.errors}` : ""}.`
      : null;
  const pct = active && run && run.total ? (run.processed / run.total) * 100 : 0;
  const nodes = status?.nodes ?? [];
  const countOf = (s: string) => nodes.filter((n) => n.status === s).length;

  return (
    <section aria-label="Монитор сервиса" className="card mx-6 mb-6 grid gap-6 p-5 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-center">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-medium">
          <TelemetryDot state={state} />
          Монитор сервиса
        </h2>
        {active && run ? (
          <>
            <p className="mt-2 truncate text-[13px] text-muted" title={run.currentStep ?? undefined}>
              {run.currentStep ?? "Работаем"}
              {run.currentGame ? ` — ${run.currentGame}` : ""}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={run.processed} aria-valuemax={run.total}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-xs text-muted tabular-nums">
                {run.processed} из {run.total}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[13px] text-muted">
              {!status
                ? "Подключаемся…"
                : state === "offline"
                  ? "Воркер не запущен"
                  : lastRun
                    ? `Ожидание. ${lastRun}`
                    : "Запусков ещё не было"}
            </p>
            {status && interval && <p className="mt-1 font-mono text-xs text-dim">Запуск {interval}, отсчёт от начала предыдущего</p>}
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-8 border-line lg:border-x lg:px-8">
        <div>
          <dt className="text-xs text-dim">Следующий запуск</dt>
          <dd className="mt-1 text-xl font-medium whitespace-nowrap tabular-nums">{state === "offline" ? "—" : active ? "после текущего" : clock(status?.worker.nextRunAt)}</dd>
          {state === "idle" && <dd className="font-mono text-xs text-dim tabular-nums">{timeUntil(status?.worker.nextRunAt, now)}</dd>}
        </div>
        <div>
          <dt className="text-xs text-dim">Библиотека</dt>
          <dd className="mt-1 text-xl font-medium tabular-nums">{num(status?.totals.games)}</dd>
          <dd className="font-mono text-xs text-dim tabular-nums">обработано сегодня: {num(status?.totals.processedToday)}</dd>
        </div>
        <div>
          <dt className="text-xs text-dim">Обновлено</dt>
          <dd className="mt-1 text-xl font-medium tabular-nums">{timeAgo(status?.totals.lastUpdate, now)}</dd>
        </div>
      </dl>

      <dl className="grid grid-cols-3 gap-6 text-[13px] lg:grid-cols-1 lg:gap-1">
        {[
          ["Работают", countOf("running"), "text-accent"],
          ["Готово", countOf("success"), "text-fg"],
          ["С ошибкой", countOf("failed"), countOf("failed") ? "text-bad" : "text-fg"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="flex items-baseline justify-between gap-6">
            <dt className="text-muted">{label}</dt>
            <dd className={`font-mono tabular-nums ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

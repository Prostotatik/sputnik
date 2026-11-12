"use client";

import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonitoringData } from "@/core/queries";
import { defaultPipeline } from "@/core/pipeline/defaults";
import { clock, compact, dateTime, duration, num, timeAgo, timeUntil, usd } from "@/lib/client/format";
import { useJson, useNow } from "@/lib/client/hooks";
import { EmptyState, RunNowButton, TelemetryDot, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle } from "../ui";
import { STATUS_META } from "../workers/node-meta";

const NODE_NAMES = new Map(defaultPipeline().map((n) => [n.id, n.name]));
const TRIGGER: Record<string, string> = { manual: "вручную", schedule: "по расписанию" };
const RUN_STATUS: Record<string, string> = { running: "идёт", success: "успешно", failed: "с ошибкой" };
const CAPABILITY: Record<string, string> = { text: "текст", video: "видео", embedding: "эмбеддинги" };
const PURPOSE: Record<string, string> = {
  critic_summary: "Сводка критиков",
  user_summary: "Сводка игроков",
  transcribe: "Расшифровка речи",
  letsplay_summary: "Вердикт летсплея",
  insights: "Инсайты рынка",
  embedding: "Эмбеддинги",
  translate: "Перевод описаний",
  "custom:test": "Проверка правил",
};
const purposeName = (p: string) => PURPOSE[p] ?? (p.startsWith("custom:") ? `Своё правило: ${p.slice(7)}` : p.replace(/_/g, " "));

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "bad" }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={clsx("mt-2 truncate text-2xl font-medium tabular-nums", tone === "bad" && "text-bad")}>{value}</p>
      {sub && <p className="mt-1 truncate font-mono text-xs text-dim">{sub}</p>}
    </div>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-[#85858b]";
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 w-28 overflow-hidden rounded-full bg-panel-3" role="meter" aria-valuenow={used} aria-valuemax={unlimited ? undefined : limit} aria-label="Использование">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={clsx("font-mono text-xs tabular-nums", pct >= 90 ? "text-bad" : "text-muted")}>
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
      <TopBar left={<p className="font-mono text-xs text-dim">{worker?.online ? `Воркер pid ${worker.pid}, пульс ${timeAgo(worker.beatAt, now)}` : "Воркер не присылает пульс"}</p>} right={<RunNowButton />} />
      <div className="relative px-6 pb-8">
        <h1 className="mt-3 text-[32px] leading-[1.15] font-medium">Мониторинг</h1>
        <p className="mt-1 text-sm text-muted">Здоровье воркера, пропускная способность и расход лимитов Gemini</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Воркер"
            value={
              <span className="flex items-center gap-2">
                <TelemetryDot state={!worker?.online ? "offline" : active ? "running" : "idle"} />
                {worker?.online ? (worker.state === "running" ? "Работает" : "Ждёт") : "Не в сети"}
              </span>
            }
            tone={worker?.online ? undefined : "bad"}
            sub={worker?.startedAt && worker.online ? `работает ${duration(now - worker.startedAt)}` : "запустите pnpm worker"}
          />
          <Stat label="Следующий запуск" value={active || !worker?.online ? "—" : timeUntil(worker?.nextRunAt, now)} sub={!worker?.online ? "воркер не в сети" : worker?.nextRunAt ? clock(worker.nextRunAt) : "раз в час"} />
          <Stat label="Обработано сегодня" value={num(status?.totals.processedToday)} sub={`в библиотеке ${num(status?.totals.games)}`} />
          <Stat label="Запросов к ИИ сегодня" value={num(data?.today.requests)} sub={`в среднем ${num(data?.today.avgLatency)} мс`} />
          <Stat label="Токенов сегодня" value={compact((data?.today.inputTokens ?? 0) + (data?.today.outputTokens ?? 0))} sub={`вход ${compact(data?.today.inputTokens)}, выход ${compact(data?.today.outputTokens)}`} />
          <Stat label="Расходы сегодня" value={usd(data?.today.cost ?? 0)} sub="оценка по платному тарифу" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <section className="card p-5">
            <CardTitle right={<span className={clsx("font-mono text-xs", active ? "text-accent" : run?.status === "failed" ? "text-bad" : "text-dim")}>{active ? "идёт" : run ? (RUN_STATUS[run.status] ?? run.status) : "запусков нет"}</span>}>Текущий запуск</CardTitle>
            {!run ? (
              <EmptyState title="Запусков ещё не было">Нажмите «Запустить», чтобы начать первый сбор.</EmptyState>
            ) : (
              <>
                <p className="mt-3 font-mono text-xs text-dim">
                  Запуск #{run.id}, {TRIGGER[run.trigger]}, начат в {clock(run.startedAt)}, {duration((run.finishedAt ?? now) - run.startedAt)}
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="truncate">{active ? `${run.currentStep ?? "Работаем"}${run.currentGame ? ` — ${run.currentGame}` : ""}` : run.note ?? "Завершён"}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {run.processed} из {run.total}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-panel-3">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${run.total ? (run.processed / run.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Добавлено", run.added, "text-fg"],
                    ["Обновлено", run.updated, "text-fg"],
                    ["Ошибок", run.errors, run.errors ? "text-bad" : "text-fg"],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="rounded-lg bg-panel-2 py-3">
                      <dt className="text-xs text-dim">{label}</dt>
                      <dd className={clsx("mt-1 text-xl font-medium tabular-nums", cls as string)}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                  {(status?.nodes ?? []).map((n) => (
                    <li key={n.nodeId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_META[n.status].color }} />
                        <span className="truncate">{NODE_NAMES.get(n.nodeId) ?? n.nodeId}</span>
                      </span>
                      <span className="font-mono text-xs text-dim">{n.total ? `${n.done}/${n.total}` : STATUS_META[n.status].label}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card p-5">
            <CardTitle
              right={
                <ul className="flex gap-4 text-xs text-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#3a3a3e]" /> Токены
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded-full bg-accent" /> Оценка стоимости
                  </li>
                </ul>
              }
            >
              Расход токенов за 14 дней
            </CardTitle>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={data?.days ?? []} margin={{ top: 16, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#232325" vertical={false} />
                <XAxis dataKey="day" stroke="#85858b" fontSize={11} fontFamily="var(--font-geist-mono)" tickLine={false} axisLine={false} />
                <YAxis yAxisId="t" stroke="#85858b" fontSize={11} fontFamily="var(--font-geist-mono)" tickLine={false} axisLine={false} tickFormatter={(v) => compact(v)} />
                <YAxis yAxisId="c" orientation="right" stroke="#85858b" fontSize={11} fontFamily="var(--font-geist-mono)" tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: "#111114", border: "1px solid #2e2e37", borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: "rgb(255 255 255 / 0.03)" }}
                  formatter={(v, n) => (n === "cost" ? [usd(Number(v)), "Оценка стоимости"] : [compact(Number(v)), n === "tokens" ? "Токены" : "Запросы"])}
                />
                <Bar yAxisId="t" dataKey="tokens" fill="#3a3a3e" radius={[2, 2, 0, 0]} maxBarSize={24} />
                <Line yAxisId="c" dataKey="cost" stroke="#4fb6c8" strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </section>
        </div>

        <section className="card mt-4 overflow-x-auto p-5">
          <CardTitle right={<span className="text-xs text-dim">Лимиты из doc/google-limits.md, дневное окно сбрасывается в полночь по тихоокеанскому времени</span>}>Лимиты моделей и ротация</CardTitle>
          <table className="mt-4 w-full min-w-[860px] text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-normal">Модель</th>
                <th className="py-2 font-normal">Для чего</th>
                <th className="py-2 font-normal">Запросов сегодня / RPD</th>
                <th className="py-2 font-normal">За эту минуту / RPM</th>
                <th className="py-2 font-normal">Токенов сегодня</th>
                <th className="py-2 font-normal">Состояние</th>
              </tr>
            </thead>
            <tbody>
              {(data?.quotas ?? []).map((q) => (
                <tr key={q.model} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5">
                    <p>{q.label}</p>
                    <p className="font-mono text-xs text-dim">{q.model}</p>
                  </td>
                  <td className="py-2.5 text-muted">{q.capabilities.map((c) => CAPABILITY[c] ?? c).join(", ")}</td>
                  <td className="py-2.5">
                    <UsageBar used={q.dayRequests} limit={q.rpd} />
                  </td>
                  <td className="py-2.5">
                    <UsageBar used={q.minuteRequests} limit={q.rpm} />
                  </td>
                  <td className="py-2.5 font-mono tabular-nums text-muted">{compact(q.dayTokens)}</td>
                  <td className="py-2.5 text-xs">
                    {q.provider === "openai" ? (
                      <span className="text-dim">Запасная (нужен OPENAI_API_KEY)</span>
                    ) : q.coolingDown ? (
                      <span className="text-warn" title={q.lastError ?? undefined}>Пауза после ошибки</span>
                    ) : q.rpd > 0 && q.dayRequests >= q.rpd ? (
                      <span className="text-bad">Дневной лимит исчерпан</span>
                    ) : (
                      <span className="text-muted">Доступна</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="card p-5">
            <CardTitle>Расход ИИ по шагам сегодня</CardTitle>
            {!data?.purposes.length ? (
              <EmptyState title="Сегодня вызовов ИИ не было" />
            ) : (
              <ul className="mt-4 space-y-3">
                {data.purposes.map((p) => {
                  const max = data.purposes[0].tokens || 1;
                  return (
                    <li key={p.purpose} className="text-[13px]">
                      <div className="mb-1 flex justify-between">
                        <span>{purposeName(p.purpose)}</span>
                        <span className="font-mono text-xs tabular-nums text-dim">
                          вызовов {num(p.requests)}, токенов {compact(p.tokens)}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-panel-3">
                        <div className={clsx("h-full rounded-full", p === data.purposes[0] ? "bg-accent" : "bg-[#5c5c62]")} style={{ width: `${(p.tokens / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {data && data.models.length > 0 && (
              <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-[13px]">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-1.5 font-normal">Модель</th>
                    <th className="pb-1.5 font-normal">Вызовы</th>
                    <th className="pb-1.5 font-normal">Токены вход / выход</th>
                    <th className="pb-1.5 font-normal">Задержка</th>
                    <th className="pb-1.5 font-normal">Оценка стоимости</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <tr key={m.model} className="border-t border-line/60">
                      <td className="py-1.5">{m.model}</td>
                      <td className="py-1.5 font-mono tabular-nums">
                        {m.requests}
                        {m.errors ? <span className="text-bad"> (ошибок {m.errors})</span> : null}
                      </td>
                      <td className="py-1.5 font-mono tabular-nums text-muted">
                        {compact(m.inputTokens)} / {compact(m.outputTokens)}
                      </td>
                      <td className="py-1.5 font-mono tabular-nums text-muted">{num(m.latency)} мс</td>
                      <td className="py-1.5 font-mono tabular-nums">{usd(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>

          <section className="card p-5">
            <CardTitle>Последние предупреждения и ошибки</CardTitle>
            {!data || (data.errors.length === 0 && data.failedCalls.length === 0) ? (
              <EmptyState title="Ошибок нет">Здесь появятся упавшие запуски, ошибки Metacritic и отклонённые вызовы ИИ.</EmptyState>
            ) : (
              <ul className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                {[
                  ...data.errors.map((e) => ({ id: `e${e.id}`, ts: e.ts, level: e.level, text: e.message, meta: e.runId ? `Запуск #${e.runId}` : "" })),
                  ...data.failedCalls.map((c) => ({ id: `c${c.id}`, ts: c.ts, level: c.status === "rate_limited" ? "warn" : "error", text: c.error ?? c.status, meta: `${c.model}, ${purposeName(c.purpose)}` })),
                ]
                  .sort((a, b) => b.ts - a.ts)
                  .slice(0, 15)
                  .map((e) => (
                    <li key={e.id} className="flex gap-3 text-[13px]">
                      <AlertTriangle className={clsx("mt-0.5 h-4 w-4 shrink-0", e.level === "error" ? "text-bad" : "text-warn")} strokeWidth={1.5} />
                      <div className="min-w-0">
                        <p className="break-words text-muted">{e.text}</p>
                        <p className="text-[11px] text-dim">
                          {timeAgo(e.ts, now)}{e.meta && `, ${e.meta}`}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card mt-4 overflow-x-auto p-5">
          <CardTitle>История запусков</CardTitle>
          {!data?.runs.length ? (
            <EmptyState title="Запусков ещё не было" />
          ) : (
            <table className="mt-4 w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  {["Запуск", "Как запущен", "Статус", "Начало", "Длительность", "Игры", "Добавлено", "Обновлено", "Ошибки", "Заметка"].map((h) => (
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
                    <td className="py-2 text-muted">{TRIGGER[r.trigger] ?? r.trigger}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-1.5" style={{ color: STATUS_META[r.status === "running" ? "running" : r.status === "success" ? "success" : "failed"].color }}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {RUN_STATUS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-2 text-muted">{dateTime(r.startedAt)}</td>
                    <td className="py-2 font-mono tabular-nums text-muted">{duration((r.finishedAt ?? now) - r.startedAt)}</td>
                    <td className="py-2 font-mono tabular-nums">
                      {r.processed}/{r.total}
                    </td>
                    <td className="py-2 font-mono tabular-nums">{r.added}</td>
                    <td className="py-2 font-mono tabular-nums">{r.updated}</td>
                    <td className={clsx("py-2 font-mono tabular-nums", r.errors ? "text-bad" : "text-dim")}>{r.errors}</td>
                    <td className="max-w-[260px] truncate py-2 text-xs text-muted" title={r.note ?? undefined}>
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

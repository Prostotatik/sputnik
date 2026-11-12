"use client";

import clsx from "clsx";
import { Download, Gem, Plus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AnalyticsData } from "@/core/analytics";
import { compact, count, num, plural, timeAgo } from "@/lib/client/format";
import { genreRu } from "@/lib/genres";
import { useJson } from "@/lib/client/hooks";
import { EmptyState, SearchBox, TelemetryDot, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle, Change, Select } from "../ui";
import { Opportunities, SERIES_COLORS, SupplyDemand, TrendLines } from "./charts";

const PERIODS = [
  { value: "7", label: "За 7 дней", short: "7Д", against: "прошлым 7 дням", empty: "за последние 7 дней" },
  { value: "30", label: "За 30 дней", short: "30Д", against: "прошлым 30 дням", empty: "за последние 30 дней" },
  { value: "90", label: "За 90 дней", short: "90Д", against: "прошлым 90 дням", empty: "за последние 90 дней" },
  { value: "365", label: "За год", short: "1Г", against: "прошлому году", empty: "за последний год" },
  { value: "0", label: "За всё время", short: "Всё", against: "более раннему периоду", empty: "за всё время" },
];

function Stat({ label, value, change }: { label: string; value: string; change: React.ReactNode }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 truncate text-[28px] leading-8 font-medium tabular-nums">{value}</p>
      <p className="mt-2">{change}</p>
    </div>
  );
}

const INSIGHT_ICON = { up: TrendingUp, down: TrendingDown, opportunity: Gem };

const QUADRANT: Record<AnalyticsData["opportunities"][number]["quadrant"], string> = {
  opportunity: "высокий спрос, мало релизов",
  competitive: "высокая конкуренция",
  niche: "узкая ниша",
  saturated: "рынок насыщен",
};

export function AnalyticsView() {
  const { status } = useStatus();
  const [days, setDays] = useState("30");
  const [platform, setPlatform] = useState("");
  const [q, setQ] = useState("");
  const version = status?.totals.lastUpdate ? Math.floor(status.totals.lastUpdate / 30_000) : 0;
  const qs = new URLSearchParams({ days, platform }).toString();
  const { data, loading } = useJson<AnalyticsData>(`/api/analytics?${qs}&v=${version}`);
  const platforms = useJson<{ name: string; count: number }[]>("/api/platforms");
  const needle = q.trim().toLowerCase();
  const match = (s: string) => !needle || s.toLowerCase().includes(needle);
  const empty = !loading && data && (data.kpis.totalGames.value ?? 0) === 0;
  const period = PERIODS.find((p) => p.value === days)!;
  const against = period.against;
  const maxShare = Math.max(1, ...(data?.genreShare.map((g) => g.share) ?? [1]));

  return (
    <>
      <TopBar
        left={<SearchBox value={q} onChange={setQ} placeholder="Поиск жанров и игр" />}
        right={
          <>
            <Select label="Период" value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} className="w-36" />
            <Select
              label="Платформа"
              value={platform}
              onChange={setPlatform}
              options={[{ value: "", label: "Все платформы" }, ...(platforms.data ?? []).map((p) => ({ value: p.name, label: p.name }))]}
              className="w-40"
            />
            <a href={`/api/analytics/export?${qs}`} download className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px]">
              <Download className="h-4 w-4 text-dim" strokeWidth={1.5} /> Скачать отчёт
            </a>
          </>
        }
      />

      <div className="relative px-6 pb-8">
        <h1 className="mt-3 text-[32px] leading-[1.15] font-medium">Аналитика</h1>
        <p className="mt-1 text-sm text-muted">
          Доли жанров, интерес игроков и пустые ниши{data ? ` по ${count(data.totalLibrary, ["отслеживаемой игре", "отслеживаемым играм", "отслеживаемым играм"])}` : ""}
        </p>

        {empty && (
          <div className="card mt-6">
            <EmptyState title={`Нет игр, вышедших ${period.empty}${platform ? ` на ${platform}` : ""}`}>
              Расширьте период или фильтр платформ либо запустите сбор, чтобы добавить игры.
            </EmptyState>
          </div>
        )}

        {data && !empty && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Игр в выборке" value={num(data.kpis.totalGames.value)} change={<Change value={data.kpis.totalGames.delta} against={against} />} />
              <Stat label="Средний Metascore" value={data.kpis.avgMetascore.value?.toFixed(1) ?? "—"} change={<Change value={data.kpis.avgMetascore.delta} against={against} />} />
              <Stat label="Средний Userscore" value={data.kpis.avgUserscore.value?.toFixed(1) ?? "—"} change={<Change value={data.kpis.avgUserscore.delta} against={against} />} />
              <Stat
                label="Растущий жанр"
                value={data.kpis.trendingGenre.name ? genreRu(data.kpis.trendingGenre.name) : "—"}
                change={<Change value={data.kpis.trendingGenre.growth} suffix="% доли" against={against} />}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
              <section className="card p-5">
                <CardTitle
                  right={
                    <div className="flex gap-0.5" role="tablist" aria-label="Период">
                      {PERIODS.slice(0, 4).map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          role="tab"
                          aria-selected={days === p.value}
                          onClick={() => setDays(p.value)}
                          className={clsx("rounded-md px-2 py-1 font-mono text-xs transition-colors", days === p.value ? "bg-panel-3 text-fg" : "text-dim hover:text-fg")}
                        >
                          {p.short}
                        </button>
                      ))}
                    </div>
                  }
                >
                  Популярность жанров
                </CardTitle>
                <ul className="mt-5 space-y-3">
                  {data.genreShare.filter((g) => match(g.genre) || match(genreRu(g.genre))).map((g, i) => (
                    <li key={g.genre}>
                      <div className="flex items-baseline justify-between gap-4 text-[13px]">
                        <span className="truncate text-fg">{genreRu(g.genre)}</span>
                        <span className="font-mono text-xs text-muted tabular-nums">{g.share}%</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-panel-3">
                        <div className={clsx("h-full rounded-full", i === 0 && g.genre !== "Other" ? "bg-accent" : g.genre === "Other" ? "bg-[#3a3a3e]" : "bg-[#5c5c62]")} style={{ width: `${(g.share / maxShare) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card p-5">
                <CardTitle
                  right={
                    <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted">
                      {data.trends.series.map((s, i) => (
                        <li key={s.genre} className="flex items-center gap-1.5">
                          <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES_COLORS[i] }} /> {genreRu(s.genre)}
                        </li>
                      ))}
                    </ul>
                  }
                >
                  Тренды во времени
                </CardTitle>
                <p className="mt-1 text-xs text-dim">Доля релизов по жанрам</p>
                <div className="mt-2">
                  <TrendLines data={data.trends} />
                </div>
              </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="card p-5">
                <CardTitle
                  right={
                    <ul className="flex gap-4 text-xs text-muted">
                      <li className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-[#3a3a3e]" /> Вышло игр
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 rounded-full bg-accent" /> Отзывы игроков
                      </li>
                    </ul>
                  }
                >
                  Предложение и спрос
                </CardTitle>
                <div className="mt-2">
                  <SupplyDemand data={data.supplyDemand} />
                </div>
              </section>

              <section className="card p-5">
                <CardTitle right={data.insights && <span className="font-mono text-xs text-dim">{timeAgo(data.insights.createdAt)}</span>}>Ключевые инсайты</CardTitle>
                {!data.insights ? (
                  <EmptyState title="Инсайтов пока нет">Они появятся после запуска, когда в библиотеке будет хотя бы три свежие игры.</EmptyState>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {data.insights.items.filter((i) => match(i.text)).map((i) => {
                      const Icon = INSIGHT_ICON[i.kind];
                      return (
                        <li key={i.text} className="flex gap-3">
                          <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", i.kind === "opportunity" ? "text-accent" : "text-dim")} strokeWidth={1.5} />
                          <p className="text-[13px] leading-5 text-muted">{i.text}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <section className="card p-5">
                <CardTitle>Недооценённые ниши</CardTitle>
                <p className="mt-1 text-xs text-dim">Число релизов против отзывов на игру. Выделены жанры с высоким интересом и малым числом релизов</p>
                <div className="mt-2 grid gap-4 md:grid-cols-[1fr_140px]">
                  <Opportunities data={data.opportunities.filter((o) => match(o.genre) || match(genreRu(o.genre)))} />
                  <ul className="space-y-2 self-center text-[13px]">
                    {data.opportunities.slice(0, 5).map((o) => (
                      <li key={o.genre} className="flex items-center gap-2 truncate" title={`${genreRu(o.genre)}: ${QUADRANT[o.quadrant]}`}>
                        <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", o.quadrant === "opportunity" ? "bg-accent" : "bg-[#5c5c62]")} />
                        <span className={clsx("truncate", o.quadrant === "opportunity" ? "text-fg" : "text-muted")}>{genreRu(o.genre)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="card p-5">
                <CardTitle>Популярные сочетания</CardTitle>
                {data.combinations.venn ? (
                  <div className="mt-4 flex flex-wrap items-center gap-6">
                    <svg viewBox="0 0 230 150" className="h-[150px] w-[230px]" role="img" aria-label={`${data.combinations.venn.share}% игр выходят и на ${data.combinations.venn.a}, и на ${data.combinations.venn.b}`}>
                      <circle cx="80" cy="75" r="62" fill="none" stroke="#5c5c62" strokeWidth="1" />
                      <circle cx="150" cy="75" r="62" fill="none" stroke="#5c5c62" strokeWidth="1" />
                      <text x="48" y="80" fill="#a1a1a6" fontSize="12" textAnchor="middle">{data.combinations.venn.a.slice(0, 9)}</text>
                      <text x="182" y="80" fill="#a1a1a6" fontSize="12" textAnchor="middle">{data.combinations.venn.b.slice(0, 9)}</text>
                      <text x="115" y="80" fill="#4fb6c8" fontSize="14" fontFamily="var(--font-geist-mono)" textAnchor="middle">{data.combinations.venn.share}%</text>
                    </svg>
                    <div className="min-w-44 flex-1">
                      <p className="text-sm leading-5 text-fg">
                        {data.combinations.venn.share}% игр выходят и на {data.combinations.venn.a}, и на {data.combinations.venn.b}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
                        {data.combinations.pairs.filter((p) => match(p.genre) || match(genreRu(p.genre)) || match(p.platform)).slice(0, 4).map((p) => (
                          <li key={p.genre + p.platform} className="flex justify-between gap-3">
                            <span className="truncate">
                              {genreRu(p.genre)} <Plus className="inline h-3 w-3 text-dim" strokeWidth={1.5} /> {p.platform}
                            </span>
                            <span className="font-mono text-xs tabular-nums">{p.share}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Мультиплатформенных игр пока мало" />
                )}
              </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
              <section className="card p-5">
                <CardTitle right={<span className="text-xs text-dim">Доля отзывов игроков</span>}>Топ игр по интересу игроков</CardTitle>
                {data.topGames.length === 0 ? (
                  <EmptyState title="За этот период отзывов игроков нет" />
                ) : (
                  <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {data.topGames.filter((g) => match(g.title)).map((g, i) => (
                      <li key={g.slug}>
                        <Link href={`/games?game=${encodeURIComponent(g.slug)}`} className="group block">
                          <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-panel-3">
                            {g.coverUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                            )}
                            <span className="absolute top-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded bg-bg/80 px-1 font-mono text-[11px]">{i + 1}</span>
                          </span>
                          <span className="mt-2 block truncate text-[13px] underline-offset-2 group-hover:underline">{g.title}</span>
                          <span className="mt-0.5 flex items-baseline gap-2 font-mono text-xs tabular-nums">
                            <span className="text-fg">{g.interestShare}%</span>
                            <span className="text-dim">{compact(g.userReviews)} {plural(g.userReviews, ["отзыв", "отзыва", "отзывов"])}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="card p-5">
                <CardTitle
                  right={
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <TelemetryDot state={status?.active ? "running" : status?.worker.online ? "idle" : "offline"} />
                      {status?.active ? "Идёт сбор" : status?.worker.online ? "Ожидание" : "Воркер не в сети"}
                    </span>
                  }
                >
                  Активность рынка
                </CardTitle>
                <ul className="mt-4 space-y-3">
                  {data.activity.filter((a) => match(a.title)).slice(0, 5).map((a) => (
                    <li key={`${a.ts}-${a.gameId}`} className="flex items-center gap-3 text-[13px]">
                      {a.kind === "added" ? <Plus className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.5} /> : <RefreshCw className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.5} />}
                      <span className="min-w-0 flex-1 truncate text-muted">
                        <span className="text-fg">{a.title}</span> {a.kind === "added" ? "добавлена" : "обновлена"}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-dim">{timeAgo(a.ts)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

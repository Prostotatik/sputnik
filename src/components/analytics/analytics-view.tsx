"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Download, Flame, Gamepad2, Gem, Info, Plus, RefreshCw, Sparkles, Star, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AnalyticsData } from "@/core/analytics";
import { compact, num, timeAgo } from "@/lib/client/format";
import { useJson } from "@/lib/client/hooks";
import { Backdrop, EmptyState, SearchBox, TopBar } from "../shell";
import { useStatus } from "../status";
import { CardTitle, Select, Sparkline } from "../ui";
import { GENRE_COLORS, GenreDonut, Opportunities, QUADRANT_COLORS, SupplyDemand, TrendLines } from "./charts";

const PERIODS = [
  { value: "7", label: "Last 7 days", short: "7D" },
  { value: "30", label: "Last 30 days", short: "30D" },
  { value: "90", label: "Last 90 days", short: "90D" },
  { value: "365", label: "Last year", short: "1Y" },
  { value: "0", label: "All time", short: "All" },
];

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={clsx("flex items-center gap-0.5 text-[12px] font-medium", up ? "text-good" : "text-bad")}>
      {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function KpiCard({ icon, label, value, delta, deltaSuffix, series, color }: { icon: React.ReactNode; label: string; value: string; delta: number | null; deltaSuffix?: string; series: number[]; color: string }) {
  return (
    <div className="card-glass relative overflow-hidden px-5 py-4">
      <p className="flex items-center gap-2.5 text-[13px] text-fg/80">
        {icon}
        {label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
          <Delta value={delta} suffix={deltaSuffix} />
        </div>
        <Sparkline values={series.length > 1 ? series : [0, 0]} color={color} width={92} height={40} />
      </div>
    </div>
  );
}

const INSIGHT_ICON = {
  up: { icon: TrendingUp, bg: "bg-good/15 text-good" },
  down: { icon: TrendingDown, bg: "bg-violet/15 text-violet" },
  opportunity: { icon: Gem, bg: "bg-sky/15 text-sky" },
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

  return (
    <>
      <Backdrop tone="violet" />
      <TopBar
        left={<SearchBox value={q} onChange={setQ} placeholder="Search insights, genres, games..." />}
        right={
          <>
            <Select label="Period" value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} className="w-[150px]" />
            <Select
              label="Platform"
              value={platform}
              onChange={setPlatform}
              options={[{ value: "", label: "All Platforms" }, ...(platforms.data ?? []).map((p) => ({ value: p.name, label: p.name }))]}
              className="w-[160px]"
            />
            <a href={`/api/analytics/export?${qs}`} download className="btn-primary flex h-11 items-center gap-2 px-5 text-[13px] font-medium">
              <Download className="h-4 w-4" /> Export Report
            </a>
          </>
        }
      />

      <div className="relative z-10 px-5 pb-8 md:px-6">
        <h1 className="text-[clamp(38px,4vw,52px)] font-bold tracking-[-0.035em]">Analytics</h1>
        <p className="mt-1 text-[17px] text-fg/75">Market insights. Smarter decisions.</p>

        {empty && (
          <div className="card mt-6">
            <EmptyState title={`No games released in the ${period.label.toLowerCase()}${platform ? ` on ${platform}` : ""}`}>
              Widen the period or platform filter, or run the collector to add more games.
            </EmptyState>
          </div>
        )}

        {data && !empty && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard icon={<Gamepad2 className="h-5 w-5 text-fg" />} label="Total Games Tracked" value={num(data.kpis.totalGames.value)} delta={data.kpis.totalGames.delta} series={data.kpis.totalGames.series} color="#4ade80" />
              <KpiCard icon={<Star className="h-5 w-5 fill-yellow text-yellow" />} label="Average Metascore" value={data.kpis.avgMetascore.value?.toFixed(1) ?? "—"} delta={data.kpis.avgMetascore.delta} series={data.kpis.avgMetascore.series} color="#a855f7" />
              <KpiCard icon={<Users className="h-5 w-5 fill-sky text-sky" />} label="Average Userscore" value={data.kpis.avgUserscore.value?.toFixed(1) ?? "—"} delta={data.kpis.avgUserscore.delta} series={data.kpis.avgUserscore.series} color="#3b82f6" />
              <div className="card-glass relative overflow-hidden px-5 py-4">
                {data.kpis.trendingGenre.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.kpis.trendingGenre.coverUrl} alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-70 [mask-image:linear-gradient(90deg,transparent,black_60%)]" />
                )}
                <p className="relative flex items-center gap-2.5 text-[13px] text-fg/80">
                  <Flame className="h-5 w-5 fill-orange text-orange" /> Trending Genre
                </p>
                <div className="relative mt-3 flex items-baseline gap-2.5">
                  <span className="max-w-[70%] truncate text-[26px] font-semibold tracking-[-0.02em]">{data.kpis.trendingGenre.name ?? "—"}</span>
                  <Delta value={data.kpis.trendingGenre.growth} suffix="%" />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr]">
              <section className="card p-5">
                <CardTitle
                  right={
                    <div className="flex gap-1" role="tablist" aria-label="Period">
                      {PERIODS.slice(0, 4).map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          role="tab"
                          aria-selected={days === p.value}
                          onClick={() => setDays(p.value)}
                          className={clsx("rounded-full px-3 py-1 text-[13px]", days === p.value ? "bg-panel-3 text-fg ring-1 ring-line-2" : "text-muted hover:text-fg")}
                        >
                          {p.short}
                        </button>
                      ))}
                    </div>
                  }
                >
                  Genre Popularity
                </CardTitle>
                <div className="mt-4 flex flex-wrap items-center gap-8 px-2">
                  <GenreDonut data={data.genreShare} />
                  <ul className="min-w-[180px] flex-1 space-y-2.5 text-[13.5px]">
                    {data.genreShare.filter((g) => match(g.genre)).map((g) => (
                      <li key={g.genre} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2.5 truncate">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GENRE_COLORS[data.genreShare.indexOf(g) % GENRE_COLORS.length] }} />
                          {g.genre}
                        </span>
                        <span className="tabular-nums text-fg/85">{g.share}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="card p-5">
                <CardTitle
                  right={
                    <ul className="flex flex-wrap gap-4 text-[12px] text-muted">
                      {data.trends.series.map((s, i) => (
                        <li key={s.genre} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: GENRE_COLORS[i] }} /> {s.genre}
                        </li>
                      ))}
                    </ul>
                  }
                >
                  Trends Over Time
                </CardTitle>
                <p className="mt-1 text-[12px] text-dim">Share of releases per genre</p>
                <div className="mt-2">
                  <TrendLines data={data.trends} />
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr]">
              <section className="card p-5">
                <CardTitle>Supply vs Demand</CardTitle>
                <ul className="mt-2 flex gap-5 text-[12px] text-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#8b80c9]" /> Games released
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-violet" /> Player interest (reviews)
                  </li>
                </ul>
                <SupplyDemand data={data.supplyDemand} />
              </section>

              <section className="card relative overflow-hidden p-5">
                {data.topGames[0]?.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.topGames[0].coverUrl} alt="" className="absolute inset-y-0 right-0 h-full w-[55%] object-cover opacity-45 [mask-image:linear-gradient(90deg,transparent,black_70%)]" />
                )}
                <CardTitle
                  className="relative"
                  right={data.insights && <span className="text-[11px] text-muted">Updated {timeAgo(data.insights.createdAt)}</span>}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 fill-sky text-sky" /> Key Insights
                  </span>
                </CardTitle>
                {!data.insights ? (
                  <EmptyState title="No AI insights yet" className="relative">
                    Insights are written after a run once the library has at least three recent games.
                  </EmptyState>
                ) : (
                  <ul className="relative mt-4 max-w-[560px] space-y-4">
                    {data.insights.items.filter((i) => match(i.text)).map((i) => {
                      const meta = INSIGHT_ICON[i.kind];
                      return (
                        <li key={i.text} className="flex items-center gap-4">
                          <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", meta.bg)}>
                            <meta.icon className="h-5 w-5" />
                          </span>
                          <p className="text-[13.5px] leading-snug text-fg/90">{i.text}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
              <section className="card p-5">
                <CardTitle>
                  <span className="flex items-center gap-2">
                    Under-served Opportunities
                    <Info className="h-3.5 w-3.5 text-muted" aria-label="Genres with many reviews per game but few releases" />
                  </span>
                </CardTitle>
                <div className="mt-2 grid gap-4 md:grid-cols-[1fr_130px]">
                  <Opportunities data={data.opportunities.filter((o) => match(o.genre))} />
                  <ul className="space-y-2 self-center text-[12.5px]">
                    {data.opportunities.slice(0, 6).map((o) => (
                      <li key={o.genre} className="flex items-center gap-2 truncate" title={`${o.genre}: ${o.quadrant}`}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: QUADRANT_COLORS[o.quadrant] }} />
                        <span className="truncate">{o.genre}</span>
                      </li>
                    ))}
                    <li className="pt-1 text-[11px] text-dim">Orange: high demand, low supply</li>
                  </ul>
                </div>
              </section>

              <section className="card p-5">
                <CardTitle>
                  <span className="flex items-center gap-2">
                    Popular Combinations <Info className="h-3.5 w-3.5 text-muted" aria-label="Platforms and genres that ship together" />
                  </span>
                </CardTitle>
                {data.combinations.venn ? (
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    <svg viewBox="0 0 230 150" className="h-[150px] w-[230px]" role="img" aria-label={`${data.combinations.venn.share}% of games ship on ${data.combinations.venn.a} and ${data.combinations.venn.b}`}>
                      <circle cx="80" cy="75" r="62" fill="rgb(99 102 241 / 0.12)" stroke="#6366f1" strokeWidth="1.5" />
                      <circle cx="150" cy="75" r="62" fill="rgb(34 197 94 / 0.10)" stroke="#22c55e" strokeWidth="1.5" />
                      <text x="48" y="80" fill="#c7c9ff" fontSize="13" textAnchor="middle">{data.combinations.venn.a.slice(0, 9)}</text>
                      <text x="182" y="80" fill="#bbf7d0" fontSize="13" textAnchor="middle">{data.combinations.venn.b.slice(0, 9)}</text>
                      <text x="115" y="80" fill="#fff" fontSize="14" fontWeight="600" textAnchor="middle">{data.combinations.venn.share}%</text>
                    </svg>
                    <div className="min-w-[180px] flex-1">
                      <p className="text-[14px] leading-snug text-fg/85">
                        {data.combinations.venn.share}% of games ship on both {data.combinations.venn.a} and {data.combinations.venn.b}.
                      </p>
                      <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted">
                        {data.combinations.pairs.filter((p) => match(p.genre) || match(p.platform)).slice(0, 4).map((p) => (
                          <li key={p.genre + p.platform} className="flex justify-between gap-3">
                            <span className="truncate">
                              {p.genre} <Plus className="inline h-3 w-3" /> {p.platform}
                            </span>
                            <span className="tabular-nums text-fg/80">{p.share}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Not enough multi-platform games yet" />
                )}
              </section>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <section className="card p-5">
                <CardTitle right={<span className="pill px-3 py-1.5 text-[12px] text-muted">Player Interest</span>}>Top Games by Player Interest</CardTitle>
                {data.topGames.length === 0 ? (
                  <EmptyState title="No player reviews in this period" />
                ) : (
                  <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {data.topGames.filter((g) => match(g.title)).map((g, i) => (
                      <li key={g.slug}>
                        <Link href={`/games?game=${encodeURIComponent(g.slug)}`} className="group block">
                          <span className="relative block aspect-[4/3.4] overflow-hidden rounded-lg bg-panel-3">
                            {g.coverUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            )}
                            <span className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-[12px] font-semibold">{i + 1}</span>
                            <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgb(0_0_0/0.9))] px-2 pt-6 pb-1.5 text-[12px] leading-tight">{g.title}</span>
                          </span>
                          <span className="mt-2 flex items-baseline gap-2">
                            <span className="text-[15px] font-semibold tabular-nums">{g.interestShare}%</span>
                            <span className="text-[11px] text-muted">{compact(g.userReviews)} reviews</span>
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
                    <span className="flex items-center gap-1.5 text-[13px] text-good">
                      <span className="live-dot h-2 w-2 rounded-full bg-good" /> Live
                    </span>
                  }
                >
                  Market Activity
                </CardTitle>
                <ul className="mt-4 space-y-3">
                  {data.activity.filter((a) => match(a.title)).map((a) => (
                    <li key={`${a.ts}-${a.gameId}`} className="flex items-center gap-3 text-[12.5px]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/20 text-violet">
                        {a.kind === "added" ? <Plus className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg/85">
                        {a.kind === "added" ? "New game added" : "Updated data"}: {a.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.ts)}</span>
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

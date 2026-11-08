"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowUpRight, CircleCheck, CircleMinus, ExternalLink, Play, Sparkles, Star, ThumbsDown, X } from "lucide-react";
import { useState } from "react";
import type { GameDetailData } from "@/core/queries";
import { compact, timeAgo } from "@/lib/client/format";
import { shortPlatform } from "@/lib/platforms";
import { EmptyState } from "../shell";
import { CardTitle, PlatformBadges, ScoreBadge, Skeleton, UserScoreRing } from "../ui";

function HeroImage({ urls, className }: { urls: (string | null | undefined)[]; className?: string }) {
  const list = urls.filter((u): u is string => Boolean(u));
  const [i, setI] = useState(0);
  if (!list[i]) return <div className={clsx("bg-panel-3", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={list[i]}
      alt=""
      className={className}
      onError={() => setI((n) => n + 1)}
      onLoad={(e) => {
        // YouTube returns a 120x90 placeholder instead of 404 for missing maxres thumbnails.
        if ((e.currentTarget.naturalWidth ?? 0) <= 120) setI((n) => n + 1);
      }}
    />
  );
}

type Summary = GameDetailData["critic"];

function OpinionCard({ title, icon, items, tone, summary, emptyText }: { title: string; icon: React.ReactNode; items: string[]; tone: "like" | "dislike"; summary: Summary; emptyText: string }) {
  return (
    <div className="card-glass p-5">
      <h3 className="mb-3.5 flex items-center gap-2.5 text-[15px] font-medium">
        {icon}
        {title}
      </h3>
      {summary === null ? (
        <p className="text-[13px] text-muted">{emptyText}</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing notable mentioned.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-fg/85">
              {tone === "like" ? (
                <CircleCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 fill-good/90 text-panel" strokeWidth={2.2} />
              ) : (
                <CircleMinus className="mt-0.5 h-[17px] w-[17px] shrink-0 fill-bad/85 text-panel" strokeWidth={2.2} />
              )}
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GameDetail({ data, loading, onBack }: { data: GameDetailData | null; loading: boolean; onBack: () => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) {
    return loading ? <Skeleton className="h-[640px] w-full rounded-2xl" /> : <EmptyState title="Select a game" className="card h-[480px]">Pick a game from the list to see its scores, review summaries and let&apos;s-play insight.</EmptyState>;
  }
  const { game, platforms, critic, user, insight, customFields } = data;
  const platformNames = platforms.map((p) => p.name);
  const youtubeHero = insight ? [`https://i.ytimg.com/vi/${insight.videoId}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`] : [];

  return (
    <article aria-labelledby="game-title" className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-line/60">
        <HeroImage urls={[game.heroUrl, ...youtubeHero, game.cardImageUrl, game.coverUrl]} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_7_9/0.96)_0%,rgb(7_7_9/0.82)_42%,rgb(7_7_9/0.2)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_7_9/0.3)_0%,transparent_30%,rgb(7_7_9/0.9)_100%)]" />

        <div className="relative px-6 pt-6 pb-7 md:px-8">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-[13px] text-fg/80 hover:text-fg lg:pointer-events-none lg:opacity-0">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </button>
          <div className="mt-[clamp(40px,12vw,120px)] max-w-[620px]">
            <h1 id="game-title" className="text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.02] tracking-[-0.03em]">
              {game.title}
            </h1>
            <div className="mt-4">
              <PlatformBadges platforms={platformNames} max={6} variant="outline" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <ScoreBadge score={game.metascore} size="lg" />
                <div className="text-[14px] leading-tight">
                  <p>Metascore</p>
                  <p className="text-muted">{game.criticReviewCount ? `${compact(game.criticReviewCount)} critics` : "(out of 100)"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserScoreRing score={game.userscore} />
                <div className="text-[14px] leading-tight">
                  <p>Userscore</p>
                  <p className="text-muted">{game.userReviewCount ? `${compact(game.userReviewCount)} ratings` : "(out of 10)"}</p>
                </div>
              </div>
            </div>
            <p className="mt-5 text-[14px] text-fg/85">
              {[game.developer ?? "Unknown developer", game.genres.join(", ")].filter(Boolean).join("   •   ")}
              {game.releaseDate && <span className="text-muted">{`   •   ${new Date(`${game.releaseDate}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}`}</span>}
            </p>
            {platforms.length > 1 && (
              <table className="mt-3 text-[12px]" aria-label="Scores by platform">
                <tbody>
                  <tr className="text-muted">
                    <th scope="row" className="pr-3 text-left font-normal">Platform</th>
                    {platforms.map((p) => (
                      <td key={p.slug} className="px-2 text-center" title={p.name}>
                        {shortPlatform(p.name)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="pr-3 text-left font-normal text-muted">Metascore</th>
                    {platforms.map((p) => (
                      <td key={p.slug} className="px-2 text-center tabular-nums">{p.metascore ?? "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="pr-3 text-left font-normal text-muted">Userscore</th>
                    {platforms.map((p) => (
                      <td key={p.slug} className="px-2 text-center tabular-nums">{p.userscore ?? "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
            {game.description ? (
              <div className="mt-4 max-w-[560px]">
                <p className={clsx("whitespace-pre-line text-[14px] leading-[1.55] text-fg/80", !expanded && "line-clamp-5")}>{game.description}</p>
                {game.description.length > 320 && (
                  <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs text-accent-2 hover:underline">
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Metacritic has no description for this game yet.</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 md:absolute md:right-6 md:bottom-7 md:mt-0">
            {game.videoUrl ? (
              <a href={game.videoUrl} target="_blank" rel="noreferrer" className="card-glass flex items-center gap-3 px-5 py-3 text-[13px] hover:border-line-2" title={game.videoTitle ?? "Watch video"}>
                <Play className="h-4 w-4" /> Watch Trailer <ExternalLink className="h-3.5 w-3.5 text-muted" />
              </a>
            ) : insight ? (
              <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="card-glass flex items-center gap-3 px-5 py-3 text-[13px] hover:border-line-2" title={insight.videoTitle}>
                <Play className="h-4 w-4" /> Watch Let&apos;s-play <ExternalLink className="h-3.5 w-3.5 text-muted" />
              </a>
            ) : null}
            <a href={game.metacriticUrl} target="_blank" rel="noreferrer" className="card-glass flex items-center gap-2 px-4 py-3 text-[13px] text-muted hover:text-fg">
              Metacritic <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid gap-4 md:grid-cols-2">
        <OpinionCard title="What Critics Like" icon={<Star className="h-5 w-5 fill-yellow text-yellow" />} items={critic?.likes ?? []} tone="like" summary={critic} emptyText="No critic reviews yet." />
        <OpinionCard title="What Critics Dislike" icon={<X className="h-5 w-5 text-bad" strokeWidth={2.6} />} items={critic?.dislikes ?? []} tone="dislike" summary={critic} emptyText="No critic reviews yet." />
        <OpinionCard title="What Players Like" icon={<Sparkles className="h-5 w-5 fill-good text-good" />} items={user?.likes ?? []} tone="like" summary={user} emptyText="No player reviews yet." />
        <OpinionCard title="What Players Dislike" icon={<ThumbsDown className="h-5 w-5 fill-bad text-bad" />} items={user?.dislikes ?? []} tone="dislike" summary={user} emptyText="No player reviews yet." />
      </div>

      {(critic?.verdict || user?.verdict || customFields.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {critic?.verdict && <Verdict label="Critics' verdict" text={critic.verdict} meta={`${compact(critic.reviewCount)} reviews · ${timeAgo(critic.updatedAt)}`} />}
          {user?.verdict && <Verdict label="Players' verdict" text={user.verdict} meta={`${compact(user.reviewCount)} ratings · ${timeAgo(user.updatedAt)}`} />}
          {customFields.map((f) => (
            <Verdict key={f.key} label={f.label} text={f.value} meta={`Custom rule · ${timeAgo(f.updatedAt)}`} />
          ))}
        </div>
      )}
    </article>
  );
}

function Verdict({ label, text, meta }: { label: string; text: string; meta: string }) {
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium">{label}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-fg/80">{text}</p>
      <p className="mt-2 text-[11px] text-dim">{meta}</p>
    </div>
  );
}

export function SimilarGames({ items, onSelect }: { items: GameDetailData["similar"]; onSelect: (slug: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 4);
  return (
    <section className="card p-4" aria-labelledby="similar-title">
      <CardTitle
        className="mb-3 px-1"
        right={
          items.length > 4 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="text-xs text-muted hover:text-fg">
              {all ? "Show less" : "See all"}
            </button>
          )
        }
      >
        <span id="similar-title">Similar Games</span>
      </CardTitle>
      {items.length === 0 ? (
        <EmptyState title="No similar games yet">Similar titles appear as the library grows.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {shown.map((s) => (
            <li key={s.slug}>
              <button type="button" onClick={() => onSelect(s.slug)} className="group relative block h-[170px] w-full overflow-hidden rounded-xl text-left">
                <HeroImage urls={[s.coverUrl, s.heroUrl]} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(7_7_9/0.95)_100%)]" />
                <span className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] leading-tight group-hover:underline">{s.title}</span>
                    <span className="mt-1.5 block">
                      <PlatformBadges platforms={s.platforms} max={2} />
                    </span>
                  </span>
                  <ScoreBadge score={s.metascore} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function YoutubeInsight({ insight }: { insight: GameDetailData["insight"] }) {
  return (
    <section className="card p-4" aria-labelledby="yt-title">
      <CardTitle className="mb-3 px-1">
        <span id="yt-title" className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 20" className="h-5 w-7" aria-hidden>
            <rect width="28" height="20" rx="5" fill="#ff0033" />
            <path d="M11 6l7 4-7 4z" fill="white" />
          </svg> YouTube Insights
        </span>
      </CardTitle>
      {!insight ? (
        <EmptyState title="No let's-play analysed yet">The worker looks for a popular commentated let&apos;s-play once the game has reviews.</EmptyState>
      ) : (
        <div className="grid grid-cols-[150px_1fr] gap-3.5">
          <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="group relative block h-[120px] overflow-hidden rounded-lg" aria-label={`Watch ${insight.videoTitle}`}>
            <HeroImage urls={[`https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`]} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur group-hover:bg-black/80">
                <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
              </span>
            </span>
          </a>
          <div className="min-w-0">
            <p className="text-[12.5px] leading-[1.5] text-fg/85">{insight.conclusion}</p>
            <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-accent-2 underline-offset-2 hover:underline">
              Watch full video <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="col-span-2 truncate text-[11px] text-dim" title={insight.videoTitle}>
            {insight.channel ?? "Unknown channel"} · {compact(insight.views)} views · {insight.videoTitle}
          </p>
          {insight.highlights.length > 0 && (
            <ul className="col-span-2 flex flex-wrap gap-1.5">
              {insight.highlights.map((h) => (
                <li key={h} className="rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-fg/75">
                  {h}
                </li>
              ))}
            </ul>
          )}
          <details className="col-span-2 text-[11px] text-muted">
            <summary className="cursor-pointer hover:text-fg">Transcript excerpt</summary>
            <p className="mt-2 max-h-40 overflow-auto whitespace-pre-line leading-relaxed">{insight.transcript.slice(0, 1500)}</p>
          </details>
        </div>
      )}
    </section>
  );
}

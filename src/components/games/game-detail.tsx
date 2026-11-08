"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowUpRight, CircleCheck, CircleMinus, ExternalLink, Play, Sparkles, Star, ThumbsDown, X } from "lucide-react";
import { useState } from "react";
import type { GameDetailData } from "@/core/queries";
import { compact, timeAgo } from "@/lib/client/format";
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
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 3);
  return (
    <div className="card-glass px-4 py-3.5">
      <h3 className="mb-2.5 flex items-center gap-2.5 text-[14.5px] font-medium">
        {icon}
        {title}
        {items.length > 3 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto text-[12px] font-normal text-muted hover:text-fg" aria-expanded={open}>
            {open ? "Show less" : `+${items.length - 3} more`}
          </button>
        )}
      </h3>
      {summary === null ? (
        <p className="text-[13px] text-muted">{emptyText}</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing notable mentioned.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-[13px] text-fg/85">
              {tone === "like" ? (
                <CircleCheck className="h-4 w-4 shrink-0 fill-good/90 text-panel" strokeWidth={2.2} />
              ) : (
                <CircleMinus className="h-4 w-4 shrink-0 fill-bad/85 text-panel" strokeWidth={2.2} />
              )}
              <span className={clsx(!open && "truncate")} title={t}>
                {t}
              </span>
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
  const { game, platforms, critic, user, insight } = data;
  const platformNames = platforms.map((p) => p.name);
  const youtubeHero = insight ? [`https://i.ytimg.com/vi/${insight.videoId}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`] : [];

  return (
    <article aria-labelledby="game-title" className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-line/60">
        <HeroImage urls={[game.heroUrl, ...youtubeHero, game.cardImageUrl, game.coverUrl]} className="absolute inset-0 h-full w-full object-cover opacity-95" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(11_11_13/0.92)_0%,rgb(11_11_13/0.72)_45%,rgb(11_11_13/0)_80%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_11_13/0.15)_0%,transparent_35%,rgb(11_11_13/0.75)_100%)]" />

        <div className="relative px-6 pt-5 pb-6 md:px-8">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-[13px] text-fg/80 hover:text-fg lg:pointer-events-none lg:opacity-0">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </button>
          <div className="mt-[clamp(28px,6.5vw,96px)] max-w-[600px]">
            <h1 id="game-title" className="line-clamp-2 text-[clamp(32px,4vw,48px)] font-semibold leading-[1.02] tracking-[-0.03em]">
              {game.title}
            </h1>
            <div className="mt-3">
              <PlatformBadges platforms={platformNames} max={6} variant="outline" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
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
            <p className="mt-4 text-[14px] text-fg/85">
              {[game.developer ?? "Unknown developer", game.genres.join(", ")].filter(Boolean).join("   •   ")}
              {game.releaseDate && <span className="text-muted">{`   •   ${new Date(`${game.releaseDate}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}`}</span>}
              <a href={game.metacriticUrl} target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-0.5 text-[12px] text-muted hover:text-fg">
                Metacritic <ArrowUpRight className="h-3 w-3" />
              </a>
            </p>
            {game.description ? (
              <div className="mt-3 max-w-[430px]">
                <p className={clsx("whitespace-pre-line text-[14px] leading-[1.5] text-fg/80", !expanded && "line-clamp-4")}>{game.description}</p>
                {game.description.length > 240 && (
                  <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs text-accent-2 hover:underline">
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Metacritic has no description for this game yet.</p>
            )}
          </div>

          {(game.videoUrl || insight) && (
            <a
              href={game.videoUrl ?? insight!.videoUrl}
              target="_blank"
              rel="noreferrer"
              title={game.videoUrl ? (game.videoTitle ?? "Watch video") : insight!.videoTitle}
              className="card-glass mt-5 inline-flex items-center gap-3 px-5 py-3 text-[13px] hover:border-line-2 md:absolute md:top-1/2 md:right-6 md:mt-0"
            >
              <Play className="h-4 w-4" /> {game.videoUrl ? "Watch Trailer" : "Watch Let's-play"} <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
          )}
        </div>
      </div>

      <div className="relative mt-3 grid gap-3 md:grid-cols-2">
        <OpinionCard title="What Critics Like" icon={<Star className="h-5 w-5 fill-yellow text-yellow" />} items={critic?.likes ?? []} tone="like" summary={critic} emptyText="No critic reviews yet." />
        <OpinionCard title="What Critics Dislike" icon={<X className="h-5 w-5 text-bad" strokeWidth={2.6} />} items={critic?.dislikes ?? []} tone="dislike" summary={critic} emptyText="No critic reviews yet." />
        <OpinionCard title="What Players Like" icon={<Sparkles className="h-5 w-5 fill-good text-good" />} items={user?.likes ?? []} tone="like" summary={user} emptyText="No player reviews yet." />
        <OpinionCard title="What Players Dislike" icon={<ThumbsDown className="h-5 w-5 fill-bad text-bad" />} items={user?.dislikes ?? []} tone="dislike" summary={user} emptyText="No player reviews yet." />
      </div>
    </article>
  );
}

/** Secondary facts kept out of the reference layout: verdicts, per-platform scores, custom rules, transcript. */
export function GameExtras({ data }: { data: GameDetailData }) {
  const { platforms, critic, user, insight, customFields } = data;
  return (
    <details className="card group px-5 py-3.5" open={false}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-medium">
        Verdicts, scores by platform{customFields.length ? ", custom fields" : ""} and transcript
        <span className="text-[12px] font-normal text-muted group-open:hidden">Show</span>
        <span className="hidden text-[12px] font-normal text-muted group-open:inline">Hide</span>
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {critic?.verdict && <Verdict label="Critics' verdict" text={critic.verdict} meta={`${compact(critic.reviewCount)} reviews · ${timeAgo(critic.updatedAt)}`} />}
        {user?.verdict && <Verdict label="Players' verdict" text={user.verdict} meta={`${compact(user.reviewCount)} ratings · ${timeAgo(user.updatedAt)}`} />}
        {customFields.map((f) => (
          <Verdict key={f.key} label={f.label} text={f.value} meta={`Custom rule · ${timeAgo(f.updatedAt)}`} />
        ))}
        <div className="card overflow-x-auto p-5">
          <p className="text-[13px] font-medium">Scores by platform</p>
          <table className="mt-3 w-full text-left text-[12.5px]" aria-label="Scores by platform">
            <thead className="text-muted">
              <tr>
                <th className="pb-1.5 font-normal">Platform</th>
                <th className="pb-1.5 font-normal">Metascore</th>
                <th className="pb-1.5 font-normal">Userscore</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.slug} className="border-t border-line/60">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 tabular-nums">{p.metascore ?? "tbd"}</td>
                  <td className="py-1.5 tabular-nums">{p.userscore ?? "tbd"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {insight && (
          <div className="card p-5">
            <p className="text-[13px] font-medium">Let&apos;s-play transcript excerpt</p>
            <p className="mt-1 text-[11px] text-dim">
              {insight.channel ?? "Unknown channel"} · {compact(insight.views)} views · {insight.videoTitle}
            </p>
            {insight.highlights.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {insight.highlights.map((h) => (
                  <li key={h} className="rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-fg/75">
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 max-h-40 overflow-auto text-[12px] leading-relaxed whitespace-pre-line text-muted">{insight.transcript.slice(0, 1500)}</p>
          </div>
        )}
      </div>
    </details>
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
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shown.map((s) => (
            <li key={s.slug}>
              <button type="button" onClick={() => onSelect(s.slug)} className="group relative block h-[152px] w-full overflow-hidden rounded-xl text-left">
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
        <div className="grid grid-cols-[140px_1fr] gap-3.5">
          <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="group relative block h-[118px] overflow-hidden rounded-lg" aria-label={`Watch ${insight.videoTitle}`}>
            <HeroImage urls={[`https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`]} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur group-hover:bg-black/80">
                <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
              </span>
            </span>
          </a>
          <div className="min-w-0">
            <p className="line-clamp-6 text-[12.5px] leading-[1.45] text-fg/85" title={insight.conclusion}>
              {insight.conclusion}
            </p>
            <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-accent-2 underline-offset-2 hover:underline">
              Watch full video <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

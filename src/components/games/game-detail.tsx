"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowUpRight, ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import type { GameDetailData } from "@/core/queries";
import { compact, longDate, plural, timeAgo } from "@/lib/client/format";
import { genreRu } from "@/lib/genres";
import { realPoints } from "@/lib/opinions";
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

function OpinionCard({ title, items, tone, summary, emptyText }: { title: string; items: string[]; tone: "like" | "dislike"; summary: Summary; emptyText: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 3);
  return (
    <div className="card px-4 py-4">
      <h3 className="mb-3 flex items-center text-sm font-medium">
        {title}
        {items.length > 3 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto font-mono text-xs font-normal text-dim transition-colors hover:text-fg" aria-expanded={open}>
            {open ? "Свернуть" : `ещё ${items.length - 3}`}
          </button>
        )}
      </h3>
      {summary === null ? (
        <p className="text-[13px] text-dim">{emptyText}</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-dim">Ничего заметного не упомянуто</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-[13px] text-muted">
              <span aria-hidden className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", tone === "like" ? "bg-good" : "bg-bad")} />
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
    return loading ? <Skeleton className="h-[640px] w-full rounded-2xl" /> : <EmptyState title="Выберите игру" className="card h-[480px]">Выберите игру в списке, чтобы увидеть оценки, сводки отзывов и вывод по летсплею.</EmptyState>;
  }
  const { game, platforms, critic, user, insight } = data;
  const platformNames = platforms.map((p) => p.name);
  const youtubeHero = insight ? [`https://i.ytimg.com/vi/${insight.videoId}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`] : [];

  return (
    <article aria-labelledby="game-title" className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <HeroImage urls={[game.heroUrl, ...youtubeHero, game.cardImageUrl, game.coverUrl]} className="absolute inset-0 h-full w-full object-cover opacity-95" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(20_20_21/0.94)_0%,rgb(20_20_21/0.74)_45%,rgb(20_20_21/0)_80%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(20_20_21/0.15)_0%,transparent_35%,rgb(20_20_21/0.8)_100%)]" />

        <div className="relative px-6 pt-5 pb-6 md:px-8">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-[13px] text-muted transition-colors hover:text-fg lg:pointer-events-none lg:opacity-0">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> К списку
          </button>
          <div className="mt-[clamp(28px,6.5vw,96px)] max-w-150">
            <h1 id="game-title" className="line-clamp-2 text-[clamp(32px,4vw,48px)] leading-[1.05] font-medium tracking-[-0.02em]">
              {game.title}
            </h1>
            <div className="mt-3">
              <PlatformBadges platforms={platformNames} max={6} variant="outline" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-3">
                <ScoreBadge score={game.metascore} size="lg" />
                <div className="text-sm leading-5">
                  <p>Metascore</p>
                  <p className="font-mono text-xs text-dim">{game.criticReviewCount ? `${compact(game.criticReviewCount)} ${plural(game.criticReviewCount, ["критик", "критика", "критиков"])}` : "из 100"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserScoreRing score={game.userscore} />
                <div className="text-sm leading-5">
                  <p>Userscore</p>
                  <p className="font-mono text-xs text-dim">{game.userReviewCount ? `${compact(game.userReviewCount)} ${plural(game.userReviewCount, ["оценка", "оценки", "оценок"])}` : "из 10"}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="text-fg">{game.developer ?? "Разработчик неизвестен"}</span>
              {game.genres.length > 0 && <span>{game.genres.map(genreRu).join(", ")}</span>}
              {game.releaseDate && (
                <span className="font-mono text-xs text-dim">
                  {longDate(game.releaseDate)}
                </span>
              )}
              <a href={game.metacriticUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-dim transition-colors hover:text-fg">
                Metacritic <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </a>
            </p>
            {game.description ? (
              <div className="mt-3 max-w-[430px]">
                <p className={clsx("whitespace-pre-line text-sm leading-[22px] text-muted", !expanded && "line-clamp-4")}>{game.description}</p>
                {game.description.length > 240 && (
                  <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs text-fg underline-offset-2 hover:underline">
                    {expanded ? "Свернуть" : "Читать полностью"}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">У Metacritic пока нет описания этой игры.</p>
            )}
          </div>

          {(game.videoUrl || insight) && (
            <a
              href={game.videoUrl ?? insight!.videoUrl}
              target="_blank"
              rel="noreferrer"
              title={game.videoUrl ? (game.videoTitle ?? "Смотреть видео") : insight!.videoTitle}
              className="btn-secondary mt-5 inline-flex h-10 items-center gap-2 px-4 text-[13px] md:absolute md:top-1/2 md:right-6 md:mt-0"
            >
              <Play className="h-4 w-4" strokeWidth={1.5} /> {game.videoUrl ? "Смотреть трейлер" : "Смотреть летсплей"} <ExternalLink className="h-4 w-4 text-dim" strokeWidth={1.5} />
            </a>
          )}
        </div>
      </div>

      <div className="relative mt-3 grid gap-3 md:grid-cols-2">
        <OpinionCard title="Что нравится критикам" items={realPoints(critic?.likes ?? [])} tone="like" summary={critic} emptyText="Рецензий критиков пока нет" />
        <OpinionCard title="Что не нравится критикам" items={realPoints(critic?.dislikes ?? [])} tone="dislike" summary={critic} emptyText="Рецензий критиков пока нет" />
        <OpinionCard title="Что нравится игрокам" items={realPoints(user?.likes ?? [])} tone="like" summary={user} emptyText="Отзывов игроков пока нет" />
        <OpinionCard title="Что не нравится игрокам" items={realPoints(user?.dislikes ?? [])} tone="dislike" summary={user} emptyText="Отзывов игроков пока нет" />
      </div>
    </article>
  );
}

/** Secondary facts kept out of the reference layout: verdicts, per-platform scores, custom rules, transcript. */
export function GameExtras({ data }: { data: GameDetailData }) {
  const { platforms, critic, user, insight, customFields } = data;
  return (
    <details className="card group px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
        Вердикты, оценки по платформам{customFields.length ? ", свои поля" : ""} и расшифровка
        <span className="text-xs font-normal text-dim group-open:hidden">Показать</span>
        <span className="hidden text-xs font-normal text-dim group-open:inline">Скрыть</span>
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {critic?.verdict && <Verdict label="Вердикт критиков" text={critic.verdict} meta={`${compact(critic.reviewCount)} ${plural(critic.reviewCount, ["рецензия", "рецензии", "рецензий"])}, ${timeAgo(critic.updatedAt)}`} />}
        {user?.verdict && <Verdict label="Вердикт игроков" text={user.verdict} meta={`${compact(user.reviewCount)} ${plural(user.reviewCount, ["оценка", "оценки", "оценок"])}, ${timeAgo(user.updatedAt)}`} />}
        {customFields.map((f) => (
          <Verdict key={f.key} label={f.label} text={f.value} meta={`Своё правило, ${timeAgo(f.updatedAt)}`} />
        ))}
        <div className="card overflow-x-auto p-5">
          <p className="text-[13px] font-medium">Оценки по платформам</p>
          <table className="mt-3 w-full text-left text-[13px]" aria-label="Оценки по платформам">
            <thead className="text-xs text-dim">
              <tr>
                <th className="pb-1.5 font-normal">Платформа</th>
                <th className="pb-1.5 font-normal">Metascore</th>
                <th className="pb-1.5 font-normal">Userscore</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.slug} className="border-t border-line">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 font-mono tabular-nums">{p.metascore ?? "—"}</td>
                  <td className="py-1.5 font-mono tabular-nums">{p.userscore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {insight && (
          <div className="card p-5">
            <p className="text-[13px] font-medium">Фрагмент расшифровки летсплея</p>
            <p className="mt-1 font-mono text-xs text-dim">
              {insight.channel ?? "Неизвестный канал"}, {compact(insight.views)} {plural(insight.views ?? 0, ["просмотр", "просмотра", "просмотров"])}, {insight.videoTitle}
            </p>
            {insight.highlights.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {insight.highlights.map((h) => (
                  <li key={h} className="rounded-md bg-panel-3 px-2 py-1 text-xs text-muted">
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 max-h-40 overflow-auto text-[13px] leading-5 whitespace-pre-line text-muted">{insight.transcript.slice(0, 1500)}</p>
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
      <p className="mt-2 text-[13px] leading-5 text-muted">{text}</p>
      <p className="mt-2 font-mono text-xs text-dim">{meta}</p>
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
            <button type="button" onClick={() => setAll((a) => !a)} className="text-xs text-dim transition-colors hover:text-fg">
              {all ? "Свернуть" : "Показать все"}
            </button>
          )
        }
      >
        <span id="similar-title">Похожие игры</span>
      </CardTitle>
      {items.length === 0 ? (
        <EmptyState title="Похожих игр пока нет">Они появятся, когда библиотека подрастёт.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shown.map((s) => (
            <li key={s.slug}>
              <button type="button" onClick={() => onSelect(s.slug)} className="group relative block h-[152px] w-full overflow-hidden rounded-md text-left">
                <HeroImage urls={[s.coverUrl, s.heroUrl]} className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(20_20_21/0.95)_100%)]" />
                <span className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] leading-4 underline-offset-2 group-hover:underline">{s.title}</span>
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
      <CardTitle className="mb-4 px-1">
        <span id="yt-title" className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 20" className="h-4 w-[22px]" aria-hidden>
            <rect width="28" height="20" rx="5" fill="#ff0033" />
            <path d="M11 6l7 4-7 4z" fill="white" />
          </svg> Вывод по YouTube
        </span>
      </CardTitle>
      {!insight ? (
        <EmptyState title="Летсплей ещё не разобран">Когда у игры появятся отзывы, воркер найдёт популярный летсплей с комментариями.</EmptyState>
      ) : (
        <div className="grid grid-cols-[140px_1fr] gap-3.5">
          <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="group relative block h-[118px] overflow-hidden rounded-lg" aria-label={`Смотреть ${insight.videoTitle}`}>
            <HeroImage urls={[`https://i.ytimg.com/vi/${insight.videoId}/hqdefault.jpg`]} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg/80 transition-colors group-hover:bg-bg">
                <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
              </span>
            </span>
          </a>
          <div className="min-w-0">
            <p className="line-clamp-6 text-[13px] leading-5 text-muted" title={insight.conclusion}>
              {insight.conclusion}
            </p>
            <a href={insight.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] text-fg underline-offset-2 hover:underline">
              Смотреть видео целиком <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

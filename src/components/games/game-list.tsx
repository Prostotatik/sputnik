"use client";

import clsx from "clsx";
import { Maximize2 } from "lucide-react";
import type { GameListItem } from "@/core/queries";
import { count, dateTime, longDate, shortDate, timeAgo } from "@/lib/client/format";
import { EmptyState } from "../shell";
import { PlatformBadges, ScoreBadge, Skeleton } from "../ui";

export const SORT_OPTIONS = [
  { value: "release", label: "Сначала новые релизы" },
  { value: "metascore", label: "По Metascore" },
  { value: "userscore", label: "По Userscore" },
  { value: "updated", label: "Недавно обновлённые" },
];

export function GameList({
  items,
  total,
  sort,
  selected,
  onSelect,
  onShowAll,
  loading,
  filtered,
}: {
  items: GameListItem[];
  total: number;
  sort: string;
  selected: string | null;
  onSelect: (slug: string) => void;
  onShowAll: () => void;
  loading: boolean;
  filtered: boolean;
}) {
  // The right-hand label shows the field the list is sorted by, so the order always reads correctly.
  const byUpdate = sort === "updated";
  return (
    <section aria-label="Список игр" className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h1 className="text-xl font-medium">Новые игры</h1>
        <span className="font-mono text-xs text-dim tabular-nums">{count(total, ["игра", "игры", "игр"])}</span>
      </div>
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[66px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={filtered ? "Под эти фильтры игр нет" : "Игры ещё не собраны"} className="card">
          {filtered ? "Очистите поиск или выберите другую платформу." : "Нажмите «Запустить», чтобы собрать первые 20 игр с Metacritic."}
        </EmptyState>
      ) : (
        <ul className="space-y-1">
          {items.map((g) => {
            const active = g.slug === selected;
            return (
              <li key={g.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(g.slug)}
                  aria-current={active ? "true" : undefined}
                  className={clsx(
                    "grid w-full grid-cols-[56px_1fr_auto_auto] items-center gap-3 rounded-lg border p-1 pr-3 text-left transition-colors",
                    active ? "border-line bg-panel-3" : "border-transparent hover:bg-panel-2",
                  )}
                >
                  <span className="h-14 w-14 overflow-hidden rounded-[6px] bg-panel-3">
                    {g.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-[13px] leading-snug text-fg" title={g.title}>{g.title}</span>
                    <span className="mt-1.5 block overflow-hidden [&>span]:flex-nowrap">
                      <PlatformBadges platforms={g.platforms} max={2} />
                    </span>
                  </span>
                  <ScoreBadge score={g.metascore} />
                  <span
                    className="min-w-14 text-right font-mono text-xs whitespace-nowrap text-dim"
                    title={byUpdate ? `Обновлено ${dateTime(g.updatedAt)}` : g.releaseDate ? `Релиз ${longDate(g.releaseDate)}` : "Дата релиза не объявлена"}
                  >
                    {byUpdate ? timeAgo(g.updatedAt) : shortDate(g.releaseDate)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length < total && (
        <button
          type="button"
          onClick={onShowAll}
          aria-haspopup="dialog"
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-dim transition-colors hover:text-fg"
        >
          Показать все: {count(total, ["игра", "игры", "игр"])} <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

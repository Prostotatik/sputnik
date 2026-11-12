"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { GameListItem } from "@/core/queries";
import { count, num, shortDate, timeAgo } from "@/lib/client/format";
import { genreRu } from "@/lib/genres";
import { useJson } from "@/lib/client/hooks";
import { EmptyState, SearchBox } from "../shell";
import { Dialog, PlatformBadges, ScoreBadge, Select, Skeleton } from "../ui";
import { SORT_OPTIONS } from "./game-list";

const PAGE_SIZE = 25;

export interface LibraryFilters {
  q: string;
  platform: string;
  sort: string;
}

/**
 * The whole library in a modal: search, platform, sort and paged results. Picking a game opens its card.
 * Mount it only while open, so it starts from the filters on the page each time.
 */
export function LibraryDialog({
  open,
  onClose,
  initial,
  platforms,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  initial: LibraryFilters;
  platforms: { name: string; count: number }[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const [filters, setFilters] = useState(initial);
  const [debouncedQ, setDebouncedQ] = useState(initial.q);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.q), 250);
    return () => clearTimeout(id);
  }, [filters.q]);

  const query = new URLSearchParams({ q: debouncedQ, platform: filters.platform, sort: filters.sort, offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
  const list = useJson<{ items: GameListItem[]; total: number }>(open ? `/api/games?${query}` : null);
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const patch = (p: Partial<LibraryFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Библиотека игр"
      subtitle={`${count(total, ["игра", "игры", "игр"])}${filters.platform ? ` на ${filters.platform}` : ""}${debouncedQ ? ` по запросу «${debouncedQ}»` : ""}`}
      className="sm:h-[calc(100dvh-48px)]"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="font-mono text-xs text-dim tabular-nums">
            {total ? `${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} из ${num(total)}` : "0 игр"}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="btn-secondary flex h-8 items-center gap-1 px-2.5 text-[13px] disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Назад
            </button>
            <span className="font-mono text-xs text-muted tabular-nums">
              {page + 1} / {pages}
            </span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pages} className="btn-secondary flex h-8 items-center gap-1 px-2.5 text-[13px] disabled:opacity-40">
              Дальше <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <SearchBox value={filters.q} onChange={(q) => patch({ q })} placeholder="Поиск по библиотеке" />
        </div>
        <Select
          label="Платформа"
          value={filters.platform}
          onChange={(platform) => patch({ platform })}
          options={[{ value: "", label: "Все платформы" }, ...platforms.map((p) => ({ value: p.name, label: `${p.name} (${p.count})` }))]}
          className="w-[190px] max-sm:flex-1"
        />
        <Select label="Сортировка" value={filters.sort} onChange={(sort) => patch({ sort })} options={SORT_OPTIONS} className="w-[190px] max-sm:flex-1" />
      </div>

      <div className="mt-4 hidden grid-cols-[44px_1fr_150px_92px_56px_56px_72px] gap-3 px-2 pb-2 text-[11px] text-dim md:grid" aria-hidden>
        <span />
        <span>Игра</span>
        <span>Платформы</span>
        <span>Релиз</span>
        <span className="text-center">Meta</span>
        <span className="text-center">User</span>
        <span className="text-right">Обновлено</span>
      </div>
      {list.loading && items.length === 0 ? (
        <div className="space-y-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-[52px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Под эти фильтры игр нет">Очистите поиск или выберите другую платформу.</EmptyState>
      ) : (
        <ul className={clsx("space-y-0.5 transition-opacity", list.loading && "opacity-60")}>
          {items.map((g) => (
            <li key={g.slug}>
              <button
                type="button"
                onClick={() => onSelect(g.slug)}
                aria-current={g.slug === selected ? "true" : undefined}
                className={clsx(
                  "grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-lg border px-2 py-1 text-left transition-colors md:grid-cols-[44px_1fr_150px_92px_56px_56px_72px]",
                  g.slug === selected ? "border-line bg-panel-3" : "border-transparent hover:bg-panel-2",
                )}
              >
                <span className="h-11 w-11 overflow-hidden rounded-md bg-panel-3">
                  {g.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-1 text-[13px] text-fg" title={g.title}>
                    {g.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-dim">{g.genres.slice(0, 2).map(genreRu).join(", ") || "Жанр не указан"}</span>
                  <span className="mt-1 block font-mono text-[11px] text-dim md:hidden">
                    {shortDate(g.releaseDate)} · {g.platforms.slice(0, 3).join(", ")}
                  </span>
                </span>
                <span className="hidden overflow-hidden md:block [&>span]:flex-nowrap">
                  <PlatformBadges platforms={g.platforms} max={2} />
                </span>
                <span className="hidden font-mono text-xs text-muted md:block">{shortDate(g.releaseDate)}</span>
                <span className="flex justify-center">
                  <ScoreBadge score={g.metascore} />
                </span>
                <span className="hidden text-center font-mono text-xs text-muted tabular-nums md:block">{g.userscore === null ? "—" : g.userscore.toFixed(1)}</span>
                <span className="hidden text-right font-mono text-xs text-dim md:block">{timeAgo(g.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

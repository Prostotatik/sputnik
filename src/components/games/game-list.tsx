"use client";

import clsx from "clsx";
import { ChevronDown, Loader2 } from "lucide-react";
import type { GameListItem } from "@/core/queries";
import { num, timeAgo } from "@/lib/client/format";
import { EmptyState } from "../shell";
import { PlatformBadges, ScoreBadge, Skeleton } from "../ui";

export function GameList({
  items,
  total,
  selected,
  onSelect,
  onMore,
  loading,
  filtered,
}: {
  items: GameListItem[];
  total: number;
  selected: string | null;
  onSelect: (slug: string) => void;
  onMore: () => void;
  loading: boolean;
  filtered: boolean;
}) {
  return (
    <section aria-label="Game list" className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em]">New Games</h1>
        <span className="text-xs text-muted">{num(total)} games</span>
      </div>
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[66px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={filtered ? "No games match these filters" : "No games collected yet"} className="card">
          {filtered ? "Clear the search or pick another platform." : "Press Run Now to collect the first 20 games from Metacritic."}
        </EmptyState>
      ) : (
        <ul className="space-y-[3px]">
          {items.map((g) => {
            const active = g.slug === selected;
            return (
              <li key={g.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(g.slug)}
                  aria-current={active ? "true" : undefined}
                  className={clsx(
                    "grid w-full grid-cols-[60px_1fr_auto_auto] items-center gap-3 rounded-xl border p-1 pr-3 text-left transition-colors",
                    active ? "border-line-2 bg-panel-3/90" : "border-transparent hover:bg-panel-2/70",
                  )}
                >
                  <span className="h-[54px] w-[60px] overflow-hidden rounded-md bg-panel-3">
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
                  <span className="w-[52px] text-right text-[11px] whitespace-nowrap text-muted">{timeAgo(g.updatedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length < total && (
        <button
          type="button"
          onClick={onMore}
          disabled={loading}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted hover:text-fg"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Show more <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

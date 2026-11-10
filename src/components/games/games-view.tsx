"use client";

import clsx from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameDetailData, GameListItem } from "@/core/queries";
import { useJson } from "@/lib/client/hooks";
import { ServiceMonitor } from "../service-monitor";
import { RunNowButton, SearchBox, TopBar } from "../shell";
import { useStatus } from "../status";
import { Select } from "../ui";
import { GameDetail, GameExtras, SimilarGames, YoutubeInsight } from "./game-detail";
import { GameList, SORT_OPTIONS } from "./game-list";
import { LibraryDialog } from "./library-dialog";

const PAGE = 10;
const DEFAULT_SORT = "release";

export function GamesView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useStatus();
  const platform = params.get("platform") ?? "";
  const sort = params.get("sort") ?? DEFAULT_SORT;
  const selected = params.get("game");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [list, setList] = useState<{ query: string; items: GameListItem[]; total: number }>({ query: "", items: [], total: 0 });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(Boolean(selected));

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q);
      setParam({ q: q || null });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const lastUpdate = status?.totals.lastUpdate ?? 0;
  const query = useMemo(() => new URLSearchParams({ q: debouncedQ, platform, sort }).toString(), [debouncedQ, platform, sort]);

  const fetchList = useCallback(
    async (offset: number, limit: number) => {
      const res = await fetch(`/api/games?${query}&offset=${offset}&limit=${limit}`, { cache: "no-store" });
      return (await res.json()) as { items: GameListItem[]; total: number };
    },
    [query],
  );

  // Reload when filters change, and live-refresh while the worker adds games.
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      const body = await fetchList(0, PAGE);
      if (!cancelled) setList({ query, ...body });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [fetchList, query, lastUpdate]);

  const items = list.query === query ? list.items : [];
  const total = list.query === query ? list.total : 0;
  const loading = list.query !== query;

  const current = selected ?? items[0]?.slug ?? null;
  const detail = useJson<GameDetailData>(current ? `/api/games/${encodeURIComponent(current)}` : null);
  const { refresh: refreshDetail } = detail;
  useEffect(() => {
    if (lastUpdate) refreshDetail();
  }, [lastUpdate, refreshDetail]);

  const platforms = useJson<{ name: string; count: number }[]>(`/api/platforms?u=${lastUpdate ? Math.floor(lastUpdate / 60000) : 0}`);

  const select = (slug: string) => {
    setParam({ game: slug });
    setMobileDetail(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const detailData = detail.data && detail.data.game.slug === current ? detail.data : null;

  return (
    <>
            <TopBar
        left={<SearchBox value={q} onChange={setQ} placeholder="Search games" />}
        right={
          <>
            <Select
              label="Platform"
              value={platform}
              onChange={(v) => setParam({ platform: v || null })}
              options={[{ value: "", label: "All platforms" }, ...(platforms.data ?? []).map((p) => ({ value: p.name, label: `${p.name} (${p.count})` }))]}
              className="w-[170px]"
            />
            <Select label="Sort" value={sort} onChange={(v) => setParam({ sort: v === DEFAULT_SORT ? null : v })} options={SORT_OPTIONS} className="w-[210px]" />
            <RunNowButton />
          </>
        }
      />
      <div className="relative z-10 grid items-start gap-5 px-6 pb-6 lg:grid-cols-[296px_1fr]">
        <div className={clsx(mobileDetail && "hidden lg:block")}>
          <GameList
            items={items}
            total={total}
            sort={sort}
            selected={current}
            onSelect={select}
            onShowAll={() => setLibraryOpen(true)}
            loading={loading}
            filtered={Boolean(debouncedQ || platform)}
          />
          {libraryOpen && (
            <LibraryDialog
              open
              onClose={() => setLibraryOpen(false)}
              initial={{ q: debouncedQ, platform, sort }}
              platforms={platforms.data ?? []}
              selected={current}
              onSelect={(slug) => {
                setLibraryOpen(false);
                select(slug);
              }}
            />
          )}
        </div>
        <div className={clsx(!mobileDetail && "hidden lg:block")}>
          <GameDetail data={detailData} loading={detail.loading || loading} onBack={() => setMobileDetail(false)} />
        </div>
      </div>
      {detailData && (
        <div className="relative z-10 grid items-start gap-5 px-6 pb-6 lg:grid-cols-[1fr_368px]">
          <SimilarGames items={detailData.similar} onSelect={select} />
          <YoutubeInsight insight={detailData.insight} />
        </div>
      )}
      <div className="relative z-10">
        <ServiceMonitor />
      </div>
      {detailData && (
        <div className="relative z-10 px-6 pb-6">
          <GameExtras data={detailData} />
        </div>
      )}
    </>
  );
}

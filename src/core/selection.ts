import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { dailyState } from "@/lib/db/schema";
import type { FinderItem } from "./metacritic/map";

export interface DailyState {
  day: string;
  phase: "new-releases" | "browse";
  /** Next See All page to read (1-based). */
  page: number;
  processed: string[];
  videoSeconds: number;
}

export interface SelectionSource {
  newReleases(limit: number): Promise<FinderItem[]>;
  browseNew(page: number, pageSize: number): Promise<{ items: FinderItem[]; total: number }>;
}

export interface SelectionOptions {
  quota: number;
  newReleasesLimit: number;
  pageSize: number;
  maxPages: number;
}

export type Candidate = FinderItem & { source: "new-releases" | "browse"; page?: number };

export interface SelectionResult {
  candidates: Candidate[];
  state: DailyState;
  pagesVisited: number[];
}

export function freshState(day: string): DailyState {
  return { day, phase: "new-releases", page: 1, processed: [], videoSeconds: 0 };
}

/** Returns today's state, resetting it when the stored day differs. */
export function rollover(state: DailyState | null, today: string): DailyState {
  return state && state.day === today ? state : freshState(today);
}

/**
 * Picks up to `quota` games not processed today: New Releases first, then See All pages
 * (newest first) starting at the stored cursor. Pure apart from calls to `source`.
 */
export async function selectCandidates(
  state: DailyState,
  source: SelectionSource,
  opts: SelectionOptions,
): Promise<SelectionResult> {
  const taken = new Set(state.processed);
  const candidates: Candidate[] = [];
  const next: DailyState = { ...state, processed: [...state.processed] };
  const pagesVisited: number[] = [];

  const take = (item: FinderItem, extra: Pick<Candidate, "source" | "page">) => {
    if (candidates.length >= opts.quota || taken.has(item.slug)) return false;
    taken.add(item.slug);
    candidates.push({ ...item, ...extra });
    return true;
  };

  if (next.phase === "new-releases") {
    const items = await source.newReleases(opts.newReleasesLimit);
    for (const item of items) take(item, { source: "new-releases" });
    if (items.every((i) => taken.has(i.slug))) next.phase = "browse";
  }

  while (candidates.length < opts.quota && pagesVisited.length < opts.maxPages) {
    const page = next.page;
    const { items } = await source.browseNew(page, opts.pageSize);
    pagesVisited.push(page);
    if (items.length === 0) break;
    for (const item of items) take(item, { source: "browse", page });
    if (items.every((i) => taken.has(i.slug))) next.page = page + 1;
    else break;
  }

  return { candidates, state: next, pagesVisited };
}

export function loadDailyState(db: Db, today: string): DailyState {
  const row = db.select().from(dailyState).where(eq(dailyState.day, today)).get();
  return rollover(row ? { ...row } : null, today);
}

export function saveDailyState(db: Db, state: DailyState): void {
  const values = { ...state, updatedAt: Date.now() };
  db.insert(dailyState).values(values).onConflictDoUpdate({ target: dailyState.day, set: values }).run();
}

export function markProcessed(db: Db, today: string, slug: string): void {
  const state = loadDailyState(db, today);
  if (!state.processed.includes(slug)) state.processed.push(slug);
  saveDailyState(db, state);
}

export function addVideoSeconds(db: Db, today: string, seconds: number): void {
  const state = loadDailyState(db, today);
  saveDailyState(db, { ...state, videoSeconds: state.videoSeconds + seconds });
}

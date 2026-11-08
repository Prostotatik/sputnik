import { mapFinder, mapProduct, mapReviews, mapStats, type FinderItem, type GameDetails, type Review, type ScoreStats } from "./map";

const API = "https://backend.metacritic.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const GAME_TYPE_ID = 13;

export class MetacriticError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MetacriticError";
  }
}

export interface MetacriticOptions {
  /** Minimum delay between consecutive requests. */
  delayMs?: number;
  fetchImpl?: typeof fetch;
  retries?: number;
  /** Waits between attempts after a network failure (e.g. right after the machine wakes up). */
  networkRetryDelaysMs?: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sequential, throttled client for Metacritic's public backend JSON API. */
export class MetacriticClient {
  private queue: Promise<unknown> = Promise.resolve();
  private last = 0;
  private readonly delayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;
  private readonly networkDelays: number[];
  requests = 0;

  constructor(opts: MetacriticOptions = {}) {
    this.delayMs = opts.delayMs ?? 700;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.retries = opts.retries ?? 2;
    this.networkDelays = opts.networkRetryDelaysMs ?? [2_000, 5_000, 10_000, 20_000];
  }

  private get(path: string): Promise<unknown> {
    const task = this.queue.then(() => this.fetchWithRetry(path));
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async fetchWithRetry(path: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + this.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      this.requests++;
      let res: Response;
      try {
        res = await this.fetchImpl(`${API}/${path}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        if (attempt < this.networkDelays.length) {
          await sleep(this.networkDelays[attempt]);
          continue;
        }
        throw new MetacriticError(`Network error for ${path}: ${(err as Error).message}`);
      }
      if (res.ok) return res.json();
      if ((res.status === 429 || res.status >= 500) && attempt < this.retries) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      throw new MetacriticError(`Metacritic ${res.status} for ${path}`, res.status);
    }
  }

  /** "New Releases" block of https://www.metacritic.com/game/. */
  async newReleases(limit = 20): Promise<FinderItem[]> {
    const json = await this.get(
      `finder/metacritic/web?sortBy=-releaseDate&metaScoreMin=1&mcoTypeId=${GAME_TYPE_ID}&offset=0&limit=${limit}&componentName=new-releases-carousel&componentType=ProductList`,
    );
    return mapFinder(json).items;
  }

  /** One page of https://www.metacritic.com/browse/game/all/all/all-time/new/ (1-based). */
  async browseNew(page: number, pageSize = 24): Promise<{ items: FinderItem[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const json = await this.get(
      `finder/metacritic/web?sortBy=-releaseDate&mcoTypeId=${GAME_TYPE_ID}&offset=${offset}&limit=${pageSize}&componentName=browse&componentType=ProductList`,
    );
    return mapFinder(json);
  }

  async product(slug: string): Promise<GameDetails> {
    return mapProduct(await this.get(`games/metacritic/${encodeURIComponent(slug)}/web?componentName=product&componentType=Product`));
  }

  async stats(kind: "critic" | "user", slug: string, platformSlug?: string): Promise<ScoreStats> {
    const platform = platformSlug ? `/platform/${encodeURIComponent(platformSlug)}` : "";
    return mapStats(await this.get(`reviews/metacritic/${kind}/games/${encodeURIComponent(slug)}${platform}/stats/web`));
  }

  /** Most recent reviews with the given sentiment. */
  async reviews(
    kind: "critic" | "user",
    slug: string,
    sentiment: "positive" | "neutral" | "negative" | "all",
    limit: number,
  ): Promise<{ items: Review[]; total: number }> {
    return mapReviews(
      await this.get(
        `reviews/metacritic/${kind}/games/${encodeURIComponent(slug)}/web?offset=0&limit=${limit}&sort=date&filterBySentiment=${sentiment}&componentType=ReviewList`,
      ),
    );
  }
}

import { desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { analyticsInsights, gamePlatforms, games, libraryEvents } from "@/lib/db/schema";

const DAY = 86_400_000;

export interface AnalyticsFilter {
  /** Period length in days; 0 = all time. */
  days: number;
  platform?: string | null;
  now?: number;
}

interface Row {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  genres: string[];
  metascore: number | null;
  userscore: number | null;
  reviews: number;
  userReviews: number;
  date: number;
  platforms: string[];
}

export interface Kpi {
  value: number | null;
  previous: number | null;
  delta: number | null;
  series: number[];
}

export interface AnalyticsData {
  filter: { days: number; platform: string | null };
  generatedAt: number;
  totalLibrary: number;
  kpis: {
    totalGames: Kpi;
    avgMetascore: Kpi;
    avgUserscore: Kpi;
    trendingGenre: { name: string | null; growth: number | null; coverUrl: string | null };
  };
  genreShare: { genre: string; count: number; share: number }[];
  trends: { buckets: string[]; series: { genre: string; values: number[] }[] };
  supplyDemand: { label: string; games: number; interest: number }[];
  opportunities: { genre: string; games: number; interest: number; avgMetascore: number | null; quadrant: "opportunity" | "competitive" | "niche" | "saturated" }[];
  combinations: {
    venn: { a: string; b: string; aCount: number; bCount: number; both: number; share: number } | null;
    pairs: { genre: string; platform: string; count: number; share: number }[];
  };
  topGames: { slug: string; title: string; coverUrl: string | null; userReviews: number; userscore: number | null; metascore: number | null; interestShare: number }[];
  activity: { ts: number; kind: "added" | "updated"; title: string; gameId: number }[];
  insights: { createdAt: number; model: string; items: { kind: "up" | "down" | "opportunity"; text: string }[] } | null;
}

function loadRows(db: Db, platform: string | null): Row[] {
  const platforms = db.select({ gameId: gamePlatforms.gameId, name: gamePlatforms.name }).from(gamePlatforms).all();
  const byGame = new Map<number, string[]>();
  for (const p of platforms) byGame.set(p.gameId, [...(byGame.get(p.gameId) ?? []), p.name]);
  return db
    .select()
    .from(games)
    .all()
    .map((g) => {
      const released = g.releaseDate ? Date.parse(`${g.releaseDate}T00:00:00Z`) : NaN;
      return {
        id: g.id,
        slug: g.slug,
        title: g.title,
        coverUrl: g.coverUrl,
        genres: g.genres.length ? g.genres : ["Unknown"],
        metascore: g.metascore,
        userscore: g.userscore,
        reviews: g.userReviewCount + g.criticReviewCount,
        userReviews: g.userReviewCount,
        date: Number.isFinite(released) ? released : g.firstSeenAt,
        platforms: byGame.get(g.id) ?? [],
      };
    })
    .filter((r) => !platform || r.platforms.includes(platform));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

function kpi(cur: number | null, prev: number | null, series: number[]): Kpi {
  return { value: cur, previous: prev, delta: cur !== null && prev !== null ? round(cur - prev, 2) : null, series };
}

function countBy<T>(items: T[], key: (t: T) => string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) for (const k of key(it)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

function bucketsFor(days: number, from: number, to: number): { start: number; label: string }[] {
  const span = to - from;
  const step = days === 0 || days > 120 ? 30 * DAY : days > 31 ? 7 * DAY : days > 7 ? 2 * DAY : DAY;
  const count = Math.max(1, Math.min(12, Math.ceil(span / step)));
  const fmt = new Intl.DateTimeFormat("ru-RU", step >= 30 * DAY ? { month: "short" } : { month: "short", day: "numeric" });
  return Array.from({ length: count }, (_, i) => {
    const start = to - (count - i) * step;
    return { start, label: fmt.format(new Date(start + step)) };
  });
}

export function computeAnalytics(db: Db, f: AnalyticsFilter): AnalyticsData {
  const now = f.now ?? Date.now();
  const platform = f.platform || null;
  const all = loadRows(db, platform);
  const earliest = all.length ? Math.min(...all.map((r) => r.date)) : now;
  const from = f.days > 0 ? now - f.days * DAY : earliest;
  const prevFrom = f.days > 0 ? from - f.days * DAY : earliest;
  const cur = all.filter((r) => r.date >= from && r.date <= now);
  const prev = f.days > 0 ? all.filter((r) => r.date >= prevFrom && r.date < from) : [];

  const buckets = bucketsFor(f.days, from, now);
  const inBucket = (r: Row, i: number) => r.date >= buckets[i].start && (i === buckets.length - 1 ? r.date <= now : r.date < buckets[i + 1].start);
  const perBucket = buckets.map((_, i) => cur.filter((r) => inBucket(r, i)));

  const scoreAvg = (rows: Row[], pick: (r: Row) => number | null) => avg(rows.map(pick).filter((x): x is number => x !== null));

  // Genres
  const genreCounts = countBy(cur, (r) => r.genres);
  const total = cur.length;
  const sortedGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sortedGenres.slice(0, 5);
  const otherCount = sortedGenres.slice(5).reduce((s, [, c]) => s + c, 0);
  const genreTotal = sortedGenres.reduce((s, [, c]) => s + c, 0) || 1;
  const genreShare = [
    ...top.map(([genre, count]) => ({ genre, count, share: round((count / genreTotal) * 100)! })),
    ...(otherCount ? [{ genre: "Other", count: otherCount, share: round((otherCount / genreTotal) * 100)! }] : []),
  ];

  const prevGenre = countBy(prev, (r) => r.genres);
  const prevTotal = [...prevGenre.values()].reduce((a, b) => a + b, 0);
  let trending: { name: string | null; growth: number | null } = { name: top[0]?.[0] ?? null, growth: null };
  if (prevTotal > 0) {
    const growth = sortedGenres
      .filter(([, c]) => c >= 2)
      .map(([g, c]) => {
        const p = (prevGenre.get(g) ?? 0) / prevTotal;
        const s = c / genreTotal;
        return { g, growth: p > 0 ? ((s - p) / p) * 100 : 100 };
      })
      .sort((a, b) => b.growth - a.growth)[0];
    if (growth) trending = { name: growth.g, growth: round(growth.growth, 0) };
  }
  const trendingCover = trending.name
    ? [...cur].filter((r) => r.genres.includes(trending.name!) && r.coverUrl).sort((a, b) => b.reviews - a.reviews)[0]?.coverUrl ?? null
    : null;

  const trendGenres = top.slice(0, 4).map(([g]) => g);
  const trends = {
    buckets: buckets.map((b) => b.label),
    series: trendGenres.map((genre) => ({
      genre,
      values: perBucket.map((rows) => {
        const n = rows.length;
        return n ? round((rows.filter((r) => r.genres.includes(genre)).length / n) * 100)! : 0;
      }),
    })),
  };

  const supplyDemand = buckets.map((b, i) => ({
    label: b.label,
    games: perBucket[i].length,
    interest: perBucket[i].reduce((s, r) => s + r.reviews, 0),
  }));

  // Opportunities: interest per game vs number of games per genre.
  const genreStats = sortedGenres.slice(0, 10).map(([genre, count]) => {
    const rows = cur.filter((r) => r.genres.includes(genre));
    return {
      genre,
      games: count,
      interest: Math.round(rows.reduce((s, r) => s + r.reviews, 0) / Math.max(1, count)),
      avgMetascore: round(scoreAvg(rows, (r) => r.metascore), 0),
    };
  });
  const medianOf = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const mGames = medianOf(genreStats.map((g) => g.games));
  const mInterest = medianOf(genreStats.map((g) => g.interest));
  const opportunities = genreStats.map((g) => ({
    ...g,
    quadrant: (g.interest >= mInterest
      ? g.games <= mGames
        ? "opportunity"
        : "competitive"
      : g.games <= mGames
        ? "niche"
        : "saturated") as AnalyticsData["opportunities"][number]["quadrant"],
  }));

  // Combinations: most common platform pair + genre x platform pairs.
  const platformCounts = [...countBy(cur, (r) => r.platforms).entries()].sort((a, b) => b[1] - a[1]);
  let venn: AnalyticsData["combinations"]["venn"] = null;
  if (platformCounts.length >= 2 && total > 0) {
    const [a, aCount] = platformCounts[0];
    const [b, bCount] = platformCounts[1];
    const both = cur.filter((r) => r.platforms.includes(a) && r.platforms.includes(b)).length;
    venn = { a, b, aCount, bCount, both, share: round((both / total) * 100)! };
  }
  const pairCounts = countBy(cur, (r) => r.genres.flatMap((g) => r.platforms.map((p) => `${g}\u0000${p}`)));
  const pairs = [...pairCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([k, count]) => {
      const [genre, plat] = k.split("\u0000");
      return { genre, platform: plat, count, share: round((count / Math.max(1, total)) * 100)! };
    });

  const interestTotal = cur.reduce((s, r) => s + r.userReviews, 0) || 1;
  const topGames = [...cur]
    .filter((r) => r.userReviews > 0)
    .sort((a, b) => b.userReviews - a.userReviews)
    .slice(0, 5)
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      coverUrl: r.coverUrl,
      userReviews: r.userReviews,
      userscore: r.userscore,
      metascore: r.metascore,
      interestShare: round((r.userReviews / interestTotal) * 100)!,
    }));

  const activity = db.select().from(libraryEvents).orderBy(desc(libraryEvents.id)).limit(8).all()
    .map((e) => ({ ts: e.ts, kind: e.kind, title: e.title, gameId: e.gameId }));

  const latest = db.select().from(analyticsInsights).orderBy(desc(analyticsInsights.id)).get();

  return {
    filter: { days: f.days, platform },
    generatedAt: now,
    totalLibrary: all.length,
    kpis: {
      totalGames: kpi(total, f.days > 0 ? prev.length : null, perBucket.map((r) => r.length)),
      avgMetascore: kpi(
        round(scoreAvg(cur, (r) => r.metascore)),
        round(scoreAvg(prev, (r) => r.metascore)),
        perBucket.map((rows) => round(scoreAvg(rows, (r) => r.metascore)) ?? 0),
      ),
      avgUserscore: kpi(
        round(scoreAvg(cur, (r) => r.userscore)),
        round(scoreAvg(prev, (r) => r.userscore)),
        perBucket.map((rows) => round(scoreAvg(rows, (r) => r.userscore)) ?? 0),
      ),
      trendingGenre: { ...trending, coverUrl: trendingCover },
    },
    genreShare,
    trends,
    supplyDemand,
    opportunities,
    combinations: { venn, pairs },
    topGames,
    activity,
    insights: latest ? { createdAt: latest.createdAt, model: latest.model, items: latest.insights } : null,
  };
}

/** Compact text summary of the aggregates for the insights prompt. */
export function metricsForPrompt(a: AnalyticsData): string {
  const lines = [
    `Период: последние ${a.filter.days || "все"} дн.; игр: ${a.kpis.totalGames.value} (в прошлом периоде: ${a.kpis.totalGames.previous ?? "нет данных"}).`,
    `Средний Metascore: ${a.kpis.avgMetascore.value ?? "нет данных"}; средний Userscore: ${a.kpis.avgUserscore.value ?? "нет данных"}.`,
    `Растущий жанр: ${a.kpis.trendingGenre.name ?? "нет данных"} (рост доли: ${a.kpis.trendingGenre.growth === null || a.kpis.trendingGenre.growth === undefined ? "нет данных" : `${a.kpis.trendingGenre.growth}%`}).`,
    `Доля жанров: ${a.genreShare.map((g) => `${g.genre} ${g.share}%`).join(", ")}.`,
    `Жанры (игр, отзывов в среднем на игру, средний Metascore): ${a.opportunities.map((o) => `${o.genre} (${o.games}, ${o.interest}, ${o.avgMetascore ?? "нет данных"}) [${o.quadrant}]`).join("; ")}.`,
    `Предложение и спрос по периодам: ${a.supplyDemand.map((s) => `${s.label}: ${s.games} игр / ${s.interest} отзывов`).join("; ")}.`,
    a.combinations.venn ? `${a.combinations.venn.share}% игр выходят и на ${a.combinations.venn.a}, и на ${a.combinations.venn.b}.` : "",
    `Топ игр по отзывам игроков: ${a.topGames.map((g) => `${g.title} (${g.userReviews} отзывов, оценка игроков ${g.userscore ?? "нет данных"})`).join("; ")}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

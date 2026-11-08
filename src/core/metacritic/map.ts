/** Pure mapping from Metacritic backend JSON to domain types. */

export const SITE = "https://www.metacritic.com";
const IMG_BASE = `${SITE}/a/img/catalog`;

export interface FinderItem {
  slug: string;
  title: string;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  metascore: number | null;
  imageUrl: string | null;
}

export interface PlatformInfo {
  slug: string;
  name: string;
  metascore: number | null;
  criticReviewCount: number;
  releaseDate: string | null;
}

export interface GameDetails {
  slug: string;
  title: string;
  description: string | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  coverUrl: string | null;
  cardImageUrl: string | null;
  videoUrl: string | null;
  videoTitle: string | null;
  mustPlay: boolean;
  metacriticUrl: string;
  platforms: PlatformInfo[];
}

export interface ScoreStats {
  score: number | null;
  reviewCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

export interface Review {
  score: number | null;
  quote: string;
  author: string | null;
  date: string | null;
  platform: string | null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function imageUrl(image: unknown): string | null {
  const path = str(obj(image).bucketPath);
  return path ? `${IMG_BASE}${path}` : null;
}

export function mapFinder(json: unknown): { items: FinderItem[]; total: number } {
  const data = obj(obj(json).data);
  const items = arr(data.items).map((raw) => {
    const it = obj(raw);
    return {
      slug: String(it.slug ?? ""),
      title: String(it.title ?? ""),
      releaseDate: str(it.releaseDate),
      platforms: arr(it.platforms).map((p) => String(obj(p).name ?? "")).filter(Boolean),
      genres: arr(it.genres).map((g) => String(obj(g).name ?? "")).filter(Boolean),
      metascore: num(obj(it.criticScoreSummary).score),
      imageUrl: imageUrl(it.image),
    };
  });
  return { items: items.filter((i) => i.slug && i.title), total: num(data.totalResults) ?? items.length };
}

function companies(production: unknown, type: string): string | null {
  const names = arr(obj(production).companies)
    .map(obj)
    .filter((c) => c.typeName === type)
    .map((c) => String(c.name ?? ""))
    .filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : null;
}

export function mapProduct(json: unknown): GameDetails {
  const it = obj(obj(obj(json).data).item);
  const slug = String(it.slug ?? "");
  const images = arr(it.images).map(obj);
  const byType = (t: string) => imageUrl(images.find((i) => i.typeName === t));
  const video = obj(it.video);
  const videoUrl = str(video.embedUrl) ?? str(video.url);
  return {
    slug,
    title: String(it.title ?? slug),
    description: str(it.description),
    releaseDate: str(it.releaseDate),
    developer: companies(it.production, "Developer"),
    publisher: companies(it.production, "Publisher"),
    genres: arr(it.genres).map((g) => String(obj(g).name ?? "")).filter(Boolean),
    coverUrl: byType("mainImage") ?? byType("cardImage") ?? imageUrl(images[0]),
    cardImageUrl: byType("cardImage"),
    videoUrl,
    videoTitle: videoUrl ? str(video.title) ?? str(video.videoTitle) : null,
    mustPlay: it.mustPlay === true,
    metacriticUrl: `${SITE}/game/${slug}/`,
    platforms: arr(it.platforms).map((raw) => {
      const p = obj(raw);
      const summary = obj(p.criticScoreSummary);
      return {
        slug: String(p.slug ?? ""),
        name: String(p.name ?? ""),
        metascore: num(summary.score),
        criticReviewCount: num(summary.reviewCount) ?? 0,
        releaseDate: str(p.releaseDate),
      };
    }).filter((p) => p.slug && p.name),
  };
}

export function mapStats(json: unknown): ScoreStats {
  const it = obj(obj(obj(json).data).item);
  return {
    score: num(it.score),
    reviewCount: num(it.reviewCount) ?? 0,
    positiveCount: num(it.positiveCount) ?? 0,
    neutralCount: num(it.neutralCount) ?? 0,
    negativeCount: num(it.negativeCount) ?? 0,
  };
}

export function mapReviews(json: unknown): { items: Review[]; total: number } {
  const data = obj(obj(json).data);
  const items = arr(data.items).map((raw) => {
    const r = obj(raw);
    const product = obj(r.reviewedProduct);
    return {
      score: num(r.score),
      quote: String(r.quote ?? "").replace(/\s+/g, " ").trim(),
      author: str(r.publicationName) ?? str(r.author),
      date: str(r.date),
      platform: str(r.platform) ?? str(obj(product.platform).name),
    };
  });
  return { items: items.filter((r) => r.quote.length > 0), total: num(data.totalResults) ?? items.length };
}

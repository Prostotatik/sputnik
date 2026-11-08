import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { gameInsights } from "@/lib/db/schema";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface VideoCandidate {
  id: string;
  title: string;
  channel: string | null;
  views: number;
  durationSec: number;
  url: string;
  thumbnailUrl: string;
}

export function parseViews(text: string | undefined | null): number {
  if (!text) return 0;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function parseDuration(text: string | undefined | null): number {
  if (!text) return 0;
  return text
    .split(":")
    .map((p) => Number.parseInt(p, 10))
    .reduce((acc, n) => (Number.isFinite(n) ? acc * 60 + n : acc), 0);
}

type Json = Record<string, unknown>;

function runsText(v: unknown): string {
  const o = (v ?? {}) as { simpleText?: string; runs?: { text?: string }[] };
  return o.simpleText ?? (o.runs ?? []).map((r) => r.text ?? "").join("");
}

/** Extracts video results from a YouTube search results page. */
export function parseSearchHtml(html: string): VideoCandidate[] {
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) ?? html.match(/ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out: VideoCandidate[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Json;
    if (o.videoRenderer && typeof o.videoRenderer === "object") {
      const v = o.videoRenderer as Json;
      const id = String(v.videoId ?? "");
      if (id) {
        out.push({
          id,
          title: runsText(v.title),
          channel: (runsText(v.ownerText) || runsText(v.longBylineText)).trim() || null,
          views: parseViews(runsText(v.viewCountText)),
          durationSec: parseDuration(runsText(v.lengthText)),
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(data);
  return out;
}

export async function searchYoutube(query: string, fetchImpl: typeof fetch = fetch): Promise<VideoCandidate[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
  const res = await fetchImpl(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  return parseSearchHtml(await res.text());
}

const STOP = new Set(["the", "and", "of", "a", "an", "edition", "remastered", "remake", "deluxe", "complete"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** True when most significant words of the game title occur in the video title. */
export function isRelevant(gameTitle: string, videoTitle: string): boolean {
  const want = tokens(gameTitle);
  if (want.length === 0) return true;
  const have = new Set(tokens(videoTitle));
  const hits = want.filter((t) => have.has(t)).length;
  return hits / want.length >= 0.6;
}

export interface CandidateFilter {
  minDurationMinutes: number;
  excludePattern: string;
  maxCandidates: number;
}

/** Most viewed commentated let's-plays first; drops no-commentary, short and unrelated videos. */
export function pickCandidates(gameTitle: string, videos: VideoCandidate[], f: CandidateFilter): VideoCandidate[] {
  const exclude = new RegExp(f.excludePattern, "i");
  const seen = new Set<string>();
  return videos
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return v.durationSec >= f.minDurationMinutes * 60 && !exclude.test(v.title) && isRelevant(gameTitle, v.title);
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, f.maxCandidates);
}

/** Chooses the transcription window inside the video. */
export function clipWindow(durationSec: number, startOffsetSec: number, clipSeconds: number): { start: number; end: number } {
  const clip = Math.min(clipSeconds, Math.max(30, durationSec));
  const start = durationSec > 0 ? Math.max(0, Math.min(startOffsetSec, durationSec - clip)) : startOffsetSec;
  return { start, end: start + clip };
}

export function remainingBudgetSec(usedSeconds: number, dailyBudgetMinutes: number): number {
  return Math.max(0, dailyBudgetMinutes * 60 - usedSeconds);
}

export const letsplaySchema = {
  type: "object",
  properties: {
    conclusion: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["conclusion", "highlights"],
};

export const letsplayValidator = z.object({
  conclusion: z.string().min(1),
  highlights: z.array(z.string()).max(6),
});

export function saveInsight(
  db: Db,
  gameId: number,
  video: VideoCandidate,
  transcript: string,
  verdict: z.infer<typeof letsplayValidator>,
  model: string,
): void {
  const values = {
    gameId,
    videoId: video.id,
    videoUrl: video.url,
    videoTitle: video.title,
    channel: video.channel,
    views: video.views,
    durationSec: video.durationSec,
    thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    transcript,
    conclusion: verdict.conclusion.trim(),
    highlights: verdict.highlights.slice(0, 4),
    model,
    updatedAt: Date.now(),
  };
  db.insert(gameInsights).values(values).onConflictDoUpdate({ target: gameInsights.gameId, set: values }).run();
}

export function getInsight(db: Db, gameId: number) {
  return db.select().from(gameInsights).where(eq(gameInsights.gameId, gameId)).get();
}

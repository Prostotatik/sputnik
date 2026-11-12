import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { gamePlatforms, games, libraryEvents } from "@/lib/db/schema";
import type { GameDetails, ScoreStats } from "../metacritic/map";

export interface ScoreBundle {
  critic: ScoreStats;
  user: ScoreStats;
  /** User score stats per platform slug. */
  platformUser: Record<string, ScoreStats>;
}

export interface UpsertResult {
  id: number;
  created: boolean;
}

/** Inserts or updates a game (matched by Metacritic slug) and replaces its platform rows. */
export function upsertGame(
  db: Db,
  details: GameDetails,
  scores: ScoreBundle,
  source: "new-releases" | "browse",
  now = Date.now(),
): UpsertResult {
  return db.transaction((tx) => {
    const existing = tx.select({ id: games.id, description: games.description }).from(games).where(eq(games.slug, details.slug)).get();
    const platformScores = details.platforms.map((p) => p.metascore).filter((s): s is number => s !== null);
    const values = {
      slug: details.slug,
      title: details.title,
      description: details.description,
      releaseDate: details.releaseDate,
      coverUrl: details.coverUrl,
      cardImageUrl: details.cardImageUrl,
      developer: details.developer,
      publisher: details.publisher,
      genres: details.genres,
      metascore: scores.critic.score ?? (platformScores.length ? Math.max(...platformScores) : null),
      userscore: scores.user.score,
      criticReviewCount: scores.critic.reviewCount,
      userReviewCount: scores.user.reviewCount,
      videoUrl: details.videoUrl,
      videoTitle: details.videoTitle,
      metacriticUrl: details.metacriticUrl,
      mustPlay: details.mustPlay,
      updatedAt: now,
    };

    let id: number;
    if (existing) {
      id = existing.id;
      // A changed original invalidates its translation so the next run translates it again.
      const reset = existing.description !== details.description ? { descriptionRu: null } : {};
      tx.update(games).set({ ...values, ...reset }).where(eq(games.id, id)).run();
    } else {
      id = tx
        .insert(games)
        .values({ ...values, source, firstSeenAt: now })
        .returning({ id: games.id })
        .get().id;
    }

    tx.delete(gamePlatforms).where(eq(gamePlatforms.gameId, id)).run();
    if (details.platforms.length) {
      tx.insert(gamePlatforms)
        .values(
          details.platforms.map((p) => {
            const user = scores.platformUser[p.slug];
            return {
              gameId: id,
              slug: p.slug,
              name: p.name,
              metascore: p.metascore,
              criticReviewCount: p.criticReviewCount,
              userscore: user?.score ?? null,
              userReviewCount: user?.reviewCount ?? 0,
              releaseDate: p.releaseDate,
            };
          }),
        )
        .run();
    }
    tx.insert(libraryEvents)
      .values({ ts: now, kind: existing ? "updated" : "added", gameId: id, title: details.title })
      .run();
    return { id, created: !existing };
  });
}

export function setHeroImage(db: Db, gameId: number, url: string | null): void {
  db.update(games).set({ heroUrl: url }).where(eq(games.id, gameId)).run();
}

export function saveDescriptionRu(db: Db, gameId: number, text: string): void {
  db.update(games).set({ descriptionRu: text }).where(eq(games.id, gameId)).run();
}

export function getDescriptionRu(db: Db, gameId: number): string | null {
  return db.select({ t: games.descriptionRu }).from(games).where(eq(games.id, gameId)).get()?.t ?? null;
}

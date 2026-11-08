# Design

## Context

Greenfield repository (only `doc/` and OpenSpec scaffolding). See proposal.md for motivation. Facts verified while planning (2026-11-08):

- Metacritic's site is backed by public JSON endpoints on `https://backend.metacritic.com` (no auth, browser UA is enough):
  - New Releases block on `/game/` = `finder/metacritic/web?sortBy=-releaseDate&metaScoreMin=1&mcoTypeId=13&offset=0&limit=20`.
  - "See All → New" (`/browse/game/all/all/all-time/new/`) = same finder **without** `metaScoreMin`, 24 items per page, `offset=(page-1)*24` (~185K titles; many TBD/indie with no reviews).
  - Game details: `games/metacritic/{slug}/web` → title, description, `production.companies` (Developer), `genres`, `platforms[]` with per-platform critic score + `slug`, `images` (`mainImage`, `cardImage`, path `https://www.metacritic.com/a/img/catalog{bucketPath}`), `video` (JW Player `embedUrl`).
  - Per-platform user score: `reviews/metacritic/user/games/{slug}/platform/{platformSlug}/stats/web`. Overall: `.../user/games/{slug}/stats/web`, `.../critic/games/{slug}/stats/web`.
  - Reviews: `reviews/metacritic/{critic|user}/games/{slug}/web?offset&limit&sort=score|-score|date`.
- YouTube search HTML (`/results?search_query=...&hl=en&gl=US`) embeds `ytInitialData` with `videoRenderer` (id, title, views, length, channel). Caption download (yt-dlp) returns HTTP 429, so captions are not a viable source.
- Gemini accepts a YouTube URL as `file_data.file_uri` with `video_metadata.start_offset/end_offset`; a 3-minute clip at low media resolution ≈16K input tokens on `gemini-3.5-flash-lite` and returns verbatim narration. Free tier caps YouTube URL input (~8h of video/day).
- Available model IDs were listed via `models` API and mapped to `doc/google-limits.md`.
- Toolchain: Node 24, pnpm, Next.js 16.4, Tailwind 4, Python not required.

## Goals / Non-Goals

**Goals:**
- One repo, two processes (web + worker) sharing one SQLite DB; runs locally with a single `pnpm dev`.
- Pipeline rules stored as data and executed by a small interpreter so the Workers UI genuinely drives behaviour.
- Pixel-faithful dark UI following the three references; Monitoring derived from the same design language.

**Non-Goals:**
- Arbitrary node-graph programming (only fixed node types + custom prompt nodes).
- Multi-user auth, cloud deployment, horizontal scaling of workers.
- Backfilling Metacritic history beyond what hourly runs reach.

## Decisions

1. **Next.js 16 App Router + separate worker process (tsx)** rather than running the scheduler inside Next. Next dev reloads and serverless lifecycles make in-process timers unreliable. The worker is a plain long-lived Node process; `pnpm dev` starts both via `concurrently`. Alternative (FastAPI worker) rejected: one language keeps shared types (DB schema, pipeline config) in one place.

2. **SQLite via better-sqlite3 + Drizzle ORM**, WAL mode, `busy_timeout=5000`, `better-sqlite3` listed in `serverExternalPackages`. Web ↔ worker coordination happens through tables, no extra broker:
   - `games`, `game_platforms`, `game_summaries` (critic/user likes/dislikes/verdict), `game_insights` (let's-play), `game_custom_fields`, `game_embeddings`, `game_similar`.
   - `runs`, `run_nodes` (per-node status/input/output/logs per run), `run_events` (timeline), `run_requests` (manual trigger queue), `daily_state` (date, processed slugs, phase, page cursor).
   - `pipeline_nodes` (rules), `ai_calls` (usage log), `ai_quota` (per-model minute/day counters), `worker_heartbeat`, `analytics_insights`.
   Alternative Postgres rejected: needs docker for a local single-user tool.

3. **Selection algorithm** (pure function, unit tested): given `daily_state` for today (timezone from rules, default `Europe/Moscow`), the first phase consumes New Releases minus processed-today; when exhausted, iterate See All pages from `cursorPage`, skipping processed-today slugs until the quota is filled, persisting the cursor. Day change resets state.

4. **Pipeline interpreter.** `pipeline_nodes` rows have `type` (fixed set: `sync`, `fetch_games`, `parse_game`, `critic_summary`, `user_summary`, `similar`, `youtube_search`, `transcribe`, `letsplay_summary`, `insights`, `custom_prompt`), `enabled`, `prompt`, `params` (zod-validated per type), `position`, `parentId` (for graph edges). The worker loads the rules at run start; per game it executes enabled per-game nodes in order, recording `run_nodes` status. Graph layout in the UI is derived from `parentId`/`position`.

5. **AI router** with three pools (IDs from the models API, limits from `doc/google-limits.md`):
   - text: `gemini-3.5-flash-lite` (15 RPM/250K TPM/500 RPD), `gemini-3.1-flash-lite` (15/250K/500), `gemma-4-31b-it` (30/16K/14.4K), `gemma-4-26b-a4b-it` (30/16K/14.4K), `gemini-2.5-flash-lite` (10/250K/20), `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3-flash-preview`, `gemini-2.5-flash` (5/250K/20 each), then OpenAI (if key).
   - video: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`, `gemini-3.8-flash`, `gemini-3-flash-preview`.
   - embedding: `gemini-embedding-2`, `gemini-embedding-001` (100 RPM/30K TPM/1K RPD), then OpenAI `text-embedding-3-small`.
   Counters persisted in `ai_quota` (minute bucket + day bucket in Pacific time, Google's reset zone). TPM checked with an estimate (chars/4) before the call and corrected from `usageMetadata`. 429/503 → 60s cooldown and next model. Key sent via `x-goog-api-key` header; request bodies logged with keys stripped. JSON output: `responseSchema` on Gemini models; Gemma gets "JSON only" instructions and a tolerant parser.

6. **Review summaries** sample up to 10 critic + 20 user reviews: half from `sort=score` (top), half from `sort=-score` (bottom). Skip when count = 0. Regenerate only when review count changed.

7. **Let's-play insight**: search `"{title} let's play"`, drop titles matching `no commentary|nocommentary|no talking|trailer|soundtrack|ost`, drop < 8 min, rank by views. Transcribe clip `[startOffset, startOffset+clipSeconds]` (defaults 120s / 180s) with the video pool; if the transcript is < 200 chars try next candidate (max 2). Then summarize with the text pool. Daily video seconds budget (default 6h) tracked in `daily_state`. Wide hero image = YouTube `maxresdefault.jpg` of the chosen video, falling back to Metacritic `cardImage`.

8. **Similarity**: embed "title + genres + developer + description[:1500]" once per game (re-embed only if description changes). Cosine top-8 computed locally over all stored vectors after each run; blended with metadata score (genre overlap 0.5, developer 0.3, platform 0.2) so games without vectors still get neighbours.

9. **Realtime**: `GET /api/stream` (Node runtime, `force-dynamic`) Server-Sent Events emitting a status snapshot every 1s (heartbeat, active run, node statuses, latest events, counters). Client uses one shared `EventSource` hook. Run Now → `POST /api/runs` inserts `run_requests` (rejected with 409 if a run is active or pending); worker polls every 2s.

10. **UI**: Tailwind 4 with design tokens (bg `#0b0b0d`, surface `#141417`, border `#24242a`, accent indigo `#5b5bd6`, score green `#a3e635`/`#22c55e`, danger `#ef4444`), Inter font, rounded-2xl cards, subtle glass gradients and a decorative swirl backdrop. Graph via `@xyflow/react`; charts via `recharts` styled to the references. Sidebar order: Games, Workers, Analytics, Monitoring. Game selection kept in `?game=slug`.

11. **Testing**: vitest for pure modules (Metacritic mapping on recorded fixtures, selection/day-reset, router rotation/limits/429 handling, similarity, YouTube candidate filtering, rule validation). Checks: `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (ESLint CLI, flat config), `pnpm test`.

## Risks / Trade-offs

- [Metacritic changes undocumented endpoints] → all access isolated in one client module with fixture tests; errors are per-game and visible in Monitoring.
- [YouTube HTML structure changes / consent walls] → parser tolerates missing fields; failure only skips the insight.
- [Free-tier quotas (20 RPD on bigger models, video hours)] → flash-lite/Gemma first, skip AI for unreviewed games, daily video budget, insights at most once per run.
- [Gemma has low TPM (16K) and no structured output] → used only for review summaries with bounded input; tolerant JSON parsing with retry on another model.
- [SQLite writer contention between processes] → WAL + busy timeout; web writes are tiny (rules, run requests).
- [Placeholder look of empty analytics on a young library] → explicit empty states; analytics are computed over whatever exists.

## Migration Plan

New service; nothing to migrate. Drizzle migrations generated into `drizzle/` and applied automatically by both processes on start. Rollback = delete `data/sputnik.db`.

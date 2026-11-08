# Proposal

## Why

Game designers and marketing/targeting specialists need a continuously refreshed, AI-digested view of newly released games on Metacritic: scores per platform, what critics and players like or dislike, what popular let's-players conclude, and market-level patterns. Today this is gathered by hand. Sputnik (doc/TZ.md) automates the collection hourly and presents it in a web UI that follows the references in `doc/games-ref.png`, `doc/analytics-ref.png` and `doc/workers-ref.png`.

## What Changes

- New greenfield service (repository currently contains only docs and OpenSpec scaffolding).
- Hourly background worker that selects 20 not-yet-processed-today games from Metacritic: first from the "New Releases" block of `https://www.metacritic.com/game/`, then page by page from "See All → Newest" (`/browse/game/all/all/all-time/new/`); selection restarts each new day.
- For every game: title, cover, per-platform Metascore + Userscore, developer, genres, description, video link; upsert into the local database.
- AI summaries of critic reviews and user reviews (separately): likes / dislikes; refreshed on re-visits.
- Let's-play insight: find the most popular commentated let's-play on YouTube, transcribe the narration, write a conclusion, store it with the video link.
- Similar games computed from the games already in the database; clickable in the game card.
- AI routing across Google AI models chosen by free-tier limits in `doc/google-limits.md` (rotation, rate limiting, usage accounting), with OpenAI as an optional fallback when a key is configured.
- Web UI with four tabs: **Games** (list, card, platform filter, title search, rating sort, live service monitor, Run Now), **Workers** (interactive pipeline graph of prompt/tool nodes whose rules drive the worker; defaults = TZ rules), **Analytics** (insights for game designers/targeting), **Monitoring** (realtime worker state, processed counts, token usage and estimated cost).
- Manual "Run Now" trigger that never starts an overlapping run.

## Capabilities

### New Capabilities
- `game-ingestion`: scheduled and manual collection runs, Metacritic game selection rules (daily reset, New Releases then See All pages), extraction and upsert of game data.
- `review-summaries`: separate AI summaries of critic and user reviews (likes/dislikes), refreshed on re-processing.
- `letsplay-insights`: YouTube let's-play discovery, narration transcription and AI conclusion with a link to the video.
- `similar-games`: per-game list of similar games drawn from the local library.
- `ai-model-routing`: model pools, rotation by free-tier limits, rate limiting, optional OpenAI fallback, usage and cost accounting, API key confidentiality.
- `game-library-ui`: Games tab — list, filters, search, sort, game card, similar games, let's-play insight, service monitor strip and Run Now.
- `pipeline-workers`: Workers tab — live pipeline graph, editable collection rules/prompts per node, custom prompt nodes, node details, run history.
- `market-analytics`: Analytics tab — aggregated market metrics, genre/platform trends, opportunities, AI key insights, report export.
- `service-monitoring`: Monitoring tab and realtime status stream — worker statuses, run progress, processed counts, AI usage vs limits, estimated spend.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New Next.js (TypeScript) application plus a separate Node worker process in this repository.
- New local SQLite database file (gitignored) shared by the web app and the worker.
- External dependencies: Metacritic public backend JSON endpoints, YouTube search pages, Google Generative Language API (`GOOGLE-AI-KEY` from `.env`), optional OpenAI API (`OPENAI_API_KEY`).
- No deployment target yet; runs locally with `pnpm dev` / `pnpm worker`.

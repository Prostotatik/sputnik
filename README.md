# Sputnik

Sputnik tracks newly released games on Metacritic. Once an hour it takes 20 games it has not processed yet that day and adds or updates them in a local library. For each game it collects:

- title, cover, platforms with Metascore and Userscore per platform, developer, genres, description and video link (the Metacritic trailer when one exists, otherwise the analysed let's-play)
- separate AI summaries of what critics and players like and dislike
- an AI conclusion from the narration of the most popular commentated let's-play on YouTube, with a link to the video
- similar games from the library

The web UI has four tabs:

- **Games**: list, filters, search, sort, game card and a live service monitor.
- **Workers**: an interactive pipeline graph. The rules shown here drive the worker, and you can edit or add them.
- **Analytics**: market insights for game designers and user-acquisition specialists.
- **Monitoring**: worker health, run history, AI quota usage and estimated token spend.

Requirements and decisions live in [`openspec/`](openspec/). The original brief is in [`doc/TZ.md`](doc/TZ.md).

## Setup

```sh
pnpm install
```

Create `.env` in the project root:

```dotenv
GOOGLE-AI-KEY=...        # Google AI Studio key (required)
OPENAI_API_KEY=...       # optional fallback for text and embeddings
```

The keys are only read on the server. They are sent in request headers and redacted from logs, so they never reach the browser.

## Run

```sh
pnpm dev            # web UI on http://localhost:3000 and the worker together
pnpm dev:web        # web only
pnpm worker         # worker only (hourly schedule, Run Now requests, heartbeat)
pnpm worker:once    # one collection run, then exit
```

Data is stored in SQLite at `data/sputnik.db`. Override the location with `SPUTNIK_DATA_DIR`. Migrations in `drizzle/` are applied automatically when the app starts.

## How collection works

1. **Selection.** The first run of the day (in the `Europe/Moscow` timezone by default) takes the Metacritic *New Releases* block. Later runs walk *See All → Newest* page by page and skip games already processed that day. The next day starts over from New Releases.
2. **Per game.** The worker reads Metacritic's product data and per-platform scores, then:
   - summarises a balanced sample of positive and negative critic and player reviews (games with no reviews are skipped);
   - finds the most viewed commentated let's-play and transcribes a 3-minute narration clip with Gemini, using the YouTube URL as input, then writes a conclusion;
   - embeds the game for the similar-games search.
3. **After the run.** The worker refreshes the similar-game lists and writes AI key insights for Analytics.

Every step, prompt and parameter is a node in the **Workers** tab, and edits apply from the next run. For example, you can change games per run, the interval, the clip length, the daily video budget or a prompt, or disable a step. **Add rule** creates a custom prompt node whose answer is shown on each game card. **Reset to defaults** restores the rules from the brief.

## AI model rotation

Requests are routed by capability (text, video, embedding) across Gemini models, ordered by their free-tier limits from [`doc/google-limits.md`](doc/google-limits.md):

- **Text and video:** Flash Lite models first (500 requests per day each), then Gemma 4 for text, then the 20-requests-per-day Flash models.
- **Embeddings:** Gemini Embedding 2, then Embedding 1.

Per-minute and per-day counters are stored in SQLite, so they survive restarts. A model that returns 429 or 503 is cooled down and the request moves to the next model. OpenAI is used last, and only if `OPENAI_API_KEY` is set.

## Checks

```sh
pnpm check          # typecheck + eslint + vitest
node scripts/ui-smoke.mjs http://localhost:3000 /tmp   # browser check against a running `pnpm dev`
```

`python3 -I scripts/compare-refs.py <dir>` compares screenshots named `f-<tab>-1222.png` with `doc/*-ref.png`, using blurred-luminance SSIM and mean colour. Each tab should be most similar to its own reference.

`scripts/ui-smoke.mjs` edits a rule, checks that an invalid value is rejected, then presses Run Now. That starts a real collection run, which sends requests to Metacritic and spends Gemini quota. The script restores the edited rule when it finishes.

## Security notes

This is a single-user local tool and has no login. Run it on a trusted machine or behind your own auth.

`src/proxy.ts` only accepts API requests whose Host is `localhost`, `127.0.0.1` or listed in `SPUTNIK_ALLOWED_HOSTS` (comma-separated), which blocks DNS rebinding. It also rejects cross-site state-changing requests such as Run Now and rule edits. Exported CSV cells are escaped against spreadsheet formula injection.

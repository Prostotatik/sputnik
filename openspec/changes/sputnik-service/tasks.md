# Tasks

## 1. Project setup

- [x] 1.1 Scaffold Next.js 16 + TypeScript + Tailwind 4 app with pnpm, ESLint flat config, vitest, tsx and concurrently; verify `pnpm typecheck`, `pnpm lint`, `pnpm test` run green on the empty project
- [ ] 1.2 Add `.env` loading (keeps `GOOGLE-AI-KEY` name, optional `OPENAI_API_KEY`), `data/` dir gitignored, `README.md` with run instructions; verify `pnpm dev` starts web and worker

## 2. Database

- [x] 2.1 Define Drizzle schema for games, platforms, summaries, insights, custom fields, embeddings, similar, runs, run_nodes, run_events, run_requests, daily_state, pipeline_nodes, ai_calls, ai_quota, worker_heartbeat, analytics_insights; generate migration; open DB with WAL + busy_timeout; verify a vitest opens an in-memory DB and applies migrations

## 3. Pipeline rules

- [x] 3.1 Implement node types, zod param schemas, default pipeline (TZ rules) and seeding/reset; verify unit tests for validation (rejects games-per-run 0) and default seed

## 4. AI routing

- [x] 4.1 Implement model catalog (pools + limits from doc/google-limits.md + estimated prices), persistent quota counters and rotation with 429/503 cooldown; verify unit tests for RPD exhaustion fallback, 429 rotation and restart persistence
- [x] 4.2 Implement Gemini client (header auth, structured JSON, YouTube video input, embeddings), optional OpenAI client, tolerant JSON parse and `ai_calls` logging with key redaction; verify unit test that logged request has no key and a live smoke call succeeds

## 5. Metacritic ingestion

- [ ] 5.1 Implement Metacritic client (finder new releases / browse pages, product, per-platform user scores, critic/user stats, reviews) with sequential throttling and mapping to domain types; verify fixture-based mapping tests
- [ ] 5.2 Implement daily selection (New Releases then See All pages, processed-today set, cursor, timezone rollover); verify unit tests for first run, later run, rollover
- [ ] 5.3 Implement upsert of games/platforms and run bookkeeping (runs, run_nodes, run_events, added/updated counts, stale-run recovery); verify unit tests for upsert idempotency and stale recovery

## 6. AI enrichment

- [ ] 6.1 Implement critic/user review summaries (balanced sample, skip on zero, regenerate on count change); verify unit tests for sampling and skip logic
- [ ] 6.2 Implement YouTube search parsing and candidate filtering, transcription with fallback candidate, daily video budget and let's-play conclusion; verify unit tests for filtering and budget
- [ ] 6.3 Implement embeddings + similarity (cosine blended with metadata, fallback); verify unit tests for ranking and fallback
- [ ] 6.4 Implement custom prompt nodes and analytics key insights generation; verify unit test that custom node output is stored per game

## 7. Worker process

- [ ] 7.1 Implement worker loop: heartbeat, hourly schedule from rules, run_requests polling, single-run lock, pipeline interpreter, per-game error isolation; verify a real run ingests 20 games end-to-end (`pnpm worker:once`) and DB shows summaries/insights

## 8. Web API

- [ ] 8.1 Implement API routes: games list (search/platform/sort/paging), game detail, platforms, runs (POST run-now with 409 on active), pipeline nodes CRUD/reset, analytics (period/platform) + export, monitoring, SSE stream; verify route handler tests for run-now conflict and list filters

## 9. UI

- [ ] 9.1 Build app shell (sidebar, top bar, Run Now, live dot, backdrop) and shared SSE status hook; verify visually against references
- [ ] 9.2 Build Games tab (list, filters, search, sort, card with scores/platforms/summaries/insight/similar, service monitor strip) per games-ref.png; verify screenshot comparison
- [ ] 9.3 Build Workers tab (React Flow graph with live statuses, legend, KPIs, Live/History, node details tabs + settings editor, add custom node, reset, run history) per workers-ref.png; verify editing a prompt changes the next run
- [ ] 9.4 Build Analytics tab (KPIs, genre donut, trends, supply vs demand, key insights, opportunities scatter, combinations, top games, market activity, export) per analytics-ref.png; verify screenshot comparison
- [ ] 9.5 Build Monitoring tab (worker state, run progress/history, errors, AI usage vs limits, token/cost estimates); verify screenshot review

## 10. Integration

- [ ] 10.1 Run `pnpm typecheck && pnpm lint && pnpm test`, perform a live run from the UI Run Now button, and screenshot all four tabs side by side with references; verify all green and visual parity

## Workflow follow-up

- Archive the change with `openspec archive sputnik-service` after implementation and verification.
- Verify the archived result with `openspec list --specs`.

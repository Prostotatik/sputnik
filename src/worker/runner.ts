import type { Db } from "@/lib/db/client";
import { dayKey } from "@/lib/time";
import { QuotaExhaustedError } from "@/core/ai/router";
import type { AiService } from "@/core/ai/service";
import { computeAnalytics } from "@/core/analytics";
import { gameContext, generateKeyInsights, runCustomField } from "@/core/enrich/custom";
import { embeddingHash, embeddingText, refreshSimilar, saveEmbedding, textHash } from "@/core/enrich/similarity";
import { balancedSample, getSummary, needsSummary, saveSummary, summarizeReviews } from "@/core/enrich/summaries";
import {
  clipWindow,
  getInsight,
  letsplaySchema,
  letsplayValidator,
  pickCandidates,
  remainingBudgetSec,
  saveInsight,
  searchYoutube,
  type VideoCandidate,
} from "@/core/enrich/youtube";
import type { MetacriticClient } from "@/core/metacritic/client";
import type { GameDetails, ScoreStats } from "@/core/metacritic/map";
import { renderPrompt } from "@/core/pipeline/defaults";
import { listNodes, nodeOfType } from "@/core/pipeline/repo";
import type { NodeParams, PipelineNode } from "@/core/pipeline/types";
import { getDescriptionRu, saveDescriptionRu, setHeroImage, upsertGame } from "@/core/repo/games";
import { isRussian, translateDescription } from "@/core/enrich/translate";
import { RunTracker } from "@/core/runs";
import { addVideoSeconds, loadDailyState, markProcessed, saveDailyState, selectCandidates, type Candidate } from "@/core/selection";

const INSIGHT_REFRESH_MS = 3 * 86_400_000;

export interface RunDeps {
  db: Db;
  mc: MetacriticClient;
  ai: AiService;
  youtubeSearch?: (query: string) => Promise<VideoCandidate[]>;
  now?: () => number;
}

interface NodeTally {
  ok: number;
  failed: number;
}

/** Executes one collection run following the current pipeline rules. */
export interface RunOptions {
  /** Process exactly these games (e.g. a backfill) instead of selecting new ones; the daily selection state is left untouched. */
  candidates?: Candidate[];
}

export async function executeRun(
  deps: RunDeps,
  trigger: "schedule" | "manual",
  requestId: number | null = null,
  opts: RunOptions = {},
): Promise<number> {
  const { db, mc, ai } = deps;
  const now = deps.now ?? Date.now;
  const nodes = listNodes(db);
  const sync = nodeOfType(nodes, "sync")!;
  const today = dayKey(new Date(now()), sync.params.timezone);
  const run = RunTracker.start(db, trigger, today, nodes, requestId);
  const tally = new Map<string, NodeTally>(nodes.map((n) => [n.id, { ok: 0, failed: 0 }]));
  const mark = (id: string, ok: boolean) => {
    const t = tally.get(id);
    if (t) t[ok ? "ok" : "failed"]++;
  };
  const enabled = <T extends PipelineNode["type"]>(type: T) => {
    const n = nodeOfType(nodes, type);
    return n?.enabled ? n : undefined;
  };

  try {
    run.nodeStart(sync.id);
    run.nodeData(sync.id, { input: { trigger, day: today, rules: sync.params } });

    // 1. Select candidates.
    const fetchNode = enabled("fetch_games");
    if (!fetchNode) {
      run.event("warn", "Шаг «Отбор новых игр» выключен: обрабатывать нечего");
      run.finish("success", "Отбор новых игр выключен");
      return run.id;
    }
    run.nodeStart(fetchNode.id);
    run.update({ currentStep: "Отбираем новые игры" });
    const state = loadDailyState(db, today);
    const explicit = opts.candidates;
    const selection = explicit
      ? { candidates: explicit, state, pagesVisited: [] as number[] }
      : await selectCandidates(state, mc, {
          quota: sync.params.gamesPerRun,
          newReleasesLimit: fetchNode.params.newReleasesLimit,
          pageSize: fetchNode.params.browsePageSize,
          maxPages: fetchNode.params.maxBrowsePages,
        });
    if (!explicit) saveDailyState(db, selection.state);
    const candidates = selection.candidates;
    run.nodeData(fetchNode.id, {
      input: { day: today, phase: state.phase, cursorPage: state.page, alreadyProcessedToday: state.processed.length },
      output: {
        phaseAfter: selection.state.phase,
        pagesVisited: selection.pagesVisited,
        games: candidates.map((c) => ({ slug: c.slug, title: c.title, source: c.source, page: c.page ?? null, platforms: c.platforms })),
      },
      done: candidates.length,
      total: candidates.length,
    });
    run.nodeFinish(fetchNode.id, "success");
    run.update({ total: candidates.length, phase: selection.state.phase });
    for (const n of nodes) {
      if (["parse_game", "critic_summary", "user_summary", "youtube_search", "custom_prompt"].includes(n.type)) {
        run.nodeData(n.id, { total: candidates.length });
      }
    }
    if (explicit) run.event("info", `Переобрабатываем игры из библиотеки: ${candidates.length}`, fetchNode.id);
    else run.event("info", `Обрабатываем новые игры: ${candidates.length}`, fetchNode.id, `Страницы: ${selection.pagesVisited.join(", ") || "New Releases"}`);

    // 2. Process each game.
    const touched: number[] = [];
    let added = 0;
    let updated = 0;
    let errors = 0;
    for (const [i, cand] of candidates.entries()) {
      run.update({ processed: i, currentGame: cand.title, currentStep: `Разбираем ${cand.title}` });
      try {
        const res = await processGame(deps, run, nodes, cand, today, mark);
        if (res) {
          touched.push(res.id);
          if (res.created) added++;
          else updated++;
        }
      } catch (err) {
        errors++;
        run.event("error", `Не удалось обработать ${cand.title}: ${(err as Error).message}`);
      } finally {
        if (!explicit) markProcessed(db, today, cand.slug);
        run.update({ processed: i + 1, added, updated, errors });
      }
    }

    // 3. Similar games across the library.
    const similarNode = enabled("similar");
    if (similarNode && touched.length) {
      run.nodeStart(similarNode.id);
      run.update({ currentStep: "Ищем похожие игры", currentGame: null });
      const changed = refreshSimilar(db, touched, similarNode.params.topK);
      run.nodeData(similarNode.id, { output: { touchedGames: touched.length, listsUpdated: changed }, done: touched.length, total: touched.length });
      run.nodeLog(similarNode.id, "info", `Обновлено списков похожих игр: ${changed}`);
      mark(similarNode.id, true);
    }

    // 4. Market insights once per run.
    const insightsNode = enabled("insights");
    if (insightsNode && touched.length) {
      run.nodeStart(insightsNode.id);
      run.update({ currentStep: "Готовим инсайты", currentGame: null });
      try {
        const analytics = computeAnalytics(db, { days: 30 });
        const res = await generateKeyInsights(db, ai, { purpose: "insights", runId: run.id, preferredModel: insightsNode.params.preferredModel }, insightsNode.prompt ?? "", analytics);
        if (res) {
          run.nodeData(insightsNode.id, { input: { prompt: res.prompt }, output: { model: res.model, insights: res.items } });
          mark(insightsNode.id, true);
        } else {
          run.nodeLog(insightsNode.id, "info", "Для инсайтов пока мало игр");
        }
      } catch (err) {
        mark(insightsNode.id, false);
        run.nodeLog(insightsNode.id, "error", (err as Error).message);
      }
    }

    for (const n of nodes) {
      if (n.id === fetchNode.id || n.id === sync.id) continue;
      const t = tally.get(n.id)!;
      run.nodeFinish(n.id, t.failed > 0 && t.ok === 0 ? "failed" : "success");
    }
    run.nodeData(sync.id, { output: { day: today, total: candidates.length, added, updated, errors } });
    run.nodeFinish(sync.id, "success");
    run.finish("success");
  } catch (err) {
    run.event("error", (err as Error).message);
    run.finish("failed", (err as Error).message);
  }
  return run.id;
}

function statsOrEmpty(p: Promise<ScoreStats>): Promise<ScoreStats> {
  return p.catch(() => ({ score: null, reviewCount: 0, positiveCount: 0, neutralCount: 0, negativeCount: 0 }));
}

async function processGame(
  deps: RunDeps,
  run: RunTracker,
  nodes: PipelineNode[],
  cand: Candidate,
  today: string,
  mark: (id: string, ok: boolean) => void,
): Promise<{ id: number; created: boolean } | null> {
  const { db, mc, ai } = deps;
  const now = deps.now ?? Date.now;
  const on = <T extends PipelineNode["type"]>(type: T) => {
    const n = nodeOfType(nodes, type);
    return n?.enabled ? n : undefined;
  };

  // Parse Game Data
  const parse = on("parse_game") ?? nodeOfType(nodes, "parse_game")!;
  run.nodeStart(parse.id);
  let details: GameDetails;
  try {
    details = await mc.product(cand.slug);
  } catch (err) {
    mark(parse.id, false);
    run.nodeLog(parse.id, "error", `${cand.title}: ${(err as Error).message}`);
    throw err;
  }
  const [critic, user] = await Promise.all([statsOrEmpty(mc.stats("critic", cand.slug)), statsOrEmpty(mc.stats("user", cand.slug))]);
  const platformUser: Record<string, ScoreStats> = {};
  if (parse.params.userScoresPerPlatform && user.reviewCount > 0) {
    for (const p of details.platforms) platformUser[p.slug] = await statsOrEmpty(mc.stats("user", cand.slug, p.slug));
  }
  const saved = upsertGame(db, details, { critic, user, platformUser }, cand.source, now());
  mark(parse.id, true);
  run.nodeIncrement(parse.id);
  run.nodeData(parse.id, {
    input: { slug: cand.slug, source: cand.source },
    output: {
      title: details.title,
      developer: details.developer,
      genres: details.genres,
      metascore: critic.score,
      userscore: user.score,
      platforms: details.platforms.map((p) => ({ name: p.name, metascore: p.metascore, userscore: platformUser[p.slug]?.score ?? null })),
      video: details.videoUrl,
    },
  });
  run.nodeLog(parse.id, "info", `${saved.created ? "Добавлена" : "Обновлена"} ${details.title}`);
  const gameId = saved.id;

  // Russian description (kept apart from the original, which sync and similarity use).
  if (parse.params.translateDescription && details.description && !getDescriptionRu(db, gameId)) {
    if (isRussian(details.description)) saveDescriptionRu(db, gameId, details.description);
    else {
      try {
        run.update({ currentStep: `Переводим описание ${details.title}` });
        const tr = await translateDescription(ai, { purpose: "translate", runId: run.id, gameId, preferredModel: parse.params.preferredModel }, details.description);
        saveDescriptionRu(db, gameId, tr.value);
        run.nodeLog(parse.id, "info", `${details.title}: описание переведено (${tr.model})`);
      } catch (err) {
        run.nodeLog(parse.id, "warn", `${details.title}: перевод описания не удался (${(err as Error).message}), показываем оригинал`);
      }
    }
  }
  const genreList = details.genres;

  // Review summaries
  const summaryNodes = [
    { node: on("critic_summary"), kind: "critic" as const, stats: critic },
    { node: on("user_summary"), kind: "user" as const, stats: user },
  ];
  for (const { node, kind, stats } of summaryNodes) {
    if (!node) continue;
    run.nodeStart(node.id);
    const existing = getSummary(db, gameId, kind);
    if (!needsSummary(existing, stats.reviewCount)) {
      run.nodeLog(node.id, "info", `${details.title}: ${stats.reviewCount === 0 ? `пока нет отзывов ${kind === "critic" ? "критиков" : "игроков"}` : "число отзывов не изменилось"}, пропущено`);
      run.nodeIncrement(node.id);
      continue;
    }
    run.update({ currentStep: kind === "critic" ? "Анализируем рецензии критиков" : "Анализируем отзывы игроков" });
    try {
      const max = (node.params as NodeParams<"critic_summary">).maxReviews;
      const half = Math.ceil(max / 2);
      const pos = await mc.reviews(kind, cand.slug, "positive", half);
      const neg = await mc.reviews(kind, cand.slug, "negative", half);
      const extra = neg.items.length < half / 2 ? (await mc.reviews(kind, cand.slug, "neutral", half)).items : [];
      const sample = balancedSample(pos.items, [...neg.items, ...extra], max);
      if (sample.length === 0) {
        run.nodeLog(node.id, "info", `${details.title}: текстов отзывов нет`);
        run.nodeIncrement(node.id);
        continue;
      }
      const res = await summarizeReviews(
        ai,
        { purpose: `${kind}_summary`, runId: run.id, gameId, preferredModel: node.params.preferredModel },
        node.prompt ?? "",
        { title: details.title, genres: genreList, developer: details.developer },
        sample,
      );
      saveSummary(db, gameId, kind, res.summary, stats.reviewCount, res.model);
      mark(node.id, true);
      run.nodeIncrement(node.id);
      run.nodeData(node.id, { input: { game: details.title, reviews: sample.length, prompt: res.prompt }, output: { model: res.model, ...res.summary } });
    } catch (err) {
      mark(node.id, false);
      run.nodeLog(node.id, err instanceof QuotaExhaustedError ? "warn" : "error", `${details.title}: ${(err as Error).message}`);
    }
  }

  // YouTube let's-play insight
  const yt = on("youtube_search");
  if (yt) await processLetsplay(deps, run, nodes, gameId, details, critic.reviewCount + user.reviewCount, today, mark);
  const insight = getInsight(db, gameId);
  setHeroImage(db, gameId, insight?.thumbnailUrl ?? details.cardImageUrl ?? details.coverUrl);

  // Embedding for similarity
  const similar = on("similar");
  if (similar?.params.useEmbeddings) {
    const text = embeddingText(details);
    const hash = textHash(text);
    if (embeddingHash(db, gameId) !== hash) {
      try {
        const res = await ai.embedding({ purpose: "embedding", runId: run.id, gameId }, text);
        saveEmbedding(db, gameId, res.model, res.value, hash);
        run.nodeLog(similar.id, "info", `Эмбеддинг ${details.title} готов (${res.model})`);
      } catch (err) {
        run.nodeLog(similar.id, "warn", `${details.title}: эмбеддинг недоступен (${(err as Error).message}), сравниваем по метаданным`);
      }
    }
  }

  // Custom prompt nodes
  const customs = nodes.filter((n): n is PipelineNode<"custom_prompt"> => n.type === "custom_prompt" && n.enabled);
  if (customs.length) {
    const ctx = gameContext(db, gameId);
    for (const node of customs) {
      run.nodeStart(node.id);
      if (node.params.requireReviews && critic.reviewCount + user.reviewCount === 0) {
        run.nodeLog(node.id, "info", `${details.title}: нет отзывов, пропущено`);
        run.nodeIncrement(node.id);
        continue;
      }
      try {
        run.update({ currentStep: `${node.name}` });
        const res = await runCustomField(db, ai, { purpose: `custom:${node.params.fieldKey}`, runId: run.id, gameId, preferredModel: node.params.preferredModel }, { prompt: node.prompt ?? "", fieldKey: node.params.fieldKey, label: node.params.label }, ctx);
        mark(node.id, true);
        run.nodeIncrement(node.id);
        run.nodeData(node.id, { input: { prompt: res.prompt }, output: { model: res.model, value: res.value } });
      } catch (err) {
        mark(node.id, false);
        run.nodeLog(node.id, "error", `${details.title}: ${(err as Error).message}`);
      }
    }
  }
  return saved;
}

async function processLetsplay(
  deps: RunDeps,
  run: RunTracker,
  nodes: PipelineNode[],
  gameId: number,
  details: GameDetails,
  reviewCount: number,
  today: string,
  mark: (id: string, ok: boolean) => void,
): Promise<void> {
  const { db, ai } = deps;
  const now = deps.now ?? Date.now;
  const yt = nodeOfType(nodes, "youtube_search")!;
  const tr = nodeOfType(nodes, "transcribe");
  const verdictNode = nodeOfType(nodes, "letsplay_summary");
  run.nodeStart(yt.id);
  if (yt.params.requireReviews && reviewCount === 0) {
    run.nodeLog(yt.id, "info", `${details.title}: отзывов пока нет, летсплей пропущен`);
    run.nodeIncrement(yt.id);
    return;
  }
  const existing = getInsight(db, gameId);
  if (existing && now() - existing.updatedAt < INSIGHT_REFRESH_MS) {
    run.nodeLog(yt.id, "info", `${details.title}: вывод по летсплею ещё свежий, пропущено`);
    run.nodeIncrement(yt.id);
    return;
  }

  run.update({ currentStep: "Ищем летсплеи" });
  const query = renderPrompt(yt.params.queryTemplate, { title: details.title });
  let picked: VideoCandidate[];
  try {
    const videos = await (deps.youtubeSearch ?? searchYoutube)(query);
    picked = pickCandidates(details.title, videos, yt.params);
    run.nodeData(yt.id, {
      input: { query },
      output: { found: videos.length, candidates: picked.map((v) => ({ title: v.title, channel: v.channel, views: v.views, url: v.url })) },
    });
    run.nodeIncrement(yt.id);
    mark(yt.id, true);
  } catch (err) {
    mark(yt.id, false);
    run.nodeLog(yt.id, "error", `${details.title}: ${(err as Error).message}`);
    return;
  }
  if (!picked.length) {
    run.nodeLog(yt.id, "info", `${details.title}: летсплей с комментариями не найден`);
    return;
  }
  if (!tr?.enabled) return;

  run.nodeStart(tr.id);
  for (const video of picked) {
    const budget = remainingBudgetSec(loadDailyState(db, today).videoSeconds, tr.params.dailyBudgetMinutes);
    const win = clipWindow(video.durationSec, tr.params.startOffsetSec, Math.min(tr.params.clipSeconds, budget));
    if (budget < 30) {
      run.nodeLog(tr.id, "warn", `Дневной лимит видео исчерпан (${tr.params.dailyBudgetMinutes} мин), ${details.title} пропущена`);
      return;
    }
    run.update({ currentStep: "Расшифровываем летсплей" });
    let transcript = "";
    let model = "";
    try {
      const res = await ai.transcribeYoutube(
        { purpose: "transcribe", runId: run.id, gameId, preferredModel: tr.params.preferredModel },
        video.url,
        win.start,
        win.end,
        tr.prompt ?? "",
      );
      transcript = res.value.trim();
      model = res.model;
      addVideoSeconds(db, today, win.end - win.start);
    } catch (err) {
      mark(tr.id, false);
      run.nodeLog(tr.id, err instanceof QuotaExhaustedError ? "warn" : "error", `${details.title}: ${(err as Error).message}`);
      return;
    }
    run.nodeData(tr.id, {
      input: { video: video.url, title: video.title, from: win.start, to: win.end },
      output: { model, chars: transcript.length, excerpt: transcript.slice(0, 1500) },
    });
    if (transcript.length < tr.params.minTranscriptChars) {
      run.nodeLog(tr.id, "info", `${video.title}: слишком мало речи (${transcript.length} симв.), пробуем следующее видео`);
      continue;
    }
    mark(tr.id, true);
    run.nodeIncrement(tr.id);

    if (!verdictNode?.enabled) return;
    run.nodeStart(verdictNode.id);
    run.update({ currentStep: "Анализируем летсплей" });
    try {
      const prompt = renderPrompt(verdictNode.prompt ?? "", {
        title: details.title,
        channel: video.channel ?? "неизвестный канал",
        videoTitle: video.title,
        transcript: transcript.slice(0, 12_000),
      });
      const res = await ai.json(
        { purpose: "letsplay_summary", runId: run.id, gameId, preferredModel: verdictNode.params.preferredModel },
        prompt,
        letsplaySchema,
        letsplayValidator,
      );
      saveInsight(db, gameId, video, transcript, res.value, res.model);
      mark(verdictNode.id, true);
      run.nodeIncrement(verdictNode.id);
      run.nodeData(verdictNode.id, { input: { video: video.url, transcriptChars: transcript.length }, output: { model: res.model, ...res.value } });
      run.event("info", `Летсплей ${details.title} проанализирован`, verdictNode.id, `${video.title} — ${video.views.toLocaleString("ru-RU")} просмотров`);
    } catch (err) {
      mark(verdictNode.id, false);
      run.nodeLog(verdictNode.id, "error", `${details.title}: ${(err as Error).message}`);
    }
    return;
  }
}

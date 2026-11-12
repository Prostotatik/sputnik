"use client";

import clsx from "clsx";
import { FlaskConical, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { GameListItem, WorkersData } from "@/core/queries";
import { useJson } from "@/lib/client/hooks";
import { Select } from "../ui";

export type ModelOption = WorkersData["models"][number];

export const PARAM_INFO: Record<string, { label: string; help: string }> = {
  intervalMinutes: { label: "Запуск каждые (минут)", help: "Время между стартами запусков. 60 — раз в час, как в ТЗ." },
  gamesPerRun: { label: "Игр за запуск", help: "Сколько новых игр берётся за один запуск. В ТЗ — 20." },
  timezone: { label: "Часовой пояс для смены дня", help: "В полночь по этому поясу отбор снова начинается с New Releases." },
  requestDelayMs: { label: "Пауза между запросами к Metacritic (мс)", help: "Чтобы Metacritic не ограничивал нас по частоте." },
  newReleasesLimit: { label: "Игр из New Releases", help: "Первый запуск дня читает блок New Releases на /game/." },
  browsePageSize: { label: "Размер страницы See All", help: "Игр на одной странице See All (сначала новые)." },
  maxBrowsePages: { label: "Страниц See All за запуск, максимум", help: "Как далеко один запуск может листать See All в поисках необработанных сегодня игр." },
  userScoresPerPlatform: { label: "Userscore по платформам", help: "Один дополнительный запрос на платформу ради её собственного Userscore." },
  translateDescription: { label: "Переводить описание на русский", help: "Описание с Metacritic переводится один раз и заново, только если оригинал изменился." },
  maxReviews: { label: "Отзывов в сводку", help: "Сбалансированная подборка положительных и отрицательных отзывов, которая уходит в модель." },
  preferredModel: { label: "Модель", help: "Пробуется первой. Если её лимит исчерпан, ротация берёт следующую модель." },
  topK: { label: "Похожих игр на игру", help: "Сколько похожих игр показывает карточка." },
  useEmbeddings: { label: "Смысловая похожесть", help: "Сравнивать описания через эмбеддинги. Если выключено — только жанры, разработчик и платформы." },
  queryTemplate: { label: "Запрос для поиска на YouTube", help: "{{title}} заменяется на название игры." },
  minDurationMinutes: { label: "Минимальная длина видео (минут)", help: "Более короткие видео (трейлеры, нарезки) пропускаются." },
  excludePattern: { label: "Пропускать видео, если в названии есть", help: "Регулярное выражение без учёта регистра. Отсекает видео без комментариев и трейлеры." },
  maxCandidates: { label: "Видео на игру, максимум", help: "Если в самом популярном видео нет речи, пробуем следующее." },
  requireReviews: { label: "Только игры с отзывами", help: "Пропускать игры, у которых ещё нет отзывов, чтобы экономить лимит ИИ." },
  startOffsetSec: { label: "Расшифровывать с секунды", help: "Пропускает вступление видео." },
  clipSeconds: { label: "Длина фрагмента (секунд)", help: "Сколько речи уходит на распознавание." },
  dailyBudgetMinutes: { label: "Дневной лимит видео (минут)", help: "Сколько минут видео в сумме расшифровывается за день по всем играм." },
  minTranscriptChars: { label: "Минимум речи (символов)", help: "Более короткая расшифровка считается видео без комментариев." },
  fieldKey: { label: "Ключ хранения", help: "Если поменять, у всех игр начнётся новое пустое поле." },
  label: { label: "Название поля в карточке игры", help: "Под этим названием ответ показывается в карточке каждой игры." },
};

/** Placeholders available in each prompt, with what they are replaced with. */
export const PLACEHOLDERS: Record<string, [string, string][]> = {
  critic_summary: [
    ["title", "Название игры"],
    ["genres", "Жанры"],
    ["developer", "Разработчик"],
    ["reviews", "Подборка рецензий критиков с оценками"],
  ],
  user_summary: [
    ["title", "Название игры"],
    ["genres", "Жанры"],
    ["developer", "Разработчик"],
    ["reviews", "Подборка отзывов игроков с оценками"],
  ],
  letsplay_summary: [
    ["title", "Название игры"],
    ["channel", "Канал на YouTube"],
    ["videoTitle", "Название видео"],
    ["transcript", "Расшифровка речи"],
  ],
  insights: [["metrics", "Сводные метрики библиотеки из вкладки «Аналитика»"]],
  transcribe: [],
  custom_prompt: [
    ["title", "Название игры"],
    ["genres", "Жанры"],
    ["platforms", "Платформы"],
    ["developer", "Разработчик"],
    ["description", "Описание (на русском, если есть перевод)"],
    ["metascore", "Metascore"],
    ["userscore", "Userscore"],
    ["criticVerdict", "Вердикт из сводки критиков"],
    ["userVerdict", "Вердикт из сводки игроков"],
    ["letsplay", "Вывод по летсплею"],
  ],
};

/** "params.maxReviews: Слишком маленькое значение" → "Отзывов в сводку: слишком маленькое значение". */
export function humanError(e: string): string {
  const m = /^(?:params\.)?(\w+): (.*)$/s.exec(e);
  if (!m) return e;
  const label = m[1] === "prompt" ? "Промпт" : m[1] === "name" ? "Название" : m[1] === "slug" ? "Игра" : PARAM_INFO[m[1]]?.label;
  return label ? `${label}: ${m[2].charAt(0).toLowerCase()}${m[2].slice(1)}` : e;
}

export const inputCls = "h-9 rounded-lg border border-line-2 bg-panel-2 px-3 text-[13px] text-fg focus:border-accent/60 focus:outline-none";

export function Field({ label, help, children, className }: { label: string; help?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("flex flex-col gap-1.5 text-xs text-muted", className)}>
      <span className="text-fg/90">{label}</span>
      {children}
      {help && <span className="text-[11px] leading-4 text-dim">{help}</span>}
    </label>
  );
}

export function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-line bg-panel-2/60 px-3 py-2.5">
      <span className="text-xs">
        <span className="block text-[13px] text-fg">{label}</span>
        {help && <span className="mt-0.5 block text-[11px] leading-4 text-dim">{help}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
    </label>
  );
}

export function ModelSelect({
  value,
  onChange,
  models,
  capability,
}: {
  value: string;
  onChange: (v: string) => void;
  models: ModelOption[];
  capability: "text" | "video";
}) {
  const options = models.filter((m) => m.capabilities.includes(capability));
  return (
    <Select
      label="Модель"
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "Автоматическая ротация (рекомендуется)" },
        ...options.map((m) => ({ value: m.id, label: `${m.label}${m.rpd ? `, бесплатно ${m.rpd} в день` : ""}` })),
        ...(value && !options.some((m) => m.id === value) ? [{ value, label: `${value} (нет в каталоге)` }] : []),
      ]}
      className="w-full"
    />
  );
}

/** Prompt textarea with clickable placeholder chips that insert at the cursor. */
export function PromptEditor({ value, onChange, type, rows = 9 }: { value: string; onChange: (v: string) => void; type: string; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const vars = PLACEHOLDERS[type] ?? [];
  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const unknown = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((n) => vars.length && !vars.some(([v]) => v === n));
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted">
      <span className="text-fg/90">Промпт</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className="rounded-lg border border-line-2 bg-panel-2 p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent/60 focus:outline-none"
      />
      {vars.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] text-dim">Подставьте данные об игре. Каждый плейсхолдер заменяется перед отправкой промпта:</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map(([name, help]) => (
              <button
                key={name}
                type="button"
                onClick={() => insert(name)}
                title={help}
                className="rounded-md border border-line bg-panel-3 px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-line-2 hover:text-fg"
              >
                {`{{${name}}}`} <span className="font-sans text-dim">{help}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-dim">Фрагмент видео прикрепляется к этому промпту автоматически.</p>
      )}
      {unknown.length > 0 && <p className="text-[11px] text-warn">Неизвестные плейсхолдеры станут пустыми: {[...new Set(unknown)].map((n) => `{{${n}}}`).join(", ")}</p>}
    </div>
  );
}

/** Runs a custom rule prompt once on a chosen library game and shows the answer. Nothing is saved. */
export function TestOnGame({ prompt, preferredModel }: { prompt: string; preferredModel: string }) {
  const games = useJson<{ items: GameListItem[] }>("/api/games?sort=metascore&limit=40");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; meta?: string } | null>(null);
  const items = games.data?.items ?? [];
  const chosen = slug || items[0]?.slug || "";

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/pipeline/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: chosen, prompt, preferredModel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setResult({ ok: false, text: (body.errors ?? [`Запрос не удался (${res.status})`]).map(humanError).join("; ") });
      else setResult({ ok: true, text: body.value || "(пустой ответ)", meta: `${body.game}, ${body.model}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-line bg-deep/60 p-3">
      <p className="text-[13px] text-fg">Проверить на игре</p>
      <p className="mt-0.5 text-[11px] text-dim">Один раз выполняет промпт выше. Ответ не сохраняется, тратится один запрос к ИИ.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Select
          label="Игра для проверки"
          value={chosen}
          onChange={setSlug}
          options={items.length ? items.map((g) => ({ value: g.slug, label: `${g.title}${g.metascore !== null ? ` (${g.metascore})` : ""}` })) : [{ value: "", label: "Загружаем игры…" }]}
          className="min-w-0 flex-1"
        />
        <button type="button" onClick={run} disabled={busy || !chosen} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4 text-dim" strokeWidth={1.5} />} Проверить
        </button>
      </div>
      {result && (
        <div role="status" className={clsx("mt-3 rounded-lg border p-3 text-[13px] leading-relaxed", result.ok ? "border-line-2 bg-panel-2 text-fg" : "border-bad/40 bg-bad/10 text-bad")}>
          <p className="whitespace-pre-line">{result.text}</p>
          {result.meta && <p className="mt-2 font-mono text-[11px] text-dim">{result.meta}</p>}
        </div>
      )}
    </div>
  );
}

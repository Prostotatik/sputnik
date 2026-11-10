"use client";

import clsx from "clsx";
import { FlaskConical, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { GameListItem, WorkersData } from "@/core/queries";
import { useJson } from "@/lib/client/hooks";
import { Select } from "../ui";

export type ModelOption = WorkersData["models"][number];

export const PARAM_INFO: Record<string, { label: string; help: string }> = {
  intervalMinutes: { label: "Run every (minutes)", help: "Time between run starts. 60 means hourly, as in the brief." },
  gamesPerRun: { label: "Games per run", help: "New games taken per run. The brief asks for 20." },
  timezone: { label: "Day boundary time zone", help: "At midnight here selection restarts from New Releases." },
  requestDelayMs: { label: "Delay between Metacritic requests (ms)", help: "Pause between requests so Metacritic does not rate-limit us." },
  newReleasesLimit: { label: "Games taken from New Releases", help: "First run of the day reads the New Releases block on /game/." },
  browsePageSize: { label: "See All page size", help: "Games per See All (newest) page." },
  maxBrowsePages: { label: "Max See All pages per run", help: "How far one run may walk See All looking for games not processed today." },
  userScoresPerPlatform: { label: "Userscore per platform", help: "One extra request per platform for its own Userscore." },
  maxReviews: { label: "Reviews sampled per summary", help: "A balanced mix of positive and negative reviews sent to the model." },
  preferredModel: { label: "Model", help: "Tried first. When it is out of quota the rotation picks the next model." },
  topK: { label: "Similar games per game", help: "How many similar games the card shows." },
  useEmbeddings: { label: "Semantic similarity", help: "Compare descriptions with embeddings. Off: genres, developer and platforms only." },
  queryTemplate: { label: "YouTube search query", help: "{{title}} is replaced with the game title." },
  minDurationMinutes: { label: "Minimum video length (minutes)", help: "Shorter videos (trailers, clips) are skipped." },
  excludePattern: { label: "Skip videos whose title matches", help: "Regular expression, case-insensitive. Filters out no-commentary videos and trailers." },
  maxCandidates: { label: "Videos to try per game", help: "If the most viewed video has no narration, try the next one." },
  requireReviews: { label: "Only games that have reviews", help: "Skip games nobody has reviewed yet, to save AI quota." },
  startOffsetSec: { label: "Transcribe from second", help: "Skips the intro of the video." },
  clipSeconds: { label: "Clip length (seconds)", help: "How much narration goes to speech-to-text." },
  dailyBudgetMinutes: { label: "Daily video budget (minutes)", help: "Total video minutes transcribed per day across all games." },
  minTranscriptChars: { label: "Minimum narration length (characters)", help: "Shorter transcripts count as a video without narration." },
  fieldKey: { label: "Storage key", help: "Changing it starts a new, empty field on every game." },
  label: { label: "Field name on the game card", help: "The answer is shown on each game card under this name." },
};

/** Placeholders available in each prompt, with what they are replaced with. */
export const PLACEHOLDERS: Record<string, [string, string][]> = {
  critic_summary: [
    ["title", "Game title"],
    ["genres", "Genres"],
    ["developer", "Developer"],
    ["reviews", "Sampled critic reviews with scores"],
  ],
  user_summary: [
    ["title", "Game title"],
    ["genres", "Genres"],
    ["developer", "Developer"],
    ["reviews", "Sampled player reviews with scores"],
  ],
  letsplay_summary: [
    ["title", "Game title"],
    ["channel", "YouTube channel"],
    ["videoTitle", "Video title"],
    ["transcript", "Transcribed narration"],
  ],
  insights: [["metrics", "Aggregated library metrics from the Analytics tab"]],
  transcribe: [],
  custom_prompt: [
    ["title", "Game title"],
    ["genres", "Genres"],
    ["platforms", "Platforms"],
    ["developer", "Developer"],
    ["description", "Metacritic description"],
    ["metascore", "Metascore"],
    ["userscore", "Userscore"],
    ["criticVerdict", "Critic summary verdict"],
    ["userVerdict", "Player summary verdict"],
    ["letsplay", "Let's-play conclusion"],
  ],
};

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
      label="Model"
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "Automatic rotation (recommended)" },
        ...options.map((m) => ({ value: m.id, label: `${m.label}${m.rpd ? `, ${m.rpd}/day free` : ""}` })),
        ...(value && !options.some((m) => m.id === value) ? [{ value, label: `${value} (not in catalog)` }] : []),
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
      <span className="text-fg/90">Prompt</span>
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
          <p className="mb-1.5 text-[11px] text-dim">Insert data about the game. Each placeholder is replaced before the prompt is sent:</p>
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
        <p className="text-[11px] text-dim">The video segment is attached to this prompt automatically.</p>
      )}
      {unknown.length > 0 && <p className="text-[11px] text-warn">Unknown placeholders become empty: {[...new Set(unknown)].map((n) => `{{${n}}}`).join(", ")}</p>}
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
      if (!res.ok) setResult({ ok: false, text: (body.errors ?? [`Request failed (${res.status})`]).join("; ") });
      else setResult({ ok: true, text: body.value || "(empty answer)", meta: `${body.game}, ${body.model}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-line bg-deep/60 p-3">
      <p className="text-[13px] text-fg">Try it on a game</p>
      <p className="mt-0.5 text-[11px] text-dim">Runs the prompt above once. The answer is not saved; it uses one AI request.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Select
          label="Game to test on"
          value={chosen}
          onChange={setSlug}
          options={items.length ? items.map((g) => ({ value: g.slug, label: `${g.title}${g.metascore !== null ? ` (${g.metascore})` : ""}` })) : [{ value: "", label: "Loading games…" }]}
          className="min-w-0 flex-1"
        />
        <button type="button" onClick={run} disabled={busy || !chosen} className="btn-secondary flex h-9 items-center gap-2 px-3 text-[13px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4 text-dim" strokeWidth={1.5} />} Test
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

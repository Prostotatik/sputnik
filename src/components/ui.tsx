"use client";

import clsx from "clsx";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { scoreTone } from "@/lib/client/format";
import { shortPlatform } from "@/lib/platforms";

const TONE_TEXT = { good: "text-score", mixed: "text-yellow", bad: "text-bad", none: "text-dim" } as const;
const TONE_FILL = { good: "bg-score text-bg", mixed: "bg-yellow text-bg", bad: "bg-bad text-fg", none: "bg-panel-3 text-dim" } as const;

/** Metascore reading in Metacritic's own colour bands. */
export function ScoreBadge({ score, size = "sm", className }: { score: number | null; size?: "sm" | "lg"; className?: string }) {
  const tone = scoreTone(score);
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center font-mono tabular-nums",
        size === "lg"
          ? clsx("h-14 w-14 rounded-[10px] text-[28px] font-medium", TONE_FILL[tone])
          : clsx("h-6 min-w-7 rounded-md bg-panel-3 px-1.5 text-xs font-medium", TONE_TEXT[tone]),
        className,
      )}
      aria-label={score === null ? "Metascore пока нет" : `Metascore ${score}`}
    >
      {score ?? "—"}
    </span>
  );
}

export function UserScoreRing({ score, size = 48 }: { score: number | null; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 10;
  const tone = scoreTone(score, 10);
  const color = { good: "var(--color-score)", mixed: "var(--color-yellow)", bad: "var(--color-bad)", none: "var(--color-dim)" }[tone];
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-label={score === null ? "Userscore пока нет" : `Userscore ${score}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-panel-3)" strokeWidth="2" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="2" fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" />
      </svg>
      <span className={clsx("absolute font-mono text-base font-medium tabular-nums", TONE_TEXT[tone])}>{score === null ? "—" : score.toFixed(1)}</span>
    </span>
  );
}

export function PlatformBadges({ platforms, max = 3, variant = "solid" }: { platforms: string[]; max?: number; variant?: "solid" | "outline" }) {
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;
  const cls = variant === "solid" ? "badge" : "rounded-md border border-line-2 bg-bg/70 px-2 py-1 font-mono text-xs text-fg";
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span key={p} title={p} className={cls}>
          {shortPlatform(p)}
        </span>
      ))}
      {rest > 0 && <span className={cls}>+{rest}</span>}
    </span>
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={clsx("pill relative flex h-9 items-center transition-colors hover:border-line-2", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-9 pl-3 text-[13px] text-fg focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel-2">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-dim" strokeWidth={1.5} />
    </label>
  );
}

export function CardTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-medium text-fg">{children}</h2>
      {right}
    </div>
  );
}

/** A change against the previous period, coloured only by its direction. */
export function Change({ value, suffix = "", against }: { value: number | null; suffix?: string; against: string }) {
  if (value === null) return <span className="font-mono text-xs text-dim">нет данных для сравнения</span>;
  const tone = value > 0 ? "text-good" : value < 0 ? "text-bad" : "text-dim";
  return (
    <span className="font-mono text-xs tabular-nums">
      <span className={tone}>
        {value > 0 ? "+" : ""}
        {value}
        {suffix}
      </span>
      <span className="text-dim"> к {against}</span>
    </span>
  );
}

/** Native modal dialog: Esc and a backdrop click close it; full screen on phones. */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={clsx(
        "m-auto max-h-[calc(100dvh-48px)] w-[min(960px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-card)] border border-line-2 bg-panel p-0 text-fg backdrop:bg-black/70",
        "max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col max-sm:h-full">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="dialog-title" className="text-[17px] font-medium">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-panel-3 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-panel-3", className)} />;
}

"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { scoreTone } from "@/lib/client/format";
import { shortPlatform } from "@/lib/platforms";

export function ScoreBadge({ score, size = "sm", className }: { score: number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const tone = scoreTone(score);
  const sizes = { sm: "h-[22px] min-w-[22px] text-[11px] rounded-[5px] px-1", md: "h-7 min-w-7 text-xs rounded-md px-1.5", lg: "h-[54px] w-[54px] text-[26px] rounded-[10px]" };
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center font-semibold tabular-nums",
        sizes[size],
        size === "lg"
          ? { good: "bg-score text-black", mixed: "bg-yellow text-black", bad: "bg-bad text-white", none: "bg-panel-3 text-muted" }[tone]
          : {
              good: "bg-[#1f3a14] text-score ring-1 ring-score/25",
              mixed: "bg-[#3a3214] text-yellow ring-1 ring-yellow/25",
              bad: "bg-[#3a1414] text-bad ring-1 ring-bad/25",
              none: "bg-panel-3 text-dim ring-1 ring-line-2",
            }[tone],
        className,
      )}
      aria-label={score === null ? "No Metascore yet" : `Metascore ${score}`}
    >
      {score ?? "tbd"}
    </span>
  );
}

export function UserScoreRing({ score, size = 46 }: { score: number | null; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 10;
  const color = { good: "var(--color-good)", mixed: "var(--color-yellow)", bad: "var(--color-bad)", none: "var(--color-dim)" }[scoreTone(score, 10)];
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-label={score === null ? "No Userscore yet" : `Userscore ${score}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#24242b" strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="3" fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[17px] font-semibold tabular-nums" style={{ color }}>
        {score === null ? "tbd" : score.toFixed(1)}
      </span>
    </span>
  );
}

export function PlatformBadges({ platforms, max = 3, variant = "solid" }: { platforms: string[]; max?: number; variant?: "solid" | "outline" }) {
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((p) => (
        <span
          key={p}
          title={p}
          className={variant === "solid" ? "badge" : "rounded-md border border-line-2 bg-black/30 px-2.5 py-1 text-[15px] text-fg/90 backdrop-blur"}
        >
          {shortPlatform(p)}
        </span>
      ))}
      {rest > 0 && <span className={variant === "solid" ? "badge" : "rounded-md border border-line-2 px-2.5 py-1 text-sm text-muted"}>+{rest}</span>}
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
    <label className={clsx("pill relative flex h-11 items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-10 pl-4 text-[13px] text-fg focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel-2">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 h-4 w-4 text-muted" />
    </label>
  );
}

export function CardTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{children}</h2>
      {right}
    </div>
  );
}

export function Sparkline({ values, color = "var(--color-good)", height = 40, width = 120, fill = true }: { values: number[]; color?: string; height?: number; width?: number; fill?: boolean }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)]);
  // Smooth path using midpoints.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  const id = `sp-${color.replace(/[^a-z0-9]/gi, "")}-${width}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.45" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />}
      <path d={d} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-panel-3/70", className)} />;
}

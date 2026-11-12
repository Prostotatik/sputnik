"use client";

import clsx from "clsx";
import { Activity, ChartColumnBig, ChartPie, Gamepad2, Loader2, Play, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { clock, count, timeAgo, timeUntil } from "@/lib/client/format";
import { useNow } from "@/lib/client/hooks";
import { useStatus } from "./status";

const NAV = [
  { href: "/games", label: "Игры", icon: Gamepad2 },
  { href: "/workers", label: "Воркеры", icon: Activity },
  { href: "/analytics", label: "Аналитика", icon: ChartPie },
  { href: "/monitoring", label: "Мониторинг", icon: ChartColumnBig },
];

const SPUTNIK_ANTENNAS = "M19.8 14.5 L36.5 18 M18.9 16.7 L33.4 25.7 M16.7 18.9 L25.7 33.4 M14.5 19.8 L18 36.5";

export function Logo({ className }: { className?: string }) {
  return (
    // Sputnik-1 silhouette: a sphere trailing four antennas.
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <path d={SPUTNIK_ANTENNAS} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="13" cy="13" r="7.5" className="fill-accent" />
      <path d="M8.8 10 A5.5 5.5 0 0 1 13 7.5" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Signature telemetry dot: accent and pulsing only while a run is live. */
export function TelemetryDot({ state, className }: { state: "running" | "idle" | "offline"; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        state === "running" ? "live-dot bg-accent" : state === "idle" ? "bg-dim" : "bg-bad",
        className,
      )}
    />
  );
}

function useWorkerState(): { state: "running" | "idle" | "offline"; label: string; detail: string } {
  const { status, connected } = useStatus();
  const now = useNow(10_000);
  if (!status) return { state: "offline", label: "Подключение", detail: "Загружаем статус сервиса" };
  if (!connected) return { state: "offline", label: "Связь потеряна", detail: "Переподключаемся…" };
  if (!status.worker.online) return { state: "offline", label: "Воркер не в сети", detail: status.worker.beatAt ? `Был в сети ${timeAgo(status.worker.beatAt, now)}` : "Запустите его: pnpm worker" };
  if (status.active && status.run) {
    return { state: "running", label: "Идёт сбор", detail: `${status.run.processed} из ${count(status.run.total, ["игры", "игр", "игр"])}` };
  }
  return { state: "idle", label: "Воркер ждёт", detail: `Следующий запуск в ${clock(status.worker.nextRunAt)}, ${timeUntil(status.worker.nextRunAt, now)}` };
}

export function Sidebar() {
  const path = usePathname();
  const worker = useWorkerState();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-deep md:flex">
      <Link href="/games" className="flex h-16 items-center gap-2.5 px-5 text-fg" aria-label="Sputnik, на главную">
        <Logo className="h-6 w-6" />
        <span className="text-base font-medium">Sputnik</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-0.5 px-3" aria-label="Главное меню">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                active ? "bg-panel-3 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" : "text-muted hover:bg-panel-2 hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line px-5 py-4" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-[13px] text-fg">
          <TelemetryDot state={worker.state} />
          {worker.label}
        </p>
        <p className="mt-1 pl-4 font-mono text-xs text-dim">{worker.detail}</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const worker = useWorkerState();
  return (
    <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-line bg-deep px-3 py-2 md:hidden" aria-label="Главное меню">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={clsx("flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px]", path.startsWith(href) ? "bg-panel-3 text-fg" : "text-muted")}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} /> {label}
        </Link>
      ))}
      <span className="ml-auto flex items-center px-2" title={`${worker.label}. ${worker.detail}`}>
        <TelemetryDot state={worker.state} />
      </span>
    </nav>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="pill flex h-9 w-full max-w-80 items-center gap-2.5 px-3 text-muted transition-colors focus-within:border-line-2">
      <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-[13px] text-fg placeholder:text-dim focus:outline-none"
      />
    </label>
  );
}

export function RunNowButton({ className }: { className?: string }) {
  const { status, runNow } = useStatus();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const active = Boolean(status?.active);

  const onClick = async () => {
    setPending(true);
    const res = await runNow();
    setMessage({ ok: res.ok, text: res.message });
    setPending(false);
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || active}
        title={active ? "Запуск уже идёт" : "Запустить сбор прямо сейчас"}
        className="btn-primary flex h-9 items-center gap-2 px-4 text-[13px] font-medium"
      >
        {pending || active ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Play className="h-4 w-4" strokeWidth={1.5} />}
        {active ? "Идёт сбор" : "Запустить"}
      </button>
      {message && (
        <p
          role="status"
          className={clsx(
            "absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border bg-panel-3 px-3 py-2 text-[13px] text-fg",
            message.ok ? "border-line-2" : "border-bad/40",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="relative z-20 flex min-h-16 flex-wrap items-center gap-3 px-6 py-3">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </header>
  );
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-1 px-6 py-10 text-center", className)}>
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="max-w-sm text-[13px] leading-5 text-muted">{children}</div>}
    </div>
  );
}

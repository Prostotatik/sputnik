"use client";

import clsx from "clsx";
import { Activity, ChartColumnBig, ChartPie, Gamepad2, Loader2, Play, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { clock, timeAgo, timeUntil } from "@/lib/client/format";
import { useNow } from "@/lib/client/hooks";
import { useStatus } from "./status";

const NAV = [
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/workers", label: "Workers", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: ChartPie },
  { href: "/monitoring", label: "Monitoring", icon: ChartColumnBig },
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <path d="M8 31 L8 9 L32 31 L32 9" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="32" cy="9" r="2.6" fill="currentColor" />
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
  if (!status) return { state: "offline", label: "Connecting", detail: "Loading service status" };
  if (!connected) return { state: "offline", label: "Connection lost", detail: "Retrying…" };
  if (!status.worker.online) return { state: "offline", label: "Worker offline", detail: status.worker.beatAt ? `Last seen ${timeAgo(status.worker.beatAt, now)}` : "Start it with pnpm worker" };
  if (status.active && status.run) {
    return { state: "running", label: "Collecting", detail: `${status.run.processed} of ${status.run.total} games` };
  }
  return { state: "idle", label: "Worker idle", detail: `Next run ${clock(status.worker.nextRunAt)}, ${timeUntil(status.worker.nextRunAt, now)}` };
}

export function Sidebar() {
  const path = usePathname();
  const worker = useWorkerState();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-deep md:flex">
      <Link href="/games" className="flex h-16 items-center gap-2.5 px-5 text-fg" aria-label="Sputnik home">
        <Logo className="h-6 w-6" />
        <span className="text-base font-medium">Sputnik</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-0.5 px-3" aria-label="Main">
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
    <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-line bg-deep px-3 py-2 md:hidden" aria-label="Main">
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
        title={active ? "A run is in progress" : "Start a collection run now"}
        className="btn-primary flex h-9 items-center gap-2 px-4 text-[13px] font-medium"
      >
        {pending || active ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Play className="h-4 w-4" strokeWidth={1.5} />}
        {active ? "Running" : "Run now"}
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

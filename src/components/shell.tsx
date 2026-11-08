"use client";

import clsx from "clsx";
import { Activity, ChartColumnBig, ChartPie, Gamepad2, Loader2, Play, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStatus } from "./status";

const NAV = [
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/workers", label: "Workers", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: ChartPie },
  { href: "/monitoring", label: "Monitoring", icon: ChartColumnBig },
];

export function Logo({ className }: { className?: string }) {
  // Sputnik mark: an orbit ring crossed by the satellite's antenna stroke.
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <path d="M8 31 L8 9 L32 31 L32 9" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="32" cy="9" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { status } = useStatus();
  const online = status?.worker.online;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[120px] flex-col border-r border-line/70 bg-bg/80 backdrop-blur-xl md:flex">
      <Link href="/games" className="mx-auto mt-6 mb-12 text-fg" aria-label="Sputnik home">
        <Logo className="h-10 w-10" />
      </Link>
      <nav className="flex flex-col gap-1.5 px-2.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[12px] transition-colors",
                active ? "bg-panel-3 text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]" : "text-muted hover:bg-panel-2 hover:text-fg",
              )}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto mb-6 flex flex-col items-center gap-2 px-3 text-center text-[10px] text-muted">
        <span
          className={clsx("h-2 w-2 rounded-full", online ? "live-dot bg-good" : "bg-bad")}
          aria-hidden
        />
        {status ? (online ? `Worker ${status.worker.state}` : "Worker offline") : "Connecting…"}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-3 py-2 backdrop-blur md:hidden" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={clsx("flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs", path.startsWith(href) ? "bg-panel-3 text-fg" : "text-muted")}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="pill flex h-11 w-full max-w-[330px] items-center gap-3 rounded-full px-4 text-sm text-muted focus-within:border-accent/60">
      <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-[13px] text-fg placeholder:text-muted/80 focus:outline-none"
      />
    </label>
  );
}

export function StatusDot() {
  const { status, connected } = useStatus();
  const online = connected && status?.worker.online;
  const label = !connected ? "Disconnected from server" : online ? `Worker online (${status?.worker.state})` : "Worker offline";
  return (
    <span title={label} aria-label={label} role="status" className="ml-1 flex h-11 w-5 items-center justify-center">
      <span className={clsx("h-2.5 w-2.5 rounded-full", online ? "live-dot bg-good" : "bg-bad")} />
    </span>
  );
}

export function RunNowButton({ size = "md", className }: { size?: "md" | "sm"; className?: string }) {
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
        className={clsx(
          "btn-primary flex items-center gap-2 font-medium",
          size === "md" ? "h-11 px-5 text-[13px]" : "h-10 px-4 text-xs",
        )}
      >
        {pending || active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" strokeWidth={2.2} />}
        {active ? "Running…" : "Run Now"}
      </button>
      {message && (
        <p
          role="status"
          className={clsx(
            "absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border px-3 py-2 text-xs shadow-xl",
            message.ok ? "border-good/30 bg-panel-2 text-fg" : "border-bad/40 bg-panel-2 text-fg",
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
    <header className="relative z-20 flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 md:px-6">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex flex-wrap items-center gap-3">
        {right}
        <StatusDot />
      </div>
    </header>
  );
}

/** Decorative silk ribbons behind the content, as in the references. */
export function Backdrop({ tone = "mono" }: { tone?: "mono" | "violet" }) {
  const c1 = tone === "mono" ? "#d9d9e3" : "#b9a6ff";
  const c2 = tone === "mono" ? "#6b6b78" : "#6d4dff";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="absolute -left-40 top-[30%] h-[900px] w-[520px] opacity-60" viewBox="0 0 520 900" fill="none">
        <defs>
          <linearGradient id={`rib-${tone}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} stopOpacity="0.9" />
            <stop offset="0.45" stopColor={c2} stopOpacity="0.35" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <filter id={`soft-${tone}`}>
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M ${-40 + i * 30} 40 C ${360 - i * 30} ${160 + i * 40}, ${-60 + i * 20} ${420 + i * 30}, ${300 - i * 25} ${860 - i * 20}`}
            stroke={`url(#rib-${tone})`}
            strokeWidth={46 - i * 9}
            strokeLinecap="round"
            filter={`url(#soft-${tone})`}
            opacity={0.55 - i * 0.1}
          />
        ))}
      </svg>
      {tone === "violet" && (
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[820px] rotate-[-12deg] rounded-[50%] bg-[radial-gradient(closest-side,rgb(167_139_250/0.20),transparent)] blur-2xl" />
      )}
    </div>
  );
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center", className)}>
      <p className="text-sm font-medium text-fg/90">{title}</p>
      {children && <div className="max-w-sm text-xs leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

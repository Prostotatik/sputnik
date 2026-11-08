export function timeAgo(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function timeUntil(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "—";
  const s = Math.round((ts - now) / 1000);
  if (s <= 0) return "now";
  const m = Math.ceil(s / 60);
  if (m < 60) return `in ${m} min`;
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function clock(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function usd(n: number): string {
  return n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

/** Colour band for a 0-100 Metascore (Metacritic convention). */
export function scoreTone(score: number | null | undefined, max = 100): "good" | "mixed" | "bad" | "none" {
  if (score === null || score === undefined) return "none";
  const s = (score / max) * 100;
  if (s >= 75) return "good";
  if (s >= 50) return "mixed";
  return "bad";
}

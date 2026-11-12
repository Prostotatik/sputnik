const LOCALE = "ru-RU";
const pluralRules = new Intl.PluralRules(LOCALE);

/** Russian plural: plural(5, ["игра", "игры", "игр"]) → "игр". */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const rule = pluralRules.select(n);
  return rule === "one" ? one : rule === "few" ? few : many;
}

/** "5 игр", "1 игра". */
export function count(n: number | null | undefined, forms: [string, string, string]): string {
  const v = n ?? 0;
  return `${num(v)} ${plural(v, forms)}`;
}

export function timeAgo(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} с назад`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн. назад`;
}

export function timeUntil(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return "—";
  const s = Math.round((ts - now) / 1000);
  if (s <= 0) return "сейчас";
  const m = Math.ceil(s / 60);
  if (m < 60) return `через ${m} мин`;
  return `через ${Math.floor(m / 60)} ч ${m % 60} мин`;
}

/** "каждый час", "каждые 30 мин", "каждые 2 ч 30 мин". */
export function every(minutes: number | null | undefined): string {
  if (!minutes) return "";
  if (minutes === 60) return "каждый час";
  if (minutes < 60) return `каждые ${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `каждые ${h} ч${m ? ` ${m} мин` : ""}`;
}

/** Release date as "10.11" (this year) or "10.11.24". Dates are stored as YYYY-MM-DD. */
export function shortDate(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "скоро";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "скоро";
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: sameYear ? undefined : "2-digit", timeZone: "UTC" });
}

/** Full release date, "10 нояб. 2025 г.". */
export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "12 нояб., 14:05". */
export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString(LOCALE, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} ч ${m} мин`;
  if (m) return `${m} мин ${String(sec).padStart(2, "0")} с`;
  return `${sec} с`;
}

export function clock(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

export function clockSeconds(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE);
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(LOCALE).format(n);
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

"use client";

import { useCallback, useEffect, useState } from "react";

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** Fetches JSON from an API route; refetches when `url` changes or `refresh()` is called. */
export function useJson<T>(url: string | null, opts: { intervalMs?: number } = {}) {
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: "", data: null, error: null });
  const [last, setLast] = useState<T | null>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const key = url ? `${url}#${tick}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (cancelled) return;
        setLoaded({ key: `${url}#${tick}`, data, error: null });
        setLast(data);
      })
      .catch((e: Error) => !cancelled && setLoaded({ key: `${url}#${tick}`, data: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  useEffect(() => {
    if (!opts.intervalMs) return;
    const id = setInterval(refresh, opts.intervalMs);
    return () => clearInterval(id);
  }, [opts.intervalMs, refresh]);

  return {
    /** Latest successfully loaded data (kept while a refetch is in flight). */
    data: url ? last : null,
    error: loaded.key === key ? loaded.error : null,
    loading: Boolean(url) && loaded.key !== key,
    refresh,
    setData: setLast,
  };
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

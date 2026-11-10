"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { StatusSnapshot } from "@/core/queries";

interface StatusContextValue {
  status: StatusSnapshot | null;
  connected: boolean;
  runNow: () => Promise<{ ok: boolean; message: string }>;
}

const StatusContext = createContext<StatusContextValue>({
  status: null,
  connected: false,
  runNow: async () => ({ ok: false, message: "Not ready" }),
});

/** Poll /api/status when the stream has delivered nothing fresh for this long. */
const STREAM_STALE_MS = 4_000;
const WATCHDOG_MS = 2_000;

/**
 * Realtime service status. The SSE stream is the fast path; a compressing reverse proxy can
 * buffer it, so a watchdog polls the JSON snapshot whenever the stream goes quiet.
 * Snapshots older than the one on screen are ignored, so late buffered frames never roll the UI back.
 */
export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let latest = 0;
    let lastStreamFrame = 0;
    let polling = false;
    let disposed = false;

    const accept = (s: StatusSnapshot): boolean => {
      if (disposed || s.now <= latest) return false;
      latest = s.now;
      setStatus(s);
      setConnected(true);
      return true;
    };

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        accept((await res.json()) as StatusSnapshot);
      } catch {
        if (!disposed && Date.now() - lastStreamFrame > STREAM_STALE_MS) setConnected(false);
      } finally {
        polling = false;
      }
    };

    const open = () => {
      es = new EventSource("/api/stream");
      es.onmessage = (e) => {
        try {
          if (accept(JSON.parse(e.data) as StatusSnapshot)) lastStreamFrame = Date.now();
        } catch {
          // ignore malformed frame
        }
      };
      es.onerror = () => {
        es?.close();
        retry = setTimeout(open, 3000);
      };
    };

    void poll();
    open();
    const watchdog = setInterval(() => {
      if (Date.now() - lastStreamFrame > STREAM_STALE_MS) void poll();
    }, WATCHDOG_MS);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(watchdog);
      es?.close();
    };
  }, []);

  const runNow = useCallback(async () => {
    const res = await fetch("/api/runs", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, message: "Run requested. The worker starts it within a few seconds." };
    return { ok: false, message: body.error ?? `Could not start a run (${res.status})` };
  }, []);

  return <StatusContext.Provider value={{ status, connected, runNow }}>{children}</StatusContext.Provider>;
}

export function useStatus() {
  return useContext(StatusContext);
}

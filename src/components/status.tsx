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

/** One shared EventSource for the realtime service status. */
export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      es = new EventSource("/api/stream");
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          setStatus(JSON.parse(e.data) as StatusSnapshot);
        } catch {
          // ignore malformed frame
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(open, 3000);
      };
    };
    open();
    return () => {
      clearTimeout(retry);
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

import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { aiCalls, aiModelState } from "@/lib/db/schema";
import { dayKey } from "@/lib/time";
import { estimateCost, modelSpec, pool, type Capability, type ModelSpec } from "./catalog";

/** Google free-tier daily quotas reset at midnight Pacific time. */
const QUOTA_TZ = "America/Los_Angeles";
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const OVERLOAD_COOLDOWN_MS = 30_000;

export type AiErrorKind = "rate_limit" | "overloaded" | "invalid" | "other";

export class AiCallError extends Error {
  constructor(
    message: string,
    readonly kind: AiErrorKind,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

export class QuotaExhaustedError extends Error {
  constructor(capability: Capability, readonly attempts: string[]) {
    super(`Нет доступной модели (${capability}) в пределах лимитов, пробовали: ${attempts.join(", ") || "ни одной"}`);
    this.name = "QuotaExhaustedError";
  }
}

export interface CallResult<T> {
  value: T;
  inputTokens: number;
  outputTokens: number;
}

export interface RouteRequest<T> {
  capability: Capability;
  purpose: string;
  /** Rough input token estimate used for the TPM check. */
  estimatedTokens: number;
  preferredModel?: string;
  runId?: number | null;
  gameId?: number | null;
  /** Restrict to models supporting structured output (JSON schema). */
  requireStructured?: boolean;
  call: (model: ModelSpec) => Promise<CallResult<T>>;
}

export interface Routed<T> extends CallResult<T> {
  model: string;
}

type ModelState = typeof aiModelState.$inferSelect;

function buckets(now: number) {
  return { minute: String(Math.floor(now / 60_000)), day: dayKey(new Date(now), QUOTA_TZ) };
}

/** Normalises stored counters to the current minute/day windows. */
export function currentState(db: Db, model: string, now: number): ModelState {
  const row = db.select().from(aiModelState).where(eq(aiModelState.model, model)).get();
  const b = buckets(now);
  const base: ModelState = row ?? {
    model,
    minuteBucket: b.minute,
    minuteRequests: 0,
    minuteTokens: 0,
    dayBucket: b.day,
    dayRequests: 0,
    dayTokens: 0,
    cooldownUntil: 0,
    lastError: null,
  };
  return {
    ...base,
    ...(base.minuteBucket !== b.minute ? { minuteBucket: b.minute, minuteRequests: 0, minuteTokens: 0 } : {}),
    ...(base.dayBucket !== b.day ? { dayBucket: b.day, dayRequests: 0, dayTokens: 0 } : {}),
  };
}

function saveState(db: Db, s: ModelState): void {
  db.insert(aiModelState).values(s).onConflictDoUpdate({ target: aiModelState.model, set: s }).run();
}

export function canUse(spec: ModelSpec, s: ModelState, estTokens: number, now: number): boolean {
  if (s.cooldownUntil > now) return false;
  if (s.minuteRequests + 1 > spec.rpm) return false;
  if (s.dayRequests + 1 > spec.rpd) return false;
  if (s.minuteTokens + estTokens > spec.tpm) return false;
  return true;
}

export interface RouterOptions {
  openai: boolean;
  now?: () => number;
  /** Max models tried per request. */
  maxAttempts?: number;
}

/** Routes AI requests across model pools within free-tier limits. */
export class AiRouter {
  private readonly now: () => number;

  constructor(
    private readonly db: Db,
    private readonly opts: RouterOptions,
  ) {
    this.now = opts.now ?? Date.now;
  }

  async route<T>(req: RouteRequest<T>): Promise<Routed<T>> {
    const candidates = pool(req.capability, { openai: this.opts.openai, preferred: req.preferredModel }).filter(
      (m) => !req.requireStructured || m.structured,
    );
    const tried: string[] = [];
    const maxAttempts = this.opts.maxAttempts ?? candidates.length;

    for (const spec of candidates) {
      if (tried.length >= maxAttempts) break;
      const now = this.now();
      const state = currentState(this.db, spec.id, now);
      if (!canUse(spec, state, req.estimatedTokens, now)) continue;

      tried.push(spec.id);
      // Reserve the slot before calling so parallel callers see it.
      saveState(this.db, {
        ...state,
        minuteRequests: state.minuteRequests + 1,
        minuteTokens: state.minuteTokens + req.estimatedTokens,
        dayRequests: state.dayRequests + 1,
        dayTokens: state.dayTokens + req.estimatedTokens,
      });
      const started = this.now();
      try {
        const result = await req.call(spec);
        this.adjustTokens(spec.id, result.inputTokens + result.outputTokens - req.estimatedTokens);
        this.log(req, spec, "ok", started, result.inputTokens, result.outputTokens);
        return { ...result, model: spec.id };
      } catch (err) {
        const e = err instanceof AiCallError ? err : new AiCallError(String((err as Error)?.message ?? err), "other");
        const cooldown =
          e.kind === "rate_limit"
            ? (e.retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS)
            : e.kind === "overloaded"
              ? OVERLOAD_COOLDOWN_MS
              : 0;
        const s = currentState(this.db, spec.id, this.now());
        saveState(this.db, {
          ...s,
          cooldownUntil: cooldown ? this.now() + cooldown : s.cooldownUntil,
          lastError: e.message.slice(0, 300),
        });
        this.log(req, spec, e.kind === "rate_limit" ? "rate_limited" : "error", started, 0, 0, e.message);
      }
    }
    throw new QuotaExhaustedError(req.capability, tried);
  }

  private adjustTokens(model: string, delta: number): void {
    if (delta === 0) return;
    const s = currentState(this.db, model, this.now());
    saveState(this.db, {
      ...s,
      minuteTokens: Math.max(0, s.minuteTokens + delta),
      dayTokens: Math.max(0, s.dayTokens + delta),
    });
  }

  private log<T>(
    req: RouteRequest<T>,
    spec: ModelSpec,
    status: "ok" | "error" | "rate_limited",
    started: number,
    inputTokens: number,
    outputTokens: number,
    error?: string,
  ): void {
    this.db
      .insert(aiCalls)
      .values({
        ts: this.now(),
        provider: spec.provider,
        model: spec.id,
        capability: req.capability,
        purpose: req.purpose,
        runId: req.runId ?? null,
        gameId: req.gameId ?? null,
        inputTokens,
        outputTokens,
        latencyMs: Math.max(0, this.now() - started),
        status,
        error: error ? redactSecrets(error).slice(0, 500) : null,
        costUsd: estimateCost(spec, inputTokens, outputTokens),
      })
      .run();
  }
}

/** Removes anything that looks like an API key from text destined for logs or the UI. */
export function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/sk-[0-9A-Za-z_-]{16,}/g, "[redacted]")
    .replace(/([?&]key=)[^&\s"]+/gi, "$1[redacted]");
}

export function usageSnapshot(db: Db, now = Date.now()) {
  const google = pool("text", { openai: true })
    .concat(pool("embedding", { openai: true }))
    .filter((m, i, arr) => arr.indexOf(m) === i);
  return google.map((spec) => {
    const s = currentState(db, spec.id, now);
    return {
      model: spec.id,
      label: spec.label,
      provider: spec.provider,
      capabilities: spec.capabilities,
      rpm: spec.rpm,
      rpd: spec.rpd,
      tpm: spec.tpm,
      minuteRequests: s.minuteRequests,
      dayRequests: s.dayRequests,
      dayTokens: s.dayTokens,
      coolingDown: s.cooldownUntil > now,
      lastError: s.lastError,
    };
  });
}

export { modelSpec };

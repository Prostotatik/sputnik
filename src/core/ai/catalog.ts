export type Capability = "text" | "video" | "embedding";
export type Provider = "google" | "openai";

export interface ModelSpec {
  id: string;
  provider: Provider;
  /** Name as written in doc/google-limits.md. */
  label: string;
  capabilities: Capability[];
  rpm: number;
  tpm: number;
  rpd: number;
  /** Estimated paid-tier USD price per 1M input / output tokens (free tier is $0). */
  priceIn: number;
  priceOut: number;
  /** Supports responseSchema / JSON mode and system instructions. */
  structured: boolean;
}

const UNLIMITED = Number.MAX_SAFE_INTEGER;

/**
 * Free-tier limits from doc/google-limits.md, mapped to API model IDs.
 * Order = preference inside each capability pool (high daily quota first).
 */
export const MODELS: ModelSpec[] = [
  { id: "gemini-3.5-flash-lite", provider: "google", label: "Gemini 3.5 Flash Lite", capabilities: ["text", "video"], rpm: 15, tpm: 250_000, rpd: 500, priceIn: 0.1, priceOut: 0.4, structured: true },
  { id: "gemini-3.1-flash-lite", provider: "google", label: "Gemini 3.1 Flash Lite", capabilities: ["text", "video"], rpm: 15, tpm: 250_000, rpd: 500, priceIn: 0.1, priceOut: 0.4, structured: true },
  { id: "gemma-4-31b-it", provider: "google", label: "Gemma 4 31B", capabilities: ["text"], rpm: 30, tpm: 16_000, rpd: 14_400, priceIn: 0, priceOut: 0, structured: false },
  { id: "gemma-4-26b-a4b-it", provider: "google", label: "Gemma 4 26B", capabilities: ["text"], rpm: 30, tpm: 16_000, rpd: 14_400, priceIn: 0, priceOut: 0, structured: false },
  { id: "gemini-2.5-flash-lite", provider: "google", label: "Gemini 2.5 Flash Lite", capabilities: ["text", "video"], rpm: 10, tpm: 250_000, rpd: 20, priceIn: 0.1, priceOut: 0.4, structured: true },
  { id: "gemini-3.8-flash", provider: "google", label: "Gemini 3.8 Flash", capabilities: ["text", "video"], rpm: 5, tpm: 250_000, rpd: 20, priceIn: 0.3, priceOut: 2.5, structured: true },
  { id: "gemini-3.6-flash", provider: "google", label: "Gemini 3.6 Flash", capabilities: ["text", "video"], rpm: 5, tpm: 250_000, rpd: 20, priceIn: 0.3, priceOut: 2.5, structured: true },
  { id: "gemini-3-flash-preview", provider: "google", label: "Gemini 3 Flash", capabilities: ["text", "video"], rpm: 5, tpm: 250_000, rpd: 20, priceIn: 0.3, priceOut: 2.5, structured: true },
  { id: "gemini-2.5-flash", provider: "google", label: "Gemini 2.5 Flash", capabilities: ["text", "video"], rpm: 5, tpm: 250_000, rpd: 20, priceIn: 0.3, priceOut: 2.5, structured: true },
  { id: "gemini-embedding-2", provider: "google", label: "Gemini Embedding 2", capabilities: ["embedding"], rpm: 100, tpm: 30_000, rpd: 1_000, priceIn: 0.15, priceOut: 0, structured: false },
  { id: "gemini-embedding-001", provider: "google", label: "Gemini Embedding 1", capabilities: ["embedding"], rpm: 100, tpm: 30_000, rpd: 1_000, priceIn: 0.15, priceOut: 0, structured: false },
  // OpenAI fallback: used only when OPENAI_API_KEY is configured. Limits are account-specific.
  { id: "gpt-5-mini", provider: "openai", label: "OpenAI GPT-5 mini", capabilities: ["text"], rpm: 500, tpm: 500_000, rpd: UNLIMITED, priceIn: 0.25, priceOut: 2, structured: true },
  { id: "text-embedding-3-small", provider: "openai", label: "OpenAI Embedding 3 small", capabilities: ["embedding"], rpm: 3_000, tpm: 1_000_000, rpd: UNLIMITED, priceIn: 0.02, priceOut: 0, structured: false },
];

export function modelSpec(id: string): ModelSpec | undefined {
  return MODELS.find((m) => m.id === id);
}

/** Ordered pool for a capability; `preferred` (if valid) goes first. */
export function pool(capability: Capability, opts: { openai: boolean; preferred?: string }): ModelSpec[] {
  const list = MODELS.filter(
    (m) => m.capabilities.includes(capability) && (m.provider === "google" || opts.openai),
  );
  const pref = list.find((m) => m.id === opts.preferred);
  return pref ? [pref, ...list.filter((m) => m !== pref)] : list;
}

export function estimateCost(spec: ModelSpec, inputTokens: number, outputTokens: number): number {
  return (inputTokens * spec.priceIn + outputTokens * spec.priceOut) / 1_000_000;
}

export function isUnlimited(n: number): boolean {
  return n >= UNLIMITED;
}

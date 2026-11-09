import { cfAiGatewayToken, geminiBaseUrl, googleApiKey, openAiApiKey } from "@/lib/env";
import type { ModelSpec } from "./catalog";
import { AiCallError, redactSecrets, type CallResult } from "./router";

const OPENAI_BASE = "https://api.openai.com/v1";
const TIMEOUT_MS = 180_000;

export type JsonSchema = Record<string, unknown>;

export interface GenerateInput {
  system?: string;
  prompt: string;
  /** When set, the model must answer with JSON matching this schema. */
  schema?: JsonSchema;
  video?: { url: string; startSec: number; endSec: number };
  maxOutputTokens?: number;
}

function parseRetryDelay(body: unknown): number | undefined {
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details ?? [];
  const delay = details.find((d) => d.retryDelay)?.retryDelay;
  const secs = delay ? Number.parseFloat(delay) : NaN;
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) : undefined;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AiCallError(`Network error: ${(err as Error).message}`, "overloaded");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = redactSecrets(
      `${res.status}: ${(data as { error?: { message?: string } })?.error?.message ?? text.slice(0, 200)}`,
    );
    if (res.status === 429) throw new AiCallError(message, "rate_limit", parseRetryDelay(data));
    if (res.status >= 500) throw new AiCallError(message, "overloaded");
    throw new AiCallError(message, "invalid");
  }
  return data;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

function requireGoogleKey(): string {
  const key = googleApiKey();
  if (!key) throw new AiCallError("GOOGLE-AI-KEY is not configured", "invalid");
  return key;
}

function geminiUrl(spec: ModelSpec, method: string): string {
  return `${geminiBaseUrl()}/models/${spec.id}:${method}`;
}

function geminiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "x-goog-api-key": requireGoogleKey() };
  const token = cfAiGatewayToken();
  if (token) headers["cf-aig-authorization"] = `Bearer ${token}`;
  return headers;
}

async function geminiGenerate(spec: ModelSpec, input: GenerateInput): Promise<CallResult<string>> {
  const parts: Record<string, unknown>[] = [];
  if (input.video) {
    parts.push({
      file_data: { file_uri: input.video.url },
      video_metadata: { start_offset: `${input.video.startSec}s`, end_offset: `${input.video.endSec}s` },
    });
  }
  // Gemma models do not accept system instructions: fold them into the prompt.
  const prompt = !spec.structured && input.system ? `${input.system}\n\n${input.prompt}` : input.prompt;
  const jsonHint = input.schema && !spec.structured
    ? `\n\nRespond with JSON only (no markdown fences) matching this JSON schema:\n${JSON.stringify(input.schema)}`
    : "";
  parts.push({ text: prompt + jsonHint });

  const generationConfig: Record<string, unknown> = { maxOutputTokens: input.maxOutputTokens ?? 2048 };
  if (input.schema && spec.structured) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = input.schema;
  }
  if (input.video && spec.id !== "gemini-3.5-transcribe") generationConfig.mediaResolution = "MEDIA_RESOLUTION_LOW";

  const body: Record<string, unknown> = { contents: [{ role: "user", parts }], generationConfig };
  if (spec.structured && input.system) body.systemInstruction = { parts: [{ text: input.system }] };

  const data = (await postJson(geminiUrl(spec, "generateContent"), geminiHeaders(), body)) as GeminiResponse;
  if (data.promptFeedback?.blockReason) throw new AiCallError(`Blocked: ${data.promptFeedback.blockReason}`, "invalid");
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  const u = data.usageMetadata ?? {};
  return {
    value: text,
    inputTokens: u.promptTokenCount ?? 0,
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

async function geminiEmbed(spec: ModelSpec, text: string): Promise<CallResult<number[]>> {
  const data = (await postJson(
    geminiUrl(spec, "embedContent"),
    geminiHeaders(),
    { content: { parts: [{ text }] }, outputDimensionality: 768 },
  )) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values?.length) throw new AiCallError("Empty embedding", "other");
  return { value: values, inputTokens: Math.ceil(text.length / 4), outputTokens: 0 };
}

function requireOpenAiKey(): string {
  const key = openAiApiKey();
  if (!key) throw new AiCallError("OPENAI_API_KEY is not configured", "invalid");
  return key;
}

async function openAiGenerate(spec: ModelSpec, input: GenerateInput): Promise<CallResult<string>> {
  if (input.video) throw new AiCallError("OpenAI models cannot read YouTube URLs", "invalid");
  const body: Record<string, unknown> = {
    model: spec.id,
    messages: [
      ...(input.system ? [{ role: "system", content: input.system }] : []),
      { role: "user", content: input.prompt },
    ],
  };
  if (input.schema) {
    body.response_format = { type: "json_schema", json_schema: { name: "result", schema: input.schema } };
  }
  const data = (await postJson(`${OPENAI_BASE}/chat/completions`, { Authorization: `Bearer ${requireOpenAiKey()}` }, body)) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    value: data.choices?.[0]?.message?.content?.trim() ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function openAiEmbed(spec: ModelSpec, text: string): Promise<CallResult<number[]>> {
  const data = (await postJson(`${OPENAI_BASE}/embeddings`, { Authorization: `Bearer ${requireOpenAiKey()}` }, {
    model: spec.id,
    input: text,
    dimensions: 768,
  })) as { data?: { embedding?: number[] }[]; usage?: { prompt_tokens?: number } };
  const values = data.data?.[0]?.embedding;
  if (!values?.length) throw new AiCallError("Empty embedding", "other");
  return { value: values, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: 0 };
}

export function generate(spec: ModelSpec, input: GenerateInput): Promise<CallResult<string>> {
  return spec.provider === "google" ? geminiGenerate(spec, input) : openAiGenerate(spec, input);
}

export function embed(spec: ModelSpec, text: string): Promise<CallResult<number[]>> {
  return spec.provider === "google" ? geminiEmbed(spec, text) : openAiEmbed(spec, text);
}

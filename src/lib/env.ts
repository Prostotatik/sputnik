import { config } from "dotenv";
import path from "node:path";

let loaded = false;

/** Loads `.env` from the project root once. Server-side only. */
function load(): void {
  if (loaded) return;
  config({ path: path.join(process.cwd(), ".env"), quiet: true });
  loaded = true;
}

export function googleApiKey(): string | undefined {
  load();
  return process.env["GOOGLE-AI-KEY"] || process.env.GOOGLE_AI_KEY || undefined;
}

const GEMINI_DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Base URL for the Gemini REST API. Set GEMINI_BASE_URL to route through a proxy such as
 * Cloudflare AI Gateway (`.../google-ai-studio/v1beta`) when Google blocks the server's region.
 */
export function geminiBaseUrl(): string {
  load();
  return (process.env.GEMINI_BASE_URL || GEMINI_DEFAULT_BASE).replace(/\/+$/, "");
}

/** Token for an authenticated Cloudflare AI Gateway, sent as `cf-aig-authorization`. */
export function cfAiGatewayToken(): string | undefined {
  load();
  return process.env.CF_AIG_TOKEN || undefined;
}

export function openAiApiKey(): string | undefined {
  load();
  return process.env.OPENAI_API_KEY || undefined;
}

export function dataDir(): string {
  load();
  return process.env.SPUTNIK_DATA_DIR || path.join(process.cwd(), "data");
}

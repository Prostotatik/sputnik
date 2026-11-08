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

export function openAiApiKey(): string | undefined {
  load();
  return process.env.OPENAI_API_KEY || undefined;
}

export function dataDir(): string {
  load();
  return process.env.SPUTNIK_DATA_DIR || path.join(process.cwd(), "data");
}

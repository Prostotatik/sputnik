import type { z } from "zod";
import type { Db } from "@/lib/db/client";
import { openAiApiKey } from "@/lib/env";
import { parseModelJson } from "./json";
import { embed, generate, type JsonSchema } from "./providers";
import { AiCallError, AiRouter } from "./router";

export interface AiContext {
  purpose: string;
  preferredModel?: string;
  runId?: number | null;
  gameId?: number | null;
}

export interface AiResult<T> {
  value: T;
  model: string;
}

const estimate = (text: string) => Math.ceil(text.length / 4) + 600;

/** High-level AI operations routed through the quota-aware router. */
export class AiService {
  readonly router: AiRouter;

  constructor(db: Db, router?: AiRouter) {
    this.router = router ?? new AiRouter(db, { openai: Boolean(openAiApiKey()) });
  }

  async json<T>(ctx: AiContext, prompt: string, schema: JsonSchema, validator: z.ZodType<T>, system?: string): Promise<AiResult<T>> {
    const res = await this.router.route({
      capability: "text",
      purpose: ctx.purpose,
      estimatedTokens: estimate(prompt),
      preferredModel: ctx.preferredModel,
      runId: ctx.runId,
      gameId: ctx.gameId,
      call: async (spec) => {
        const out = await generate(spec, { prompt, schema, system });
        let parsed: unknown;
        try {
          parsed = parseModelJson(out.value);
        } catch (err) {
          throw new AiCallError(`Unparseable JSON from ${spec.id}: ${(err as Error).message}`, "invalid");
        }
        const checked = validator.safeParse(parsed);
        if (!checked.success) throw new AiCallError(`Schema mismatch from ${spec.id}: ${checked.error.message.slice(0, 200)}`, "invalid");
        return { ...out, value: checked.data };
      },
    });
    return { value: res.value, model: res.model };
  }

  async text(ctx: AiContext, prompt: string, system?: string): Promise<AiResult<string>> {
    const res = await this.router.route({
      capability: "text",
      purpose: ctx.purpose,
      estimatedTokens: estimate(prompt),
      preferredModel: ctx.preferredModel,
      runId: ctx.runId,
      gameId: ctx.gameId,
      call: async (spec) => {
        const out = await generate(spec, { prompt, system });
        if (!out.value) throw new AiCallError(`Empty answer from ${spec.id}`, "invalid");
        return out;
      },
    });
    return { value: res.value, model: res.model };
  }

  /** Transcribes speech from a segment of a YouTube video. ~90 tokens per second at low resolution. */
  async transcribeYoutube(ctx: AiContext, url: string, startSec: number, endSec: number, prompt: string): Promise<AiResult<string>> {
    const res = await this.router.route({
      capability: "video",
      purpose: ctx.purpose,
      estimatedTokens: Math.ceil((endSec - startSec) * 95) + 2000,
      preferredModel: ctx.preferredModel,
      runId: ctx.runId,
      gameId: ctx.gameId,
      call: (spec) => generate(spec, { prompt, video: { url, startSec, endSec }, maxOutputTokens: 8192 }),
    });
    return { value: res.value, model: res.model };
  }

  async embedding(ctx: AiContext, text: string): Promise<AiResult<number[]>> {
    const res = await this.router.route({
      capability: "embedding",
      purpose: ctx.purpose,
      estimatedTokens: Math.ceil(text.length / 4),
      runId: ctx.runId,
      gameId: ctx.gameId,
      call: (spec) => embed(spec, text),
    });
    return { value: res.value, model: res.model };
  }
}

/**
 * Translates what the library already holds into Russian (descriptions, review summaries, let's-play
 * verdicts, custom fields and rules, latest market insights) with the Gemini Flash Lite models only.
 * Descriptions go in batches, so a library of ~1000 games takes about 200 requests.
 *
 *   tsx scripts/translate-db.ts --dry-run                  counts what is still in English
 *   tsx scripts/translate-db.ts [--limit N] [--max-calls N] translates; safe to stop and run again (default cap: 250 requests)
 *
 * Run it from the project root with the same environment as the worker. Back up the database first.
 */
import { getDb } from "@/lib/db/client";
import { AiRouter } from "@/core/ai/router";
import { AiService } from "@/core/ai/service";
import { LIBRARY_TRANSLATE_MODELS, libraryTodo, translateLibrary } from "@/core/enrich/translate-library";
import { ensurePipeline } from "@/core/pipeline/repo";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? Number(args[at + 1]) : undefined;
};
const dryRun = args.includes("--dry-run");

const db = getDb();
ensurePipeline(db);
const ai = new AiService(db, new AiRouter(db, { openai: false, allow: LIBRARY_TRANSLATE_MODELS }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log("Still in English:", libraryTodo(db));
  if (dryRun) return;
  let waits = 0;
  const res = await translateLibrary(db, ai, {
    limit: flag("--limit"),
    maxCalls: flag("--max-calls") ?? 250,
    log: (line) => console.log(line),
    onQuota: async (err) => {
      if (++waits > 40) throw err;
      console.log(`quota: ${err.message}; waiting 30 s`);
      await sleep(30_000);
    },
  });
  console.log(`Done: ${res.done} translated, ${res.failed} failed, ${res.calls} requests. Left:`, libraryTodo(db));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

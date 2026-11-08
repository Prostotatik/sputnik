import { z } from "zod";
import { openDb } from "../src/lib/db/client";
import { AiService } from "../src/core/ai/service";

async function main() {
  const db = openDb(":memory:");
  const ai = new AiService(db);
  const res = await ai.json(
    { purpose: "smoke" },
    "List two things players like about chess. JSON with field likes (array of strings).",
    { type: "object", properties: { likes: { type: "array", items: { type: "string" } } }, required: ["likes"] },
    z.object({ likes: z.array(z.string()) }),
  );
  const emb = await ai.embedding({ purpose: "smoke" }, "Elden Ring action RPG");
  console.log(res.model, res.value, emb.model, emb.value.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

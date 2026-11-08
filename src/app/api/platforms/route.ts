import { db, json } from "@/lib/api";
import { listPlatforms } from "@/core/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return json(listPlatforms(db()));
}

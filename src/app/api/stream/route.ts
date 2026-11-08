import { db } from "@/lib/api";
import { statusSnapshot } from "@/core/queries";

export const dynamic = "force-dynamic";

const INTERVAL_MS = 1_000;

/** Server-Sent Events: pushes the service status snapshot every second. */
export function GET(req: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusSnapshot(db()))}\n\n`));
        } catch {
          clearInterval(timer);
        }
      };
      send();
      timer = setInterval(send, INTERVAL_MS);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

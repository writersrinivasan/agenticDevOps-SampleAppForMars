// Turns an async runner(emit) into a streaming NDJSON response (one JSON event per line).
export function ndjson(runner) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runner(emit);
      } catch (err) {
        emit({ type: "error", message: err.message });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}

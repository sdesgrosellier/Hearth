// HTTP helpers shared by Edge Functions: CORS, JSON errors, SSE writer.

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, cache-control, last-event-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Server-sent events writer. Each `send(event, data)` emits one frame the client's
 * EventSource dispatches by event name.
 */
export function createSseStream(): {
  response: Response;
  send: (event: string, data: unknown) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });

  const send = (event: string, data: unknown) => {
    if (closed || !controller) return;
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller?.close();
    } catch {
      // already closed
    }
  };

  const response = new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });

  return { response, send, close };
}

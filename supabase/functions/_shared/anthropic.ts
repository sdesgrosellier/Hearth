// Minimal streaming client for the Claude Messages API (no SDK dependency, so the
// Edge Function cold-starts fast). Yields text deltas as they arrive and returns
// token usage at the end.
//
// Docs: https://docs.claude.com/en/api/messages-streaming

import type { AssembledPrompt } from "./types.ts";

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

/** Advisor replies: best quality/latency balance for conversational work. */
export const DEFAULT_ADVISOR_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
/** Summaries, fact extraction, safety classification, synthesis (Phases 2-3, 6). */
export const DEFAULT_FAST_MODEL = Deno.env.get("ANTHROPIC_FAST_MODEL") ?? "claude-haiku-5-5";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface StreamOptions {
  model?: string;
  max_tokens?: number;
  /** Only sent when set explicitly; current models reject `temperature` (deprecated). */
  temperature?: number;
  signal?: AbortSignal;
}

export interface StreamResult {
  text: string;
  usage: Usage;
  stop_reason: string | null;
}

function apiKey(): string {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return key;
}

/**
 * Stream a completion. `onDelta` is called for each text chunk. Resolves with the
 * full text and usage once the stream ends.
 */
export async function streamMessage(
  prompt: AssembledPrompt,
  onDelta: (text: string) => void | Promise<void>,
  opts: StreamOptions = {},
): Promise<StreamResult> {
  const body = {
    model: opts.model ?? DEFAULT_ADVISOR_MODEL,
    max_tokens: opts.max_tokens ?? 1024,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    system: prompt.system,
    messages: prompt.messages,
    stream: true,
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const usage: Usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  let text = "";
  let stop_reason: string | null = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = async (eventName: string, dataRaw: string) => {
    if (!dataRaw) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      return;
    }
    switch (eventName) {
      case "message_start": {
        const u = (data.message as { usage?: Partial<Usage> })?.usage ?? {};
        usage.input_tokens = u.input_tokens ?? 0;
        usage.cache_creation_input_tokens = u.cache_creation_input_tokens ?? 0;
        usage.cache_read_input_tokens = u.cache_read_input_tokens ?? 0;
        break;
      }
      case "content_block_delta": {
        const delta = data.delta as { type?: string; text?: string };
        if (delta?.type === "text_delta" && delta.text) {
          text += delta.text;
          await onDelta(delta.text);
        }
        break;
      }
      case "message_delta": {
        const d = data.delta as { stop_reason?: string };
        if (d?.stop_reason) stop_reason = d.stop_reason;
        const u = data.usage as { output_tokens?: number } | undefined;
        if (u?.output_tokens) usage.output_tokens = u.output_tokens;
        break;
      }
      case "error": {
        const err = data.error as { message?: string };
        throw new Error(`Anthropic stream error: ${err?.message ?? "unknown"}`);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      await handleEvent(eventName, dataLines.join("\n"));
    }
  }

  return { text, usage, stop_reason };
}

/** Non-streaming helper for short structured calls (summaries, classification). */
export async function completeMessage(
  prompt: AssembledPrompt,
  opts: StreamOptions = {},
): Promise<StreamResult> {
  return streamMessage(prompt, () => {}, opts);
}

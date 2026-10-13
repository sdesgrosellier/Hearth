// "Full circle": a 360° map of everything the advisors said in one session.
// Invoked through POST /functions/v1/chat with { action: "full_circle", session_id }.
// Streams the same SSE events as a normal reply (session, delta, done, server_error)
// so the app reuses one stream parser. Stored as a `system` message with
// meta.kind = "full_circle" so it reloads with the conversation.

import { streamMessage } from "./anthropic.ts";
import { createSseStream, errorResponse } from "./http.ts";
import { getPersona } from "./personas/index.ts";
import { APP_NAME } from "./safety-layer.ts";
import type { AssembledPrompt } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export const FULL_CIRCLE_SYSTEM = `
You are the "Full circle" view inside ${APP_NAME}, a personal-advice app. Several AI advisor
characters have each answered the user's question from a deliberately different lens (a
mother, a father, a grandparent, a stranger, a child, a visitor from far away, historical
figures, a civil-rights elder, Scripture). Your job is NOT to pick a winner or produce a
bland average. It is to give the user a 360-degree map of their situation so they can see
the whole circle at once, and spot an angle they may have missed.

Write in plain, warm, direct prose addressed to the user as "you". No markdown, no bullet
characters, no emojis. Use exactly these five section labels, each on its own line in
capitals, in this order, with a blank line between sections:

WHERE THEY AGREE
WHERE THEY PULL APART
THE ANGLES, ONE BY ONE
WHAT NO ONE SAID
ONE QUESTION TO SIT WITH

Rules:
- WHERE THEY AGREE: two or three sentences on the real common ground, if any. If they
  mostly disagree, say so.
- WHERE THEY PULL APART: name the genuine tension(s) between advisors and what deciding
  between them depends on (a fact the user knows, a value they hold, a risk they can or
  can't live with). Attribute positions to advisors by name.
- THE ANGLES, ONE BY ONE: one or two sentences per advisor, naming each, capturing only
  what that advisor's lens uniquely contributed (not a summary of everything they said).
- WHAT NO ONE SAID: one or two specific considerations none of the advisors raised:
  a person not yet considered, a cost not counted, a question about the facts, a
  different timeframe. Be concrete to this situation, not generic.
- ONE QUESTION TO SIT WITH: exactly one question, the one that would most change the
  user's view if they answered it honestly.
- Under 380 words total. Do not invent anything an advisor did not say; your own
  contribution goes only under WHAT NO ONE SAID and the final question.
- Never give medical, legal, or financial claims. If anyone's safety is at stake, say
  plainly to reach real help first (in the US: 988, or 911 for immediate danger).
`.trim();

interface Row {
  role: "user" | "advisor";
  advisor_id: string | null;
  content: string;
}

export function buildFullCircleTranscript(rows: Row[]): { transcript: string; advisors: string[] } {
  const lines: string[] = [];
  const advisors: string[] = [];
  let lastUser: string | null = null;
  for (const r of rows) {
    if (r.role === "user") {
      const text = r.content.trim();
      if (!text || text === lastUser) continue; // hand-offs repeat the question
      lastUser = text;
      lines.push(`THE USER ASKED: ${text}`);
    } else if (r.advisor_id && r.content.trim()) {
      const persona = getPersona(r.advisor_id);
      const name = persona?.display_name ?? r.advisor_id;
      if (!advisors.includes(r.advisor_id)) advisors.push(r.advisor_id);
      const lens = persona?.lens ? ` (lens: ${persona.lens.looks_at_first})` : "";
      lines.push(`${name.toUpperCase()}${lens} SAID:\n${r.content.trim()}`);
    }
  }
  return { transcript: lines.join("\n\n"), advisors };
}

export async function handleFullCircle(
  admin: Admin,
  userId: string,
  sessionId: string | undefined,
): Promise<Response> {
  if (!sessionId) return errorResponse("session_id is required");

  const { data: session, error: sessionErr } = await admin
    .from("sessions")
    .select("id, user_id, off_record")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) return errorResponse(sessionErr.message, 500);
  if (!session || session.user_id !== userId) return errorResponse("Session not found", 404);

  const { data: rows, error: rowsErr } = await admin
    .from("messages")
    .select("role, advisor_id, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "advisor"])
    .order("created_at", { ascending: true })
    .limit(80);
  if (rowsErr) return errorResponse(rowsErr.message, 500);

  const { transcript, advisors } = buildFullCircleTranscript((rows ?? []) as Row[]);
  if (advisors.length < 2) {
    return errorResponse("Ask at least two advisors first, then come back for the full circle.", 400);
  }

  const prompt: AssembledPrompt = {
    system: [{ type: "text", text: FULL_CIRCLE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `${transcript}\n\nWrite the full circle now.`,
      },
    ],
  };

  const { response, send, close } = createSseStream();
  const run = async () => {
    send("session", { session_id: sessionId, advisor_id: "full_circle", advisors });
    try {
      const result = await streamMessage(prompt, (chunk) => send("delta", { text: chunk }), {
        max_tokens: 900,
      });
      const text = result.text.trim();

      let messageId: string | null = null;
      if (!session.off_record) {
        const { data: inserted, error } = await admin
          .from("messages")
          .insert({
            session_id: sessionId,
            user_id: userId,
            role: "system",
            advisor_id: null,
            content: text,
            display_content: text,
            meta: { kind: "full_circle", advisors, model_usage: result.usage },
          })
          .select("id")
          .single();
        if (error) throw error;
        messageId = inserted.id as string;
      }

      await admin.rpc("increment_usage", {
        p_user_id: userId,
        p_llm_input: result.usage.input_tokens + result.usage.cache_read_input_tokens +
          result.usage.cache_creation_input_tokens,
        p_llm_output: result.usage.output_tokens,
        p_tts_chars: 0,
        p_stt_seconds: 0,
      });

      send("done", {
        message_id: messageId,
        session_id: sessionId,
        headline: null,
        tone: null,
        followup_question: null,
        safety_flag: "none",
        scripture_refs: [],
        advisors,
        usage: result.usage,
      });
    } catch (err) {
      console.error("full circle failed", (err as Error).message);
      send("server_error", { message: "Couldn't draw the full circle just now. Please try again." });
    } finally {
      close();
    }
  };

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(run());
  else run();

  return response;
}

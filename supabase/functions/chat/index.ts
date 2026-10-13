// POST /functions/v1/chat  — text conversation with one advisor (Phase 1).
//
// Request (JSON):
//   { advisor_id: string, message: string, session_id?: string, mode?: "text" | "voice" }
//   or { action: "full_circle", session_id: string }  → 360° synthesis of the session
//   or { action: "tts", advisor_id, text, stranger_archetype_id? } → audio/mpeg (Phase 4)
//
// Response: text/event-stream with events
//   session  {session_id, advisor_id, stranger?: {name, setting}}
//   delta    {text}                      (many; reply text only, metadata withheld)
//   done     {message_id, headline, tone, followup_question, safety_flag, scripture_refs, usage}
//   server_error {message}
//
// Writes: sessions, messages (user + advisor), usage. Uses the service role after
// verifying the caller's JWT, so the app never needs insert policies on these tables.

import { assemblePrompt, META_DELIMITER, splitReplyAndMeta } from "../_shared/prompt-assembler.ts";
import { streamMessage } from "../_shared/anthropic.ts";
import { handleFullCircle } from "../_shared/full-circle.ts";
import { createSseStream, errorResponse, preflight } from "../_shared/http.ts";
import { retrieveMemory, updateMemoryAfterTurn } from "../_shared/memory.ts";
import { handleTts } from "../_shared/tts.ts";
import { CAP_MESSAGE, overMonthlyCap } from "../_shared/usage.ts";
import { adminClient, loadProfile, requireUserId } from "../_shared/supabase.ts";
import { getPersona, getStrangerArchetype, pickStrangerArchetype } from "../_shared/personas/index.ts";
import type { HistoryTurn, Mode, ResponseMeta, SafetyFlag, StrangerArchetype } from "../_shared/types.ts";

interface ChatRequest {
  action?: "full_circle" | "tts";
  text?: string;
  stranger_archetype_id?: string;
  advisor_id?: string;
  message?: string;
  session_id?: string;
  mode?: Mode;
}

const HISTORY_WINDOW = 20;
const MAX_MESSAGE_CHARS = 4000;

function parseMeta(raw: string | null): ResponseMeta {
  if (!raw) return {};
  // Tolerate trailing prose or code fences around the JSON object.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as ResponseMeta;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function normalizeSafety(flag: unknown): SafetyFlag {
  return flag === "crisis" || flag === "elevated" ? flag : "none";
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const userId = await requireUserId(req);
  if (!userId) return errorResponse("Unauthorized", 401);

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (body.action === "full_circle") {
    return handleFullCircle(adminClient(), userId, body.session_id);
  }
  if (body.action === "tts") {
    return handleTts(adminClient(), userId, body);
  }

  const advisorId = (body.advisor_id ?? "").trim();
  const message = (body.message ?? "").trim();
  const mode: Mode = body.mode === "voice" ? "voice" : "text";
  if (!advisorId) return errorResponse("advisor_id is required");
  if (!message) return errorResponse("message is required");
  if (message.length > MAX_MESSAGE_CHARS) return errorResponse("message is too long");

  const persona = getPersona(advisorId);
  if (!persona) return errorResponse(`Unknown advisor: ${advisorId}`, 404);

  const admin = adminClient();
  const profile = await loadProfile(admin, userId);
  if (await overMonthlyCap(admin, userId)) return errorResponse(CAP_MESSAGE, 429);

  // ---- Session: load or create ------------------------------------------------
  let sessionId = body.session_id ?? null;
  let sessionMeta: Record<string, unknown> = {};
  let offRecord = false;

  if (sessionId) {
    const { data: session, error } = await admin
      .from("sessions")
      .select("id, user_id, off_record, meta, advisor_ids")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return errorResponse(error.message, 500);
    if (!session || session.user_id !== userId) return errorResponse("Session not found", 404);
    sessionMeta = (session.meta as Record<string, unknown>) ?? {};
    offRecord = Boolean(session.off_record);
    if (!(session.advisor_ids as string[]).includes(advisorId)) {
      await admin
        .from("sessions")
        .update({ advisor_ids: [...(session.advisor_ids as string[]), advisorId] })
        .eq("id", sessionId);
    }
  } else {
    if (persona.id === "stranger") {
      const archetype = pickStrangerArchetype();
      sessionMeta = { stranger_archetype_id: archetype.id };
    }
    const { data: created, error } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        mode,
        advisor_ids: [advisorId],
        title: message.length > 80 ? message.slice(0, 77) + "..." : message,
        meta: sessionMeta,
      })
      .select("id")
      .single();
    if (error) return errorResponse(error.message, 500);
    sessionId = created.id as string;
  }

  let strangerArchetype: StrangerArchetype | null = null;
  if (persona.id === "stranger") {
    const id = sessionMeta.stranger_archetype_id as string | undefined;
    strangerArchetype = (id && getStrangerArchetype(id)) || pickStrangerArchetype();
  }

  // ---- History (before this message) ----------------------------------------
  const { data: historyRows, error: historyErr } = await admin
    .from("messages")
    .select("role, advisor_id, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "advisor"])
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  if (historyErr) return errorResponse(historyErr.message, 500);

  const history: HistoryTurn[] = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      role: r.role as "user" | "advisor",
      advisor_id: r.advisor_id as string | null,
      // When another advisor spoke earlier in this session, label it so this advisor
      // can reference it naturally (cross-advisor awareness, Section 5.2).
      content:
        r.role === "advisor" && r.advisor_id && r.advisor_id !== advisorId
          ? `[${getPersona(r.advisor_id as string)?.display_name ?? r.advisor_id} said earlier] ${r.content}`
          : (r.content as string),
    }));
  const isFirstTurn = !history.some((t) => t.role === "advisor" && t.advisor_id === advisorId);

  // Hand-off: the user already asked this exact question to another advisor in this
  // session and is now bringing it to this one (one-tap advisor switch in the app).
  // Tell the model so it answers fresh instead of treating it as a repeated question.
  const lastUserTurn = [...history].reverse().find((t) => t.role === "user");
  const previousAnswerers = Array.from(
    new Set(
      history
        .filter((t) => t.role === "advisor" && t.advisor_id && t.advisor_id !== advisorId)
        .map((t) => getPersona(t.advisor_id as string)?.display_name ?? (t.advisor_id as string)),
    ),
  );
  const isHandoff =
    !!lastUserTurn && lastUserTurn.content.trim() === message.trim() && previousAnswerers.length > 0;
  const modelMessage = isHandoff
    ? `${message}\n\n[Note to you: the user already asked this same question to ${previousAnswerers.join(" and ")} in this conversation and is now bringing it to you for a different angle. Do not repeat their advice or their next step; add what your lens sees that they missed: a disagreement with your reasons, a risk, a reframe, or a question they did not ask. Do not remark that the question was repeated.]`
    : message;

  // ---- Persist the user message ----------------------------------------------
  if (!offRecord) {
    const { error } = await admin.from("messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message,
      display_content: message,
    });
    if (error) return errorResponse(error.message, 500);
  }

  // ---- Memory (Phase 3) ------------------------------------------------------
  const memory = await retrieveMemory(admin, profile, sessionId, message, advisorId);

  // ---- Prompt ----------------------------------------------------------------
  const prompt = assemblePrompt({
    persona,
    mode,
    profile,
    memoryContext: memory.context,
    history,
    userMessage: modelMessage,
    strangerArchetype,
    isFirstTurn,
  });

  // ---- Stream ----------------------------------------------------------------
  const { response, send, close } = createSseStream();

  const run = async () => {
    send("session", {
      session_id: sessionId,
      advisor_id: advisorId,
      stranger: strangerArchetype
        ? { id: strangerArchetype.id, name: strangerArchetype.name, setting: strangerArchetype.setting }
        : undefined,
    });

    // Gate that forwards reply text but never leaks the metadata delimiter.
    let pending = "";
    let metaStarted = false;
    const keep = META_DELIMITER.length - 1;
    const forward = (chunk: string) => {
      if (metaStarted) return;
      pending += chunk;
      const idx = pending.indexOf(META_DELIMITER);
      if (idx !== -1) {
        const out = pending.slice(0, idx).trimEnd();
        if (out) send("delta", { text: out });
        pending = "";
        metaStarted = true;
        return;
      }
      if (pending.length > keep) {
        send("delta", { text: pending.slice(0, pending.length - keep) });
        pending = pending.slice(pending.length - keep);
      }
    };

    try {
      const result = await streamMessage(prompt, forward, {
        max_tokens: mode === "voice" ? 800 : 1400, // text only (up-front thinking is off)
      });
      if (!metaStarted && pending) {
        send("delta", { text: pending });
        pending = "";
      }

      const { text, metaRaw } = splitReplyAndMeta(result.text);
      const meta = parseMeta(metaRaw);
      const safety = normalizeSafety(meta.safety_flag);

      let messageId: string | null = null;
      if (!offRecord) {
        const { data: inserted, error } = await admin
          .from("messages")
          .insert({
            session_id: sessionId,
            user_id: userId,
            role: "advisor",
            advisor_id: advisorId,
            content: text,
            display_content: text,
            headline: meta.headline ?? null,
            tone: meta.tone ?? null,
            scripture_refs: meta.scripture_refs ?? [],
            safety_flag: safety,
            meta: {
              followup_question: meta.followup_question ?? null,
              new_facts_candidate: meta.new_facts_candidate ?? [],
              model_usage: result.usage,
              stop_reason: result.stop_reason,
            },
          })
          .select("id")
          .single();
        if (error) throw error;
        messageId = inserted.id as string;

        if (safety !== "none") {
          await admin.from("safety_events").insert({ user_id: userId, category: safety });
        }
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
        headline: meta.headline ?? null,
        tone: meta.tone ?? null,
        followup_question: meta.followup_question ?? null,
        safety_flag: safety,
        scripture_refs: meta.scripture_refs ?? [],
        usage: result.usage,
      });
      close(); // the user has their answer; memory work continues in the background

      try {
        await updateMemoryAfterTurn(admin, {
          profile,
          sessionId: sessionId as string,
          advisorId,
          history,
          userMessage: message,
          advisorReply: text,
          safetyFlag: safety,
          offRecord,
          askedFollowupIds: memory.followupIds,
        });
      } catch (err) {
        console.error("memory update failed", (err as Error).message);
      }
    } catch (err) {
      console.error("chat stream failed", (err as Error).message);
      // Named `server_error` so it never collides with EventSource's built-in `error`.
      send("server_error", { message: "Something went wrong while answering. Please try again." });
    } finally {
      close();
    }
  };

  // Keep the runtime alive until the stream finishes (Supabase Edge Runtime).
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(run());
  else run();

  return response;
});

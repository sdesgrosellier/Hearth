// Streaming client for the `chat` Edge Function (server-sent events over POST).
// react-native-sse works on iOS, Android, and web.

import EventSource from "react-native-sse";

import { FUNCTIONS_URL, SUPABASE_ANON_KEY, supabase } from "./supabase";

export type SafetyFlag = "none" | "elevated" | "crisis";

export interface ChatDone {
  message_id: string | null;
  session_id: string;
  headline: string | null;
  tone: string | null;
  followup_question: string | null;
  safety_flag: SafetyFlag;
  scripture_refs: { ref: string; translation?: string }[];
}

export interface ChatSessionInfo {
  session_id: string;
  advisor_id: string;
  stranger?: { id?: string; name: string; setting: string };
}

export interface ChatStreamHandlers {
  onSession?: (info: ChatSessionInfo) => void;
  onDelta: (text: string) => void;
  onDone: (done: ChatDone) => void;
  onError: (message: string) => void;
}

export interface ChatStreamRequest {
  advisorId: string;
  message: string;
  sessionId?: string | null;
  mode?: "text" | "voice";
}

/** 360° synthesis of everything the advisors said in a session (needs ≥2 advisors). */
export interface FullCircleRequest {
  action: "full_circle";
  sessionId: string;
}

type Events = "session" | "delta" | "done" | "server_error";

/**
 * Opens a streaming chat request. Returns a function that cancels the stream.
 */
export async function streamChat(
  req: ChatStreamRequest | FullCircleRequest,
  handlers: ChatStreamHandlers,
): Promise<() => void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    handlers.onError("You're signed out. Please sign in again.");
    return () => {};
  }

  const es = new EventSource<Events>(`${FUNCTIONS_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(
      "action" in req
        ? { action: req.action, session_id: req.sessionId }
        : {
            advisor_id: req.advisorId,
            message: req.message,
            session_id: req.sessionId ?? undefined,
            mode: req.mode ?? "text",
          },
    ),
    // We never want automatic reconnection: a retry would re-send the message.
    pollingInterval: 0,
    timeout: 90_000,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    es.removeAllEventListeners();
    es.close();
  };

  es.addEventListener("session", (e) => {
    if (e.data) handlers.onSession?.(JSON.parse(e.data) as ChatSessionInfo);
  });
  es.addEventListener("delta", (e) => {
    if (e.data) handlers.onDelta((JSON.parse(e.data) as { text: string }).text);
  });
  es.addEventListener("done", (e) => {
    if (e.data) handlers.onDone(JSON.parse(e.data) as ChatDone);
    finish();
  });
  es.addEventListener("server_error", (e) => {
    const msg = e.data ? (JSON.parse(e.data) as { message?: string }).message : undefined;
    handlers.onError(msg || "Something went wrong. Please try again.");
    finish();
  });
  es.addEventListener("error", (e) => {
    if (finished) return;
    let message = "Connection lost. Please try again.";
    if (e.type === "error") {
      if (e.xhrStatus === 401) message = "Your session expired. Please sign in again.";
      else if (e.xhrStatus === 404) message = "That advisor isn't available.";
      else if (e.xhrStatus === 400) message = "Ask at least two advisors first, then come back for the full circle.";
      else if (e.xhrStatus === 429) message = "You've used this month's beta allowance. It resets on the 1st.";
      else if (e.xhrStatus >= 500) message = "The advisors are busy right now. Try again in a moment.";
      else if (e.message) message = e.message;
    } else if (e.type === "exception" || e.type === "timeout") {
      message = e.type === "timeout" ? "That took too long. Please try again." : e.message;
    }
    handlers.onError(message);
    finish();
  });
  es.addEventListener("close", () => {
    // Server closed without a `done` frame (e.g. a server-side `error` event).
    if (!finished) {
      handlers.onError("The reply was cut off. Please try again.");
      finish();
    }
  });

  return finish;
}

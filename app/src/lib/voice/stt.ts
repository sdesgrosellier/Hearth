// Phase 4 — listening. Uses the browser's built-in speech recognition on web
// (Chrome, Edge, Safari; no account needed). Native uses the platform recognizer in
// the dev build. Firefox has no recognizer; the mic button hides itself there.

import { Platform } from "react-native";

export interface Listener {
  supported: boolean;
  /** Start listening. Resolves when recognition has actually begun. */
  start(): Promise<void>;
  /** Stop listening; a final result (if any) is delivered through onFinal. */
  stop(): void;
  /** Abort without delivering a result. */
  abort(): void;
  listening(): boolean;
}

export interface ListenerHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  lang?: string;
}

// deno-lint-ignore-file no-explicit-any
type AnyWindow = any;

export function recognizerAvailable(): boolean {
  if (Platform.OS !== "web") return false;
  const g = globalThis as AnyWindow;
  return typeof (g.SpeechRecognition ?? g.webkitSpeechRecognition) === "function";
}

export function createListener(handlers: ListenerHandlers): Listener {
  const g = globalThis as AnyWindow;
  const Ctor = Platform.OS === "web" ? g.SpeechRecognition ?? g.webkitSpeechRecognition : undefined;
  const supported = typeof Ctor === "function";
  let rec: AnyWindow = null;
  let active = false;
  let finalText = "";
  let delivered = false;

  const cleanup = () => {
    active = false;
    rec = null;
  };

  return {
    supported,
    listening: () => active,
    async start() {
      if (!supported || active) return;
      finalText = "";
      delivered = false;
      rec = new Ctor();
      rec.lang = handlers.lang ?? "en-US";
      rec.continuous = false; // ends on a natural pause: one question per turn
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (event: AnyWindow) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        handlers.onInterim?.((finalText + " " + interim).trim());
      };
      rec.onerror = (event: AnyWindow) => {
        const code = event?.error as string;
        if (code === "no-speech" || code === "aborted") return; // handled by onend
        const message =
          code === "not-allowed" || code === "service-not-allowed"
            ? "Microphone access was blocked. Allow the mic for this site and try again."
            : code === "network"
            ? "Speech recognition needs an internet connection."
            : `Couldn't hear you (${code}).`;
        handlers.onError?.(message);
      };
      rec.onend = () => {
        const text = finalText.trim();
        cleanup();
        if (text && !delivered) {
          delivered = true;
          handlers.onFinal(text);
        }
        handlers.onEnd?.();
      };
      await new Promise<void>((resolve) => {
        rec.onstart = () => {
          active = true;
          resolve();
        };
        try {
          rec.start();
        } catch (e) {
          cleanup();
          handlers.onError?.((e as Error).message);
          resolve();
        }
      });
    },
    stop() {
      try {
        rec?.stop();
      } catch {
        cleanup();
      }
    },
    abort() {
      delivered = true;
      try {
        rec?.abort();
      } catch {
        // ignore
      }
      cleanup();
    },
  };
}

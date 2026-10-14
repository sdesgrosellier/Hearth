// Phase 4 — advisor voices on the client.
//
// Sentences are queued as they stream in. Each one is synthesized through the
// `tts` action (ElevenLabs, per-advisor voice) and played in order, prefetching the
// next while the current plays. If the server has no voice key (503) or a request
// fails, the queue falls back to the device's built-in speech so the conversation
// still talks. Web only for now; native playback arrives with the dev build.

import { Platform } from "react-native";

import { FUNCTIONS_URL, SUPABASE_ANON_KEY, supabase } from "../supabase";

export interface SpeakOptions {
  advisorId: string;
  strangerArchetypeId?: string | null;
}

export interface Speaker {
  /** True when the platform can play speech at all. */
  supported: boolean;
  /** Queue a sentence. */
  speak(text: string, opts: SpeakOptions): void;
  /** Stop immediately and drop everything queued (barge-in). */
  stop(): void;
  /** Subscribe to speaking/idle changes. Returns an unsubscribe function. */
  onChange(cb: (speaking: boolean) => void): () => void;
  /** Whether we're using the device fallback voice instead of the advisor voices. */
  usingFallback(): boolean;
}

interface Item {
  id: number;
  text: string;
  opts: SpeakOptions;
  audio?: Promise<Blob | null>;
  controller?: AbortController;
}

// Device-voice fallback flavour per advisor (pitch/rate only; it's a stopgap).
const FALLBACK_FLAVOUR: Record<string, { rate: number; pitch: number }> = {
  mom: { rate: 1.0, pitch: 1.15 },
  dad: { rate: 0.92, pitch: 0.8 },
  grandma: { rate: 0.88, pitch: 1.05 },
  grandpa: { rate: 0.85, pitch: 0.75 },
  stranger: { rate: 1.0, pitch: 1.0 },
  kid: { rate: 1.1, pitch: 1.6 },
  alien: { rate: 0.95, pitch: 1.3 },
  caesar: { rate: 0.92, pitch: 0.85 },
  napoleon: { rate: 1.04, pitch: 0.95 },
  washington: { rate: 0.86, pitch: 0.75 },
  lincoln: { rate: 0.9, pitch: 1.0 },
  elder: { rate: 0.82, pitch: 0.7 },
  biblical: { rate: 0.9, pitch: 0.9 },
};

// deno-lint-ignore-file no-explicit-any
type AnyWindow = any;

export function createSpeaker(): Speaker {
  const g = globalThis as AnyWindow;
  const hasAudio = Platform.OS === "web" && typeof g.Audio === "function";
  const hasSynth = Platform.OS === "web" && !!g.speechSynthesis && typeof g.SpeechSynthesisUtterance === "function";
  const supported = hasAudio || hasSynth;

  let queue: Item[] = [];
  let nextId = 1;
  let running = false;
  let fallback = !hasAudio;
  let current: { audio?: AnyWindow; utterance?: AnyWindow } = {};
  let generation = 0; // bumps on stop() so in-flight work knows it was cancelled
  const listeners = new Set<(speaking: boolean) => void>();
  let speaking = false;

  const setSpeaking = (v: boolean) => {
    if (speaking === v) return;
    speaking = v;
    listeners.forEach((cb) => cb(v));
  };

  async function fetchAudio(item: Item): Promise<Blob | null> {
    if (fallback) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    item.controller = new AbortController();
    try {
      const res = await fetch(`${FUNCTIONS_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: "tts",
          advisor_id: item.opts.advisorId,
          text: item.text,
          stranger_archetype_id: item.opts.strangerArchetypeId ?? undefined,
        }),
        signal: item.controller.signal,
      });
      if (res.status === 503) {
        fallback = true; // no voice key on the server yet
        return null;
      }
      if (!res.ok) {
        console.warn("[roundtable] tts failed", res.status);
        return null;
      }
      return await res.blob();
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.warn("[roundtable] tts error", (e as Error).message);
      return null;
    }
  }

  function prefetch() {
    // Keep at most two requests in flight ahead of playback.
    let inFlight = 0;
    for (const item of queue) {
      if (item.audio) {
        inFlight++;
        continue;
      }
      if (inFlight >= 2) break;
      item.audio = fetchAudio(item);
      inFlight++;
    }
  }

  function playBlob(blob: Blob, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const url = g.URL.createObjectURL(blob);
      const audio = new g.Audio(url);
      current.audio = audio;
      const done = () => {
        g.URL.revokeObjectURL(url);
        if (current.audio === audio) current.audio = undefined;
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      if (gen !== generation) return done();
      audio.play().catch(() => done());
    });
  }

  function speakFallback(text: string, advisorId: string, gen: number): Promise<void> {
    return new Promise((resolve) => {
      if (!hasSynth || gen !== generation) return resolve();
      const u = new g.SpeechSynthesisUtterance(text);
      const flavour = FALLBACK_FLAVOUR[advisorId] ?? { rate: 1, pitch: 1 };
      u.rate = flavour.rate;
      u.pitch = flavour.pitch;
      u.lang = "en-US";
      const voices: AnyWindow[] = g.speechSynthesis.getVoices?.() ?? [];
      const en = voices.find((v) => /^en[-_]US/i.test(v.lang) && /natural|premium|enhanced/i.test(v.name)) ??
        voices.find((v) => /^en[-_]US/i.test(v.lang));
      if (en) u.voice = en;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      current.utterance = u;
      g.speechSynthesis.speak(u);
    });
  }

  async function run() {
    if (running) return;
    running = true;
    const gen = generation;
    try {
      while (queue.length && gen === generation) {
        prefetch();
        const item = queue[0];
        setSpeaking(true);
        const blob = await (item.audio ?? fetchAudio(item));
        if (gen !== generation) break;
        if (blob) await playBlob(blob, gen);
        else await speakFallback(item.text, item.opts.advisorId, gen);
        if (gen !== generation) break;
        queue.shift();
      }
    } finally {
      running = false;
      if (!queue.length || gen !== generation) setSpeaking(false);
      if (queue.length && gen === generation) run();
    }
  }

  return {
    supported,
    speak(text, opts) {
      const clean = text.trim();
      if (!supported || !clean) return;
      queue.push({ id: nextId++, text: clean, opts });
      prefetch();
      run();
    },
    stop() {
      generation++;
      for (const item of queue) item.controller?.abort();
      queue = [];
      try {
        current.audio?.pause();
      } catch {
        // ignore
      }
      current = {};
      try {
        g.speechSynthesis?.cancel?.();
      } catch {
        // ignore
      }
      setSpeaking(false);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    usingFallback: () => fallback,
  };
}

/**
 * Splits streamed text into sentences for the speech queue. `push` returns any
 * sentences completed by the new chunk; `flush` returns whatever is left.
 */
export function createSentenceSplitter(minChars = 24) {
  let buffer = "";
  const boundary = /([.!?…]["'”’)\]]?)(\s+)/g;
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const out: string[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      boundary.lastIndex = 0;
      while ((m = boundary.exec(buffer))) {
        const end = m.index + m[1].length;
        const sentence = buffer.slice(last, end).trim();
        // Avoid splitting on "Mr." / "e.g." style abbreviations and tiny fragments.
        if (sentence.length >= minChars && !/\b(?:Mr|Mrs|Ms|Dr|St|vs|e\.g|i\.e)\.$/i.test(sentence)) {
          out.push(sentence);
          last = m.index + m[0].length;
        }
      }
      buffer = buffer.slice(last);
      return out;
    },
    flush(): string[] {
      const rest = buffer.trim();
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}

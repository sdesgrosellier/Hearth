// Phase 4 — text-to-speech through ElevenLabs.
// Invoked through POST /functions/v1/chat with { action: "tts", advisor_id, text, stranger_archetype_id? }.
// Streams audio/mpeg back. Voices are referenced by NAME in the persona JSON
// (tts_settings.voice_name) and resolved against the account's voice list once per
// instance, so swapping a voice is a one-word edit. Without ELEVENLABS_API_KEY the
// endpoint answers 503 and the app falls back to the device's own voice.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { CORS_HEADERS, errorResponse } from "./http.ts";
import { getPersona, getStrangerArchetype } from "./personas/index.ts";
import type { TtsSettings } from "./types.ts";
import { CAP_MESSAGE, overMonthlyCap } from "./usage.ts";

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

const ELEVEN_API = "https://api.elevenlabs.io/v1";
const MAX_TTS_CHARS = 1200;
export const DEFAULT_TTS_MODEL = Deno.env.get("ELEVENLABS_MODEL") ?? "eleven_flash_v2_5";
const OUTPUT_FORMAT = Deno.env.get("ELEVENLABS_OUTPUT_FORMAT") ?? "mp3_44100_64";

function apiKey(): string | null {
  return Deno.env.get("ELEVENLABS_API_KEY") ?? null;
}

// ---------------------------------------------------------------------------
// Voice resolution (name → voice_id), cached per instance
// ---------------------------------------------------------------------------

let voiceCache: { byName: Map<string, string>; first: string | null; at: number } | null = null;

async function loadVoices(key: string): Promise<NonNullable<typeof voiceCache>> {
  if (voiceCache && Date.now() - voiceCache.at < 60 * 60 * 1000) return voiceCache;
  const res = await fetch(`${ELEVEN_API}/voices`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`ElevenLabs voices ${res.status}`);
  const data = (await res.json()) as { voices?: { voice_id: string; name: string }[] };
  const byName = new Map<string, string>();
  for (const v of data.voices ?? []) byName.set(v.name.trim().toLowerCase(), v.voice_id);
  voiceCache = { byName, first: data.voices?.[0]?.voice_id ?? null, at: Date.now() };
  return voiceCache;
}

async function resolveVoiceId(key: string, settings: TtsSettings): Promise<string | null> {
  // An explicit id wins (anything that is not the Phase-1 placeholder).
  if (settings.voice_id && settings.voice_id !== "SET_IN_PHASE_4" && !settings.voice_name) return settings.voice_id;
  const voices = await loadVoices(key);
  const wanted = (settings.voice_name ?? "").trim().toLowerCase();
  if (wanted && voices.byName.has(wanted)) return voices.byName.get(wanted)!;
  if (settings.voice_id && settings.voice_id !== "SET_IN_PHASE_4") return settings.voice_id;
  console.warn(`tts: voice "${settings.voice_name}" not found in account; using first available`);
  return voices.first;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface TtsRequest {
  advisor_id?: string;
  text?: string;
  stranger_archetype_id?: string;
}

export async function handleTts(admin: Admin, userId: string, body: TtsRequest): Promise<Response> {
  const key = apiKey();
  if (!key) {
    return new Response(JSON.stringify({ error: "tts_unconfigured" }), {
      status: 503,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
  const advisorId = (body.advisor_id ?? "").trim();
  const text = (body.text ?? "").replace(/\s+/g, " ").trim();
  if (!advisorId || !text) return errorResponse("advisor_id and text are required");
  if (text.length > MAX_TTS_CHARS) return errorResponse("text is too long for one request");

  const persona = getPersona(advisorId);
  if (!persona) return errorResponse(`Unknown advisor: ${advisorId}`, 404);
  if (await overMonthlyCap(admin, userId)) return errorResponse(CAP_MESSAGE, 429);

  // The Stranger speaks with the archetype's voice when it names one.
  let settings: TtsSettings = { ...persona.tts_settings };
  if (advisorId === "stranger" && body.stranger_archetype_id) {
    const arch = getStrangerArchetype(body.stranger_archetype_id);
    if (arch?.voice_name) settings = { ...settings, voice_name: arch.voice_name, voice_id: undefined as unknown as string };
    if (arch?.speaking_rate) settings.speaking_rate = arch.speaking_rate;
  }

  let voiceId: string | null;
  try {
    voiceId = await resolveVoiceId(key, settings);
  } catch (err) {
    console.error("tts voice lookup failed", (err as Error).message);
    return errorResponse("Voice service unavailable", 502);
  }
  if (!voiceId) return errorResponse("No voices available on the ElevenLabs account", 502);

  const speed = Math.min(Math.max(settings.speaking_rate ?? 1.0, 0.7), 1.2);
  const upstream = await fetch(
    `${ELEVEN_API}/text-to-speech/${voiceId}/stream?output_format=${encodeURIComponent(OUTPUT_FORMAT)}`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: settings.model ?? DEFAULT_TTS_MODEL,
        voice_settings: {
          stability: settings.stability ?? 0.6,
          similarity_boost: settings.similarity_boost ?? 0.75,
          style: settings.style ?? 0.0,
          use_speaker_boost: true,
          speed,
        },
      }),
    },
  );
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("tts upstream failed", upstream.status, detail.slice(0, 300));
    return errorResponse(upstream.status === 401 ? "Voice key rejected" : "Voice service error", 502);
  }

  // Meter characters (ElevenLabs bills per character).
  admin
    .rpc("increment_usage", { p_user_id: userId, p_llm_input: 0, p_llm_output: 0, p_tts_chars: text.length, p_stt_seconds: 0 })
    .then(() => {}, (e: Error) => console.warn("tts usage", e.message));

  return new Response(upstream.body, {
    headers: {
      ...CORS_HEADERS,
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "x-voice-id": voiceId,
    },
  });
}

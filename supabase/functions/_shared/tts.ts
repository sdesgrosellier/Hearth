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
  const raw = (Deno.env.get("ELEVENLABS_API_KEY") ?? "").trim().replace(/^["']|["']$/g, "");
  return raw || null;
}

// ElevenLabs' standard premade voices. Used when the key can't list voices (a key
// restricted to text-to-speech only) so a restricted key still works.
const PREMADE_VOICES: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  aria: "9BWtsMINqrJLrRacOk9x",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlie: "IKne3meq5aSn9XLyUdCD",
  george: "JBFqnCBsd6RMkjVDRZzb",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  river: "SAz9YHcvj6GT2YYXdXww",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  will: "bIHbv24MWmeRgasZH58o",
  jessica: "cgSgspJ2msm6clMCkdW9",
  eric: "cjVigY5qzO86Huf0OWal",
  chris: "iP95p4xoKVk53GoZ742B",
  brian: "nPczCjzI2devNBz1zQrb",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  bill: "pqHfZKP75CvOlQylNhV4",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  adam: "pNInz6obpgDQGcFmaJgB",
};

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
  const wanted = (settings.voice_name ?? "").trim().toLowerCase();
  let voices: NonNullable<typeof voiceCache> | null = null;
  try {
    voices = await loadVoices(key);
  } catch (err) {
    console.warn("tts: could not list voices, using premade ids:", (err as Error).message);
  }
  if (wanted && voices?.byName.has(wanted)) return voices.byName.get(wanted)!;
  if (wanted && PREMADE_VOICES[wanted]) return PREMADE_VOICES[wanted];
  if (settings.voice_id && settings.voice_id !== "SET_IN_PHASE_4") return settings.voice_id;
  console.warn(`tts: voice "${settings.voice_name}" not found; using a default`);
  return voices?.first ?? PREMADE_VOICES.daniel;
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
    const msg = upstream.status === 401
      ? "voice_key_rejected"
      : upstream.status === 402 || /quota|credits/i.test(detail)
      ? "voice_quota_exhausted"
      : "voice_service_error";
    return new Response(JSON.stringify({ error: msg, status: upstream.status }), {
      status: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
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

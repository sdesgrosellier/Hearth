// Shared types for Sounding Board Edge Functions.

export type AdvisorId =
  | "mom"
  | "dad"
  | "grandma"
  | "grandpa"
  | "stranger"
  | "biblical"
  | "kid"
  | "alien"
  | "caesar"
  | "napoleon"
  | "washington"
  | "lincoln"
  | "elder"
  | (string & {}); // custom advisors (Section 2.3) arrive by config

/** Home-screen grouping. */
export type AdvisorCategory = "family" | "fresh" | "history" | "faith";

export type Mode = "text" | "voice" | "panel";

export type SafetyFlag = "none" | "elevated" | "crisis";
export type Tone = "gentle" | "encouraging" | "serious" | "light";

export interface TtsSettings {
  provider: string;
  /** Explicit provider voice id; "SET_IN_PHASE_4" means "resolve voice_name instead". */
  voice_id: string;
  /** Voice looked up by name in the ElevenLabs account (one-word edit to swap). */
  voice_name?: string;
  model?: string;
  speaking_rate?: number;
  stability?: number;
  similarity_boost?: number;
  /** ElevenLabs style exaggeration, 0–1. */
  style?: number;
  style_prompt?: string;
  pause_profile?: string;
}

export interface PersonaConfig {
  id: AdvisorId;
  display_name: string;
  short_label: string;
  category?: AdvisorCategory;
  /** True for openly-labeled dramatizations of real people (adds the HISTORICAL FIGURES note). */
  historical?: boolean;
  /** Left out of the Full circle synthesis (comic voices that would skew it). */
  excluded_from_circle?: boolean;
  avatar: { emoji: string; accent: string; illustration: string };
  age_range: string;
  voice_profile: string;
  core_identity: string;
  values: string[];
  speech_style: string;
  /** What makes this advisor's answer different from every other advisor's. */
  lens?: {
    looks_at_first: string;
    asks: string;
    pushes_back_when: string;
    blind_spot: string;
  };
  signature_moves: string[];
  /** Seeds for invented stories (the Alien); rendered as prompts, never copied verbatim. */
  story_seeds?: string[];
  scripture_rules?: string[];
  avoid: string[];
  example_openers: string[];
  memory_policy: "full" | "none_unless_familiar";
  tts_settings: TtsSettings;
}

export interface StrangerArchetype {
  id: string;
  name: string;
  age: number;
  setting: string;
  background: string;
  style: string;
  voice_hint: string;
  voice_name?: string;
  speaking_rate?: number;
}

/** The user's stored settings (profiles.settings jsonb). Defaults live in the DB migration. */
export interface UserSettings {
  endearments: boolean;
  memory_enabled: boolean;
  cross_advisor_awareness: boolean;
  familiar_stranger: boolean;
  salty_stranger: boolean;
  show_biblical: boolean;
  bible_translation: "WEB" | "KJV";
  offer_prayer: boolean;
  grandparent: "grandma" | "grandpa";
  voice_enabled: boolean;
  speech_rate: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  preferred_address: string | null;
  locale: string;
  timezone: string;
  settings: UserSettings;
  onboarding_completed_at: string | null;
  age_confirmed_at: string | null;
}

export interface HistoryTurn {
  role: "user" | "advisor";
  advisor_id?: string | null;
  content: string;
}

/** Metadata the model returns after the <<<META>>> delimiter (Section 6.4). */
export interface ResponseMeta {
  headline?: string;
  tone?: Tone;
  followup_question?: string;
  scripture_refs?: { ref: string; translation?: string }[];
  new_facts_candidate?: string[];
  safety_flag?: SafetyFlag;
}

export interface AssembledPrompt {
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: { role: "user" | "assistant"; content: string }[];
}

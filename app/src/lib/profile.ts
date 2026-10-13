import { supabase } from "./supabase";

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
  /** Listen again automatically after a spoken reply (Phase 4). */
  voice_autolisten?: boolean;
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

export const DEFAULT_SETTINGS: UserSettings = {
  endearments: true,
  memory_enabled: true,
  cross_advisor_awareness: true,
  familiar_stranger: false,
  salty_stranger: false,
  show_biblical: true,
  bible_translation: "WEB",
  offer_prayer: false,
  grandparent: "grandma",
  voice_enabled: true,
  speech_rate: 1.0,
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, preferred_address, locale, timezone, settings, onboarding_completed_at, age_confirmed_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } } as Profile;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Omit<Profile, "id" | "settings">> & { settings?: Partial<UserSettings> },
  current?: Profile | null,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  if (patch.settings) {
    next.settings = { ...DEFAULT_SETTINGS, ...(current?.settings ?? {}), ...patch.settings };
  }
  const { error } = await supabase.from("profiles").update(next).eq("id", userId);
  if (error) throw error;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

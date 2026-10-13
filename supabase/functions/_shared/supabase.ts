// Supabase clients for Edge Functions.
//  - userClient(req): acts as the caller (RLS enforced). Used to verify identity.
//  - adminClient(): service role (bypasses RLS). Used for writes after the caller
//    is verified, so the client app never needs insert rights on server-owned rows.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Profile, UserSettings } from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the authenticated user's id, or null. */
export async function requireUserId(req: Request): Promise<string | null> {
  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
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

export async function loadProfile(admin: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, preferred_address, locale, timezone, settings, onboarding_completed_at, age_confirmed_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Profile row is normally created by the auth trigger; create defensively.
    const { data: created, error: insertErr } = await admin
      .from("profiles")
      .insert({ id: userId })
      .select()
      .single();
    if (insertErr) throw insertErr;
    return { ...created, settings: { ...DEFAULT_SETTINGS, ...(created.settings ?? {}) } };
  }
  return { ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } } as Profile;
}

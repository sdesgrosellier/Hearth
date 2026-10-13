import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    "[hearth] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.",
  );
}

/**
 * Web storage that never throws. localStorage can be unavailable or throw inside
 * sandboxed frames and private windows; in that case the session lives in memory
 * for the page's lifetime (the user signs in again after a reload).
 */
function createWebStorage(): SupportedStorage {
  const memory = new Map<string, string>();
  const ls = (() => {
    try {
      const s = globalThis.localStorage;
      const probe = "__hearth_probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  })();
  return {
    getItem: (key) => {
      try {
        return ls ? ls.getItem(key) : memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem: (key, value) => {
      memory.set(key, value);
      try {
        ls?.setItem(key, value);
      } catch {
        // keep the in-memory copy
      }
    },
    removeItem: (key) => {
      memory.delete(key);
      try {
        ls?.removeItem(key);
      } catch {
        // nothing to do
      }
    },
  };
}

export const supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "anon", {
  auth: {
    // AsyncStorage per Supabase's Expo guide. Tokens exceed SecureStore's 2 KB limit;
    // a chunked SecureStore adapter is a Phase 7 hardening item.
    storage: Platform.OS === "web" ? createWebStorage() : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens while the app is in the foreground only.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Base URL for Edge Functions, e.g. https://xyz.supabase.co/functions/v1 */
export const FUNCTIONS_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

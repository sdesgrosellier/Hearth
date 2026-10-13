import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchProfile, type Profile } from "./profile";
import { supabase } from "./supabase";

interface AuthState {
  /** undefined while the stored session is being restored. */
  session: Session | null | undefined;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      // The DB trigger creates the row at sign-up; it can lag a moment on first login.
      let p = await fetchProfile(userId);
      if (!p) {
        await new Promise((r) => setTimeout(r, 600));
        p = await fetchProfile(userId);
      }
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    refreshProfile().catch((e) => console.warn("[soundingboard] profile load failed", e?.message));
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, profile, profileLoading, refreshProfile, signOut }),
    [session, profile, profileLoading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

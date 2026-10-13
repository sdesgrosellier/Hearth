import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useTheme } from "@/theme";

/**
 * Route gate:
 *   no session            -> /(auth)/sign-in
 *   session, no onboarding-> /onboarding
 *   otherwise             -> /(app)
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { session, profile, profileLoading, refreshProfile, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  const inAuth = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "onboarding";

  useEffect(() => {
    if (session === undefined) return; // restoring
    if (!session) {
      if (!inAuth) router.replace("/(auth)/sign-in");
      return;
    }
    if (profileLoading || profile === null) return; // wait for the profile row
    const onboarded = Boolean(profile.onboarding_completed_at);
    if (!onboarded && !inOnboarding) router.replace("/onboarding");
    if (onboarded && (inAuth || inOnboarding)) router.replace("/(app)");
  }, [session, profile, profileLoading, inAuth, inOnboarding, router]);

  const restoring = session === undefined;
  const waitingForProfile = Boolean(session) && profile === null && !inAuth;

  if (restoring || (waitingForProfile && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (waitingForProfile) {
    // Signed in but no profile row could be loaded (migration not applied, network down).
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, padding: 24, gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 16, textAlign: "center" }}>
          Couldn't load your profile. Check that the database migration has been applied and you're online.
        </Text>
        <Pressable onPress={() => refreshProfile()} accessibilityRole="button">
          <Text style={{ color: t.primary, fontWeight: "600" }}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => signOut()} accessibilityRole="button">
          <Text style={{ color: t.muted }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <Gate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: t.bg },
              animation: "fade",
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(app)" />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

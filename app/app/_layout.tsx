import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import OnboardingScreen from "@/screens/OnboardingScreen";
import SignInScreen from "@/screens/SignInScreen";
import { useTheme } from "@/theme";

/**
 * Auth gate. Renders sign-in and onboarding directly (no navigation involved), so the
 * flow works the same on native and on any web host regardless of URL. The router only
 * mounts once the user is signed in and onboarded.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { session, profile, profileLoading, refreshProfile, signOut } = useAuth();
  const t = useTheme();

  if (session === undefined) {
    return <Centered><ActivityIndicator color={t.primary} /></Centered>;
  }
  if (!session) return <SignInScreen />;

  if (profile === null) {
    if (profileLoading) {
      return <Centered><ActivityIndicator color={t.primary} /></Centered>;
    }
    // Signed in but no profile row could be loaded (migration not applied, network down).
    return (
      <Centered>
        <Text style={{ color: t.text, fontSize: 16, textAlign: "center" }}>
          Couldn't load your profile. Check that you're online and try again.
        </Text>
        <Pressable onPress={() => refreshProfile()} accessibilityRole="button" style={{ padding: 8 }}>
          <Text style={{ color: t.primary, fontWeight: "600" }}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => signOut()} accessibilityRole="button" style={{ padding: 8 }}>
          <Text style={{ color: t.muted }}>Sign out</Text>
        </Pressable>
      </Centered>
    );
  }

  if (!profile.onboarding_completed_at) return <OnboardingScreen />;

  return <>{children}</>;
}

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, padding: 24, gap: 12 }}>
      {children}
    </View>
  );
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
            <Stack.Screen name="(app)" />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

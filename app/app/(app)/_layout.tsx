import { Stack } from "expo-router";

import { useTheme } from "@/theme";

export default function AppLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[advisorId]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="story" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

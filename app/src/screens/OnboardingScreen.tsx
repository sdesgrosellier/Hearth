// Phase 1 onboarding: AI disclosure, name + address, grandparent pick, 18+ confirm,
// memory toggle. Phase 7 expands this to the full 5-7 step flow.

import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { Body, Button, Card, Heading, Screen, Small, TextField, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { deviceTimezone, updateProfile } from "@/lib/profile";
import { radius, spacing, useTheme } from "@/theme";

export default function OnboardingScreen() {
  const t = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [address, setAddress] = useState(profile?.preferred_address ?? "");
  const [grandparent, setGrandparent] = useState<"grandma" | "grandpa">(profile?.settings.grandparent ?? "grandma");
  const [endearments, setEndearments] = useState(profile?.settings.endearments ?? true);
  const [memory, setMemory] = useState(profile?.settings.memory_enabled ?? true);
  const [isAdult, setIsAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    if (!session) return;
    if (!isAdult) {
      setError("Hearth is for adults 18 and over.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await updateProfile(
        session.user.id,
        {
          display_name: name.trim() || null,
          preferred_address: address.trim() || name.trim() || null,
          timezone: deviceTimezone(),
          onboarding_completed_at: now,
          age_confirmed_at: now,
          settings: { grandparent, endearments, memory_enabled: memory },
        },
        profile,
      );
      await refreshProfile(); // the route gate moves us to the app
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    <View key="welcome" style={{ gap: spacing.lg }}>
      <Text style={{ fontSize: 44 }}>🔥</Text>
      <Title>Welcome to Hearth</Title>
      <Body>
        Ask any personal question and hear it answered by a Mom, a Dad, a Grandma or Grandpa, a random stranger with
        fresh eyes, or counsel from Scripture.
      </Body>
      <Card style={{ gap: spacing.sm }}>
        <Heading>A few honest things first</Heading>
        <Body muted>• Every advisor is an AI character. Not a real person, and never your actual family.</Body>
        <Body muted>• They're not therapists, doctors, lawyers, or financial advisors.</Body>
        <Body muted>• They'll always put your safety first, even over staying in character.</Body>
        <Body muted>• You control what Hearth remembers. You can see, edit, or delete it any time.</Body>
      </Card>
      <Button title="Sounds good" onPress={() => setStep(1)} />
    </View>,

    <View key="you" style={{ gap: spacing.lg }}>
      <Title>What should they call you?</Title>
      <TextField label="Your name (optional)" value={name} onChangeText={setName} placeholder="e.g. Shane" autoCapitalize="words" />
      <TextField
        label="How you'd like to be addressed (optional)"
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. a nickname"
        autoCapitalize="words"
      />
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Heading>Endearments</Heading>
          <Small>“Honey,” “kiddo,” “dear.” Turn off for a plainer tone.</Small>
        </View>
        <Switch value={endearments} onValueChange={setEndearments} trackColor={{ true: t.primary }} />
      </Card>
      <View style={{ gap: spacing.sm }}>
        <Heading>Grandparent</Heading>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["grandma", "grandpa"] as const).map((g) => {
            const selected = grandparent === g;
            return (
              <Pressable
                key={g}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setGrandparent(g)}
                style={{
                  flex: 1,
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: selected ? t.primary : t.card,
                  borderWidth: 1.5,
                  borderColor: selected ? t.primary : t.line,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 28 }}>{g === "grandma" ? "👵" : "👴"}</Text>
                <Text style={{ color: selected ? "#fff" : t.text, fontWeight: "600", marginTop: 4 }}>
                  {g === "grandma" ? "Grandma" : "Grandpa"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Small>You can always talk to either one.</Small>
      </View>
      <Button title="Next" onPress={() => setStep(2)} />
      <Button title="Back" variant="ghost" onPress={() => setStep(0)} />
    </View>,

    <View key="memory" style={{ gap: spacing.lg }}>
      <Title>Memory and age</Title>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Heading>Remember my story</Heading>
          <Small>Advisors recall past conversations so advice builds on your real life. You can review and delete anything.</Small>
        </View>
        <Switch value={memory} onValueChange={setMemory} trackColor={{ true: t.primary }} />
      </Card>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Heading>I'm 18 or older</Heading>
          <Small>Hearth is designed for adults.</Small>
        </View>
        <Switch
          accessibilityLabel="I confirm I am 18 or older"
          value={isAdult}
          onValueChange={setIsAdult}
          trackColor={{ true: t.primary }}
        />
      </Card>
      {error ? <Small style={{ color: t.danger }}>{error}</Small> : null}
      <Button title="Start talking" onPress={finish} loading={busy} disabled={!isAdult} />
      <Button title="Back" variant="ghost" onPress={() => setStep(1)} />
    </View>,
  ];

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Small>Step {step + 1} of {steps.length}</Small>
          {steps[step]}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

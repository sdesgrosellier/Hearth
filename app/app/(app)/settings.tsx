// Minimal settings for Phase 1: name, endearments, memory, Biblical Counsel visibility,
// sign out, delete account. Phase 7 fills in the rest of Section 8 item 10.

import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";

import { Body, Button, Card, Heading, Screen, Small, TextField, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { updateProfile, type UserSettings } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/theme";

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const setSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (!session) return;
    await updateProfile(session.user.id, { settings: { [key]: value } as Partial<UserSettings> }, profile);
    await refreshProfile();
  };

  const saveName = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await updateProfile(session.user.id, { display_name: name.trim() || null }, profile);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes every conversation and everything Round Table remembers about you. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("delete_my_account");
            if (error) {
              Alert.alert("Couldn't delete", error.message);
              return;
            }
            await signOut();
          },
        },
      ],
    );
  };

  const s = profile?.settings;

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Title>Settings</Title>

        <Card style={{ gap: spacing.md }}>
          <TextField label="Your name" value={name} onChangeText={setName} autoCapitalize="words" onBlur={saveName} />
          <Button title="Save" variant="secondary" onPress={saveName} loading={saving} />
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <Row
            title="Endearments"
            detail="Let advisors say “honey,” “kiddo,” “dear.”"
            value={!!s?.endearments}
            onChange={(v) => setSetting("endearments", v)}
          />
          <Row
            title="Remember my story"
            detail="Advisors recall past conversations. Review, edit, or delete anything in My Story."
            value={!!s?.memory_enabled}
            onChange={(v) => setSetting("memory_enabled", v)}
          />
          <Row
            title="Advisors know what the others said"
            detail="Dad can refer to what Mom told you, and vice versa."
            value={!!s?.cross_advisor_awareness}
            onChange={(v) => setSetting("cross_advisor_awareness", v)}
          />
          <Row
            title="Show Biblical Counsel"
            detail="Hide the Scripture advisor if it's not for you."
            value={s?.show_biblical !== false}
            onChange={(v) => setSetting("show_biblical", v)}
          />
          <Row
            title="Voice"
            detail="Show the microphone and let advisors speak their replies."
            value={s?.voice_enabled !== false}
            onChange={(v) => setSetting("voice_enabled", v)}
          />
          <Row
            title="Hands-free conversation"
            detail="After an advisor finishes speaking, start listening again automatically."
            value={!!s?.voice_autolisten}
            onChange={(v) => setSetting("voice_autolisten", v)}
          />
          <Row
            title="Familiar stranger"
            detail="The same stranger becomes a regular who remembers you."
            value={!!s?.familiar_stranger}
            onChange={(v) => setSetting("familiar_stranger", v)}
          />
        </Card>

        <Button title="Open My Story (what the advisors remember)" variant="secondary" onPress={() => router.push("/(app)/story")} />

        <Card style={{ gap: spacing.sm }}>
          <Heading>About the advisors</Heading>
          <Body muted>
            Every advisor is an AI character. They are not real people, not your family, and not licensed
            professionals. In an emergency, call or text 988 (US) or your local emergency number.
          </Body>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button title="Sign out" variant="secondary" onPress={signOut} />
          <Button title="Delete my account and data" variant="ghost" onPress={deleteAccount} />
          <Small style={{ textAlign: "center" }}>Signed in as {session?.user.email}</Small>
        </View>

        <Button title="Done" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

function Row({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Heading>{title}</Heading>
        <Small>{detail}</Small>
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: t.primary }} />
    </View>
  );
}

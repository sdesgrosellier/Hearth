// Home: "What's on your mind?" + advisor chips + recent conversations.
// Phase 1 routes a question to ONE advisor (text chat). Phase 2 adds the multi-select
// Advice Panel; the chip row is already built for it.

import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { AdvisorChip } from "@/components/AdvisorChip";
import { Avatar, Body, Heading, Screen, Small } from "@/components/ui";
import { ADVISORS, getAdvisor, groupAdvisors, type AdvisorId } from "@/config/advisors";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/theme";

interface RecentSession {
  id: string;
  title: string | null;
  advisor_ids: string[];
  started_at: string;
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<AdvisorId>("mom");
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const visibleAdvisors = ADVISORS.filter((a) => (a.id === "biblical" ? profile?.settings.show_biblical !== false : true));

  const loadRecent = useCallback(async () => {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, advisor_ids, started_at")
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(12);
    setRecent((data ?? []) as RecentSession[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [loadRecent]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecent();
    setRefreshing(false);
  };

  const ask = () => {
    const q = question.trim();
    router.push({ pathname: "/(app)/chat/[advisorId]", params: { advisorId: selected, q } });
    setQuestion("");
  };

  const greeting = profile?.preferred_address || profile?.display_name;

  return (
    <Screen>
      <FlatList
        data={recent}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Small>{greeting ? `Hi, ${greeting}.` : "Hi there."}</Small>
                <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, letterSpacing: -0.5 }}>
                  What's on your mind?
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.push("/(app)/settings")}
                hitSlop={12}
              >
                <Text style={{ fontSize: 22 }}>⚙️</Text>
              </Pressable>
            </View>

            <View
              style={{
                backgroundColor: t.card,
                borderRadius: radius.lg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.line,
                padding: spacing.md,
                gap: spacing.md,
              }}
            >
              <TextInput
                accessibilityLabel="Your question"
                value={question}
                onChangeText={setQuestion}
                placeholder="Tell them what's going on…"
                placeholderTextColor={t.muted}
                multiline
                style={{ minHeight: 84, color: t.text, fontSize: 17, lineHeight: 24, textAlignVertical: "top" }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Small>Asking {getAdvisor(selected).name}</Small>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ask ${getAdvisor(selected).name}`}
                  onPress={ask}
                  style={({ pressed }) => ({
                    backgroundColor: getAdvisor(selected).accent,
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: radius.pill,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{question.trim() ? "Ask" : "Just talk"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Heading>Who do you want to hear from?</Heading>
              {groupAdvisors(visibleAdvisors).map((group) => (
                <View key={group.category} style={{ gap: spacing.sm }}>
                  <Small style={{ textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>{group.label}</Small>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {group.advisors.map((a) => (
                      <AdvisorChip key={a.id} advisor={a} selected={selected === a.id} onPress={() => setSelected(a.id)} />
                    ))}
                  </View>
                </View>
              ))}
              <Small>{getAdvisor(selected).tagline}</Small>
            </View>

            <Heading style={{ marginTop: spacing.sm }}>Recent conversations</Heading>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: spacing.xl }}>
            <Body muted>Nothing yet. Ask something above, or just start talking.</Body>
          </View>
        }
        renderItem={({ item }) => {
          const advisor = getAdvisor(item.advisor_ids[item.advisor_ids.length - 1] ?? "mom");
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue conversation with ${advisor.name}: ${item.title ?? "untitled"}`}
              onPress={() =>
                router.push({
                  pathname: "/(app)/chat/[advisorId]",
                  params: { advisorId: advisor.id, sessionId: item.id },
                })
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginHorizontal: spacing.xl,
                marginBottom: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: pressed ? t.cardAlt : t.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.line,
              })}
            >
              <Avatar emoji={advisor.emoji} accent={advisor.accent} size={38} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontWeight: "600" }}>
                  {item.title || "Conversation"}
                </Text>
                <Small>
                  {advisor.name} · {relativeDay(item.started_at)}
                </Small>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

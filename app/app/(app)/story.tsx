// My Story: everything the advisors remember, in the user's hands.
// Facts can be edited or forgotten one by one; conversations show their summaries;
// follow-ups can be dismissed; "Forget everything" clears the lot.

import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Body, Button, Card, Heading, Screen, Small, Title } from "@/components/ui";
import { getAdvisor } from "@/config/advisors";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/theme";

type Category = "people" | "ongoing_situations" | "goals_and_values" | "preferences" | "upcoming_events" | "outcomes";

interface Fact {
  id: string;
  category: Category;
  content: string;
  event_date: string | null;
  status: "open" | "resolved" | "archived";
  created_at: string;
}

interface SessionRow {
  id: string;
  title: string | null;
  advisor_ids: string[];
  started_at: string;
  summary: string | null;
}

interface Followup {
  id: string;
  question: string | null;
  advisor_id: string | null;
  due_at: string;
  status: "pending" | "asked" | "done" | "dismissed";
}

const CATEGORY_ORDER: Category[] = ["people", "ongoing_situations", "upcoming_events", "goals_and_values", "preferences", "outcomes"];
const CATEGORY_LABEL: Record<Category, string> = {
  people: "People in your life",
  ongoing_situations: "What's going on",
  upcoming_events: "Coming up",
  goals_and_values: "Goals and values",
  preferences: "Preferences",
  outcomes: "How things turned out",
};

function confirm(title: string, message: string, onYes: () => void, yesLabel = "Forget") {
  if (Platform.OS === "web") {
    const ask = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
    if (!ask || ask(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: yesLabel, style: "destructive", onPress: onYes },
  ]);
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MyStory() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [f, s, u] = await Promise.all([
      supabase
        .from("memory_facts")
        .select("id, category, content, event_date, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("sessions")
        .select("id, title, advisor_ids, started_at, summary")
        .is("deleted_at", null)
        .not("summary", "is", null)
        .order("started_at", { ascending: false })
        .limit(30),
      supabase
        .from("followups")
        .select("id, question, advisor_id, due_at, status")
        .in("status", ["pending", "asked"])
        .order("due_at", { ascending: true })
        .limit(10),
    ]);
    setFacts((f.data ?? []) as Fact[]);
    setSessions((s.data ?? []) as SessionRow[]);
    setFollowups((u.data ?? []) as Followup[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const forgetFact = (fact: Fact) =>
    confirm("Forget this?", `"${fact.content}" will be removed from what the advisors remember.`, async () => {
      await supabase.from("memory_facts").update({ deleted_at: new Date().toISOString() }).eq("id", fact.id);
      setFacts((prev) => prev.filter((f) => f.id !== fact.id));
    });

  const saveEdit = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    await supabase.from("memory_facts").update({ content: text, embedding: null }).eq("id", editing.id);
    setFacts((prev) => prev.map((f) => (f.id === editing.id ? { ...f, content: text } : f)));
    setEditing(null);
  };

  const toggleResolved = async (fact: Fact) => {
    const status = fact.status === "resolved" ? "open" : "resolved";
    await supabase.from("memory_facts").update({ status }).eq("id", fact.id);
    setFacts((prev) => prev.map((f) => (f.id === fact.id ? { ...f, status } : f)));
  };

  const dismissFollowup = async (fu: Followup) => {
    await supabase.from("followups").update({ status: "dismissed" }).eq("id", fu.id);
    setFollowups((prev) => prev.filter((f) => f.id !== fu.id));
  };

  const forgetConversation = (s: SessionRow) =>
    confirm("Forget this conversation's summary?", "The messages stay; the advisors just won't recall this one.", async () => {
      await supabase.from("sessions").update({ summary: null, summary_embedding: null }).eq("id", s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    });

  const forgetEverything = () =>
    confirm(
      "Forget everything?",
      "Every remembered fact, conversation summary, and follow-up will be cleared. Your conversations themselves stay.",
      async () => {
        const now = new Date().toISOString();
        await Promise.all([
          supabase.from("memory_facts").update({ deleted_at: now }).is("deleted_at", null),
          supabase.from("sessions").update({ summary: null, summary_embedding: null }).not("summary", "is", null),
          supabase.from("followups").update({ status: "dismissed" }).in("status", ["pending", "asked"]),
        ]);
        await load();
      },
      "Forget everything",
    );

  const grouped = CATEGORY_ORDER.map((c) => ({ c, items: facts.filter((f) => f.category === c) })).filter((g) => g.items.length);
  const memoryOff = profile?.settings.memory_enabled === false;

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 22, color: t.text }}>‹</Text>
          </Pressable>
          <Title>My Story</Title>
        </View>
        <Body muted>
          This is everything the advisors remember about you, in your own words. Edit anything, forget anything.
          {memoryOff ? " Memory is currently off in Settings, so nothing new is being added." : ""}
        </Body>

        {followups.length ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>They'll ask you about</Heading>
            {followups.map((fu) => (
              <View key={fu.id} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Body>{fu.question}</Body>
                  <Small>
                    {fu.advisor_id ? getAdvisor(fu.advisor_id).name : "An advisor"} · {fu.status === "asked" ? "asked" : `from ${day(fu.due_at)}`}
                  </Small>
                </View>
                <Pressable accessibilityRole="button" onPress={() => dismissFollowup(fu)} hitSlop={8}>
                  <Small style={{ color: t.primary, fontWeight: "600" }}>Dismiss</Small>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        {grouped.length === 0 && !loading ? (
          <Card>
            <Body muted>Nothing remembered yet. After a conversation or two, the things you share will show up here.</Body>
          </Card>
        ) : null}

        {grouped.map((g) => (
          <Card key={g.c} style={{ gap: spacing.sm }}>
            <Heading>{CATEGORY_LABEL[g.c]}</Heading>
            {g.items.map((fact) => (
              <View
                key={fact.id}
                style={{
                  gap: 6,
                  paddingVertical: spacing.sm,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: t.line,
                }}
              >
                {editing?.id === fact.id ? (
                  <View style={{ gap: spacing.sm }}>
                    <TextInput
                      accessibilityLabel="Edit this memory"
                      value={editing.text}
                      onChangeText={(text) => setEditing({ id: fact.id, text })}
                      multiline
                      autoFocus
                      style={{
                        color: t.text,
                        fontSize: 16,
                        lineHeight: 22,
                        backgroundColor: t.cardAlt,
                        borderRadius: radius.md,
                        padding: spacing.sm,
                        minHeight: 48,
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: spacing.md }}>
                      <Pressable accessibilityRole="button" onPress={saveEdit}>
                        <Small style={{ color: t.primary, fontWeight: "700" }}>Save</Small>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setEditing(null)}>
                        <Small>Cancel</Small>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Body style={fact.status === "resolved" ? { color: t.muted, textDecorationLine: "line-through" } : undefined}>
                      {fact.content}
                    </Body>
                    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
                      <Small>{fact.event_date ? `on ${fact.event_date}` : `shared ${day(fact.created_at)}`}</Small>
                      <Pressable accessibilityRole="button" onPress={() => setEditing({ id: fact.id, text: fact.content })}>
                        <Small style={{ color: t.primary, fontWeight: "600" }}>Edit</Small>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => toggleResolved(fact)}>
                        <Small style={{ color: t.primary, fontWeight: "600" }}>
                          {fact.status === "resolved" ? "Still true" : "No longer true"}
                        </Small>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => forgetFact(fact)}>
                        <Small style={{ color: t.danger, fontWeight: "600" }}>Forget</Small>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
          </Card>
        ))}

        {sessions.length ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Conversations they remember</Heading>
            {sessions.map((s) => (
              <View key={s.id} style={{ gap: 4, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
                <Small>
                  {day(s.started_at)} · {(s.advisor_ids ?? []).map((id) => getAdvisor(id).name).join(", ")}
                </Small>
                <Body>{s.summary}</Body>
                <Pressable accessibilityRole="button" onPress={() => forgetConversation(s)} style={{ alignSelf: "flex-start" }}>
                  <Small style={{ color: t.danger, fontWeight: "600" }}>Forget this one</Small>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Button title="Forget everything" variant="ghost" onPress={forgetEverything} />
      </ScrollView>
    </Screen>
  );
}

// Text conversation with one advisor. Streams replies from the `chat` Edge Function.
// Phase 4 layers the voice call UI on top of this same session model.

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdvisorChip } from "@/components/AdvisorChip";
import { Composer } from "@/components/Composer";
import { MessageBubble, type ChatMessage } from "@/components/MessageBubble";
import { Avatar, Body, Card, Heading, Screen, Small } from "@/components/ui";
import { ADVISORS, getAdvisor, type AdvisorId } from "@/config/advisors";
import { crisisResourcesFor } from "@/constants/crisis";
import { useAuth } from "@/lib/auth-context";
import { streamChat } from "@/lib/chat-stream";
import { supabase } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/theme";

let localId = 0;
const nextId = () => `local-${Date.now()}-${localId++}`;

export default function ChatScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ advisorId: string; q?: string; sessionId?: string }>();
  // The advisor currently answering. Starts from the route, changes when the user taps
  // another advisor in the switcher (same session, same question).
  const [activeAdvisorId, setActiveAdvisorId] = useState<AdvisorId>(getAdvisor(params.advisorId).id);
  const advisor = getAdvisor(activeAdvisorId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(params.sessionId ?? null);
  const [strangerIntro, setStrangerIntro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(params.sessionId));

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const autoSentRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Resume an existing session.
  useEffect(() => {
    if (!params.sessionId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, display_content, safety_flag, advisor_id")
        .eq("session_id", params.sessionId)
        .in("role", ["user", "advisor"])
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setMessages(
        (data ?? []).map((m) => ({
          id: m.id as string,
          role: m.role as "user" | "advisor",
          text: (m.display_content as string) ?? (m.content as string),
          safety_flag: m.safety_flag as ChatMessage["safety_flag"],
          advisor_id: (m.advisor_id as string | null) ?? undefined,
        })),
      );
      setLoadingHistory(false);
      scrollToEnd();
    })();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, scrollToEnd]);

  const send = useCallback(
    async (text: string, toAdvisorId: AdvisorId = activeAdvisorId) => {
      if (busy) return;
      setError(null);
      setBusy(true);
      const userMsg: ChatMessage = { id: nextId(), role: "user", text };
      const advisorMsg: ChatMessage = {
        id: nextId(),
        role: "advisor",
        text: "",
        pending: true,
        advisor_id: toAdvisorId,
      };
      setMessages((prev) => [...prev, userMsg, advisorMsg]);
      scrollToEnd();

      cancelRef.current = await streamChat(
        { advisorId: toAdvisorId, message: text, sessionId, mode: "text" },
        {
          onSession: (info) => {
            setSessionId(info.session_id);
            if (info.stranger) setStrangerIntro(`${info.stranger.name}, ${info.stranger.setting}`);
          },
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === advisorMsg.id ? { ...m, text: m.text + chunk } : m)),
            );
            scrollToEnd();
          },
          onDone: (done) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === advisorMsg.id
                  ? { ...m, id: done.message_id ?? m.id, pending: false, safety_flag: done.safety_flag }
                  : m,
              ),
            );
            if (done.safety_flag === "crisis") setShowHelp(true);
            setBusy(false);
            cancelRef.current = null;
          },
          onError: (message) => {
            // Keep whatever partial reply arrived; drop an empty placeholder bubble.
            setMessages((prev) =>
              prev
                .map((m) => (m.id === advisorMsg.id ? { ...m, pending: false } : m))
                .filter((m) => !(m.id === advisorMsg.id && !m.text)),
            );
            setError(message);
            setBusy(false);
            cancelRef.current = null;
          },
        },
      );
    },
    [activeAdvisorId, busy, scrollToEnd, sessionId],
  );

  // The question currently on the table: the most recent thing the user said.
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.text ?? null;
  const hasAnswer = messages.some((m) => m.role === "advisor" && !m.pending && m.text);

  // One tap: the same question goes to another advisor in this same conversation.
  const askAnother = useCallback(
    (id: AdvisorId) => {
      if (busy || id === activeAdvisorId) return;
      setActiveAdvisorId(id);
      setStrangerIntro(null);
      if (lastQuestion) send(lastQuestion, id);
    },
    [activeAdvisorId, busy, lastQuestion, send],
  );

  const switchable = ADVISORS.filter((a) => (a.id === "biblical" ? profile?.settings.show_biblical !== false : true));

  // Auto-send the question typed on the Home screen.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (params.q && params.q.trim() && !params.sessionId) {
      autoSentRef.current = true;
      send(params.q.trim());
    }
  }, [params.q, params.sessionId, send]);

  useEffect(() => () => cancelRef.current?.(), []);

  const resources = crisisResourcesFor(profile?.locale ?? "en-US");
  const multiAdvisor = new Set(messages.filter((m) => m.role === "advisor").map((m) => m.advisor_id ?? advisor.id)).size > 1;

  return (
    <Screen edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: t.line,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 22, color: t.text }}>‹</Text>
          </Pressable>
          <Avatar emoji={advisor.emoji} accent={advisor.accent} size={40} />
          <View style={{ flex: 1 }}>
            <Heading>{advisor.name}</Heading>
            <Small>{strangerIntro ?? advisor.presence}</Small>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I need help now"
            onPress={() => setShowHelp((v) => !v)}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: t.cardAlt }}
          >
            <Small muted={false}>Need help now?</Small>
          </Pressable>
        </View>

        {showHelp ? (
          <Card style={{ margin: spacing.lg, gap: spacing.sm, borderColor: t.primary }}>
            <Heading>You don't have to carry this alone.</Heading>
            {resources.map((r) => (
              <Pressable
                key={r.label}
                accessibilityRole={r.url ? "link" : "text"}
                onPress={r.url ? () => Linking.openURL(r.url!) : undefined}
                style={{ paddingVertical: 4 }}
              >
                <Body style={{ fontWeight: "600", color: r.url ? t.primary : t.text }}>{r.label}</Body>
                <Small>{r.detail}</Small>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setShowHelp(false)} style={{ alignSelf: "flex-end" }}>
              <Small>Close</Small>
            </Pressable>
          </Card>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            // A repeated question (hand-off to another advisor) renders as a compact marker.
            if (item.role === "user" && index > 0) {
              const prevUser = messages.slice(0, index).reverse().find((m) => m.role === "user");
              const next = messages[index + 1];
              if (prevUser && prevUser.text === item.text && next?.role === "advisor") {
                const to = getAdvisor(next.advisor_id ?? advisor.id);
                return (
                  <View style={{ alignItems: "center", marginVertical: 8 }}>
                    <Small>Same question → {to.name}</Small>
                  </View>
                );
              }
            }
            return (
              <MessageBubble
                message={item}
                advisor={getAdvisor(item.advisor_id ?? advisor.id)}
                showName={multiAdvisor}
              />
            );
          }}
          contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loadingHistory ? null : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm }}>
                <Avatar emoji={advisor.emoji} accent={advisor.accent} size={72} />
                <Heading>{advisor.name}</Heading>
                <Body muted style={{ textAlign: "center" }}>
                  {advisor.tagline} Say what's going on, in your own words.
                </Body>
                {advisor.disclosure ? (
                  <Small style={{ textAlign: "center", marginTop: spacing.sm }}>{advisor.disclosure}</Small>
                ) : null}
              </View>
            )
          }
        />

        {error ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Small style={{ color: t.danger }}>{error}</Small>
          </View>
        ) : null}

        {hasAnswer && lastQuestion ? (
          <View style={{ gap: 6, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
            <Small style={{ paddingHorizontal: spacing.lg }}>
              {busy ? `${advisor.name} is answering…` : "Hear from someone else on this — tap a name:"}
            </Small>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 4 }}
            >
              {switchable.map((a) => (
                <AdvisorChip
                  key={a.id}
                  advisor={a}
                  selected={a.id === advisor.id}
                  compact
                  onPress={() => askAnother(a.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Composer accent={advisor.accent} onSend={(text) => send(text)} disabled={busy} placeholder={`Talk to ${advisor.name}…`} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

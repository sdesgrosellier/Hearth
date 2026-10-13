import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { type AdvisorMeta } from "@/config/advisors";
import { radius, spacing, type as typeScale, useTheme } from "@/theme";

import { Avatar } from "./ui";

export interface ChatMessage {
  id: string;
  role: "user" | "advisor";
  text: string;
  pending?: boolean;
  safety_flag?: "none" | "elevated" | "crisis";
}

export function MessageBubble({ message, advisor }: { message: ChatMessage; advisor: AdvisorMeta }) {
  const t = useTheme();
  const mine = message.role === "user";

  if (mine) {
    return (
      <View style={[styles.row, { justifyContent: "flex-end" }]}>
        <View
          accessibilityLabel={`You said: ${message.text}`}
          style={[
            styles.bubble,
            { backgroundColor: t.bubbleUser, borderBottomRightRadius: 6, maxWidth: "82%" },
          ]}
        >
          <Text style={[typeScale.body, { color: t.bubbleUserText }]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { alignItems: "flex-end", gap: spacing.sm }]}>
      <Avatar emoji={advisor.emoji} accent={advisor.accent} size={32} />
      <View
        accessibilityLabel={`${advisor.name} said: ${message.text}`}
        style={[
          styles.bubble,
          {
            backgroundColor: t.card,
            borderBottomLeftRadius: 6,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
            maxWidth: "84%",
          },
        ]}
      >
        {message.text || !message.pending ? (
          <Text style={[typeScale.body, { color: t.text }]}>
            {message.text}
            {message.pending ? <Text style={{ color: advisor.accent }}> ▍</Text> : null}
          </Text>
        ) : (
          <Text style={[typeScale.body, { color: t.muted, fontStyle: "italic" }]}>
            {advisor.name} is thinking…
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: spacing.lg, marginVertical: 6 },
  bubble: { borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 16 },
});

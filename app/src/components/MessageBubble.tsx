import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { type AdvisorMeta } from "@/config/advisors";
import { radius, spacing, type as typeScale, useTheme } from "@/theme";

import { Avatar } from "./ui";

export interface ChatMessage {
  id: string;
  role: "user" | "advisor" | "full_circle";
  text: string;
  pending?: boolean;
  safety_flag?: "none" | "elevated" | "crisis";
  /** Which advisor said it (advisor messages only). */
  advisor_id?: string;
  /** Advisors covered (full_circle messages only). */
  advisors?: string[];
  /** Advisors deliberately left out of the circle (full_circle messages only). */
  excluded?: string[];
}

const SECTION_LABELS = [
  "WHERE THEY AGREE",
  "WHERE THEY PULL APART",
  "THE ANGLES, ONE BY ONE",
  "WHAT NO ONE SAID",
  "ONE QUESTION TO SIT WITH",
];

/** The 360° synthesis card. Section labels in the text become headings. */
export function FullCircleCard({
  message,
  advisorNames,
  satOutNames = [],
}: {
  message: ChatMessage;
  advisorNames: string[];
  satOutNames?: string[];
}) {
  const t = useTheme();
  const blocks = message.text.split(/\n+/).filter((l) => l.trim().length > 0);
  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg }]}>
      <View
        accessibilityLabel={`Full circle: ${message.text}`}
        style={{
          flex: 1,
          backgroundColor: t.cardAlt,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: t.primary,
          paddingVertical: 14,
          paddingHorizontal: 16,
          gap: 6,
        }}
      >
        <Text style={{ color: t.primary, fontWeight: "700", fontSize: 13, letterSpacing: 0.6 }}>
          ◎ FULL CIRCLE
        </Text>
        {advisorNames.length ? (
          <Text style={[typeScale.small, { color: t.muted, marginBottom: 4 }]}>
            {advisorNames.join(" · ")}
            {satOutNames.length ? `   (${satOutNames.join(", ")} sat this one out)` : ""}
          </Text>
        ) : null}
        {blocks.length === 0 && message.pending ? (
          <Text style={[typeScale.body, { color: t.muted, fontStyle: "italic" }]}>Drawing the circle…</Text>
        ) : null}
        {blocks.map((line, i) => {
          const label = line.trim().toUpperCase();
          const isHeading = SECTION_LABELS.includes(label);
          return (
            <Text
              key={i}
              style={
                isHeading
                  ? { color: t.text, fontWeight: "700", fontSize: 13, letterSpacing: 0.6, marginTop: i === 0 ? 0 : 10 }
                  : [typeScale.body, { color: t.text }]
              }
            >
              {isHeading ? label : line}
              {message.pending && i === blocks.length - 1 ? <Text style={{ color: t.primary }}> ▍</Text> : null}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function MessageBubble({
  message,
  advisor,
  showName = false,
}: {
  message: ChatMessage;
  advisor: AdvisorMeta;
  /** Label the bubble with the advisor's name (used when several advisors share a thread). */
  showName?: boolean;
}) {
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
        {showName ? (
          <Text style={{ color: advisor.accent, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>{advisor.name}</Text>
        ) : null}
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

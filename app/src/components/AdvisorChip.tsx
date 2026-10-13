import React from "react";
import { Pressable, Text, View } from "react-native";

import { type AdvisorMeta } from "@/config/advisors";
import { radius, spacing, useTheme } from "@/theme";

export function AdvisorChip({
  advisor,
  selected,
  onPress,
  compact = false,
}: {
  advisor: AdvisorMeta;
  selected?: boolean;
  onPress: () => void;
  /** Smaller chip for horizontal switcher rows. */
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${advisor.name}. ${advisor.tagline}`}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: compact ? 6 : 10,
        paddingHorizontal: compact ? spacing.md : spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: selected ? advisor.accent : t.card,
        borderWidth: 1.5,
        borderColor: selected ? advisor.accent : t.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: compact ? 16 : 18 }}>{advisor.emoji}</Text>
      <View>
        <Text style={{ color: selected ? "#fff" : t.text, fontWeight: "600", fontSize: compact ? 14 : 15 }}>{advisor.name}</Text>
      </View>
    </Pressable>
  );
}

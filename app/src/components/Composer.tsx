import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { radius, spacing, useTheme } from "@/theme";

import { SendIcon } from "./Icons";

export function Composer({
  onSend,
  disabled,
  placeholder = "Say what's on your mind…",
  accent,
  leading,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  accent: string;
  /** Rendered before the input (the microphone button). */
  leading?: React.ReactNode;
}) {
  const t = useTheme();
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.line,
        backgroundColor: t.bg,
      }}
    >
      {leading}
      <TextInput
        accessibilityLabel="Message"
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        multiline
        maxLength={4000}
        editable={!disabled}
        returnKeyType="default"
        style={{
          flex: 1,
          minHeight: 46,
          maxHeight: 140,
          backgroundColor: t.inputBg,
          color: t.text,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          paddingHorizontal: spacing.lg,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: 16,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={submit}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: canSend ? accent : t.line,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <SendIcon size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

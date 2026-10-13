// Small, shared UI primitives in the Sounding Board style.

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { radius, spacing, type as typeScale, useTheme } from "@/theme";

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[typeScale.display, { color: t.text }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[typeScale.heading, { color: t.text }, style]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return <Text style={[typeScale.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Small({
  children,
  muted = true,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return <Text style={[typeScale.small, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", loading, disabled, style, ...rest }: ButtonProps) {
  const t = useTheme();
  const bg = variant === "primary" ? t.primary : variant === "secondary" ? t.cardAlt : "transparent";
  const fg = variant === "primary" ? t.primaryText : t.text;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          minHeight: 48,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: "600" }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Small>{label}</Small> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[
          {
            backgroundColor: t.inputBg,
            color: t.text,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Avatar({ emoji, accent, size = 44 }: { emoji: string; accent: string; size?: number }) {
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent + "26",
        borderWidth: 2,
        borderColor: accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

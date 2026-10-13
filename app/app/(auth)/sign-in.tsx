import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { Body, Button, Screen, Small, TextField, Title } from "@/components/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/theme";

type Step = "email" | "code";

export default function SignIn() {
  const t = useTheme();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("code");
  };

  const verify = async () => {
    const token = code.replace(/\s/g, "");
    if (token.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setBusy(false);
    if (err) setError(err.message === "Token has expired or is invalid" ? "That code didn't work. Check it and try again, or request a new one." : err.message);
    // On success the auth listener in AuthProvider routes onward.
  };

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 44 }}>🔥</Text>
            <Title>Hearth</Title>
            <Body muted>Advice from the voices you trust. Mom, Dad, a grandparent, a stranger, or Scripture.</Body>
          </View>

          {!isSupabaseConfigured ? (
            <Body style={{ color: t.danger }}>
              Supabase isn't configured. Copy app/.env.example to app/.env and restart.
            </Body>
          ) : null}

          {step === "email" ? (
            <>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                onSubmitEditing={sendCode}
                returnKeyType="send"
              />
              {error ? <Small style={{ color: t.danger }}>{error}</Small> : null}
              <Button title="Send me a sign-in code" onPress={sendCode} loading={busy} disabled={!isSupabaseConfigured} />
              <Small>No password. We'll email you a 6-digit code.</Small>
            </>
          ) : (
            <>
              <Body>
                We sent a code to <Text style={{ fontWeight: "600" }}>{email.trim()}</Text>.
              </Body>
              <TextField
                label="6-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={8}
                onSubmitEditing={verify}
                returnKeyType="done"
              />
              {error ? <Small style={{ color: t.danger }}>{error}</Small> : null}
              <Button title="Sign in" onPress={verify} loading={busy} />
              <Button
                title="Use a different email"
                variant="ghost"
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              />
            </>
          )}

          <Small style={{ marginTop: spacing.xl }}>
            Hearth's advisors are AI characters, not real people and not licensed professionals. For 18+.
            If you're in crisis, call or text 988 (US) or your local emergency number.
          </Small>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

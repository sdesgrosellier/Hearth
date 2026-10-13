// Email + password sign-in / sign-up. Email confirmation is off during the private beta,
// so a new account is usable immediately. Phase 7 adds Sign in with Apple / Google and
// turns confirmation back on behind a custom email sender.

import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { Body, Button, Screen, Small, TextField, Title } from "@/components/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/theme";

type Mode = "signin" | "signup";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function friendlyAuthError(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return mode === "signin"
      ? "That email and password don't match. If you're new here, tap \"Create one\" below."
      : "Couldn't sign in with those details.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "There's already an account with that email. Switch to Sign in.";
  }
  if (m.includes("password should be") || m.includes("password is too short")) {
    return "Please use a password of at least 6 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Give it a minute and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "This account needs its email confirmed. Check your inbox for the link.";
  }
  if (m.includes("database error saving new user") || m.includes("invite_code_invalid")) {
    return "That invite code isn't valid (or has been used up). Sounding Board is in a private beta; ask Shane for a code.";
  }
  return message;
}

export default function SignInScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      return;
    }
    if (mode === "signup" && !inviteCode.trim()) {
      setError("Enter your invite code. Sounding Board is in a private beta.");
      return;
    }
    setBusy(true);
    setError(null);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: addr, password })
        : await supabase.auth.signUp({
            email: addr,
            password,
            options: { data: { invite_code: inviteCode.trim().toUpperCase() } },
          });
    setBusy(false);
    if (result.error) {
      setError(friendlyAuthError(result.error.message, mode));
      return;
    }
    if (mode === "signup" && !result.data.session) {
      // Email confirmation is on for this project: tell the user what to do.
      setError("Account created. Check your email for a confirmation link, then sign in.");
      setMode("signin");
    }
    // On success the auth listener in AuthProvider routes onward.
  };

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.lg, maxWidth: 520, width: "100%", alignSelf: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 44 }}>💬</Text>
            <Title>Sounding Board</Title>
            <Body muted>
              One question, many voices: family, a stranger, a kid, an alien, figures from history, and Scripture.
              Then see the full circle.
            </Body>
          </View>

          {!isSupabaseConfigured ? (
            <Body style={{ color: t.danger }}>
              Supabase isn't configured. Copy app/.env.example to app/.env and restart.
            </Body>
          ) : null}

          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", backgroundColor: t.cardAlt, borderRadius: radius.pill, padding: 4 }}
          >
            {(["signin", "signup"] as Mode[]).map((m) => {
              const selected = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.pill,
                    backgroundColor: selected ? t.card : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: selected ? "700" : "500" }}>
                    {m === "signin" ? "Sign in" : "Create account"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            textContentType={mode === "signup" ? "newPassword" : "password"}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            onSubmitEditing={mode === "signin" ? submit : undefined}
            returnKeyType={mode === "signin" ? "go" : "next"}
          />
          {mode === "signup" ? (
            <TextField
              label="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="From Shane"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          ) : null}
          {error ? <Small style={{ color: t.danger }}>{error}</Small> : null}
          <Button
            title={mode === "signin" ? "Sign in" : "Create my account"}
            onPress={submit}
            loading={busy}
            disabled={!isSupabaseConfigured}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            style={{ alignSelf: "center", padding: spacing.sm }}
          >
            <Small>
              {mode === "signin" ? "New to Sounding Board? " : "Already have an account? "}
              <Text style={{ color: t.primary, fontWeight: "600" }}>
                {mode === "signin" ? "Create one" : "Sign in"}
              </Text>
            </Small>
          </Pressable>

          <Small style={{ marginTop: spacing.xl }}>
            Sounding Board's advisors are AI characters, not real people and not licensed professionals. For 18+.
            If you're in crisis, call or text 988 (US) or your local emergency number.
          </Small>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

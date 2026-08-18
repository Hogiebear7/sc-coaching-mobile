import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Color, Spacing } from "@/constants/theme";
import { apiFetch, ApiError } from "@/lib/api-client";

// Mirrors the web app's /forgot-password page exactly — same route
// (POST /api/auth/forgot-password), same always-generic response copy so
// this never leaks whether an email has an account, same 3-per-15-min rate
// limit enforced server-side.
const GENERIC_MESSAGE = "If an account exists for that email, a password reset link has been sent.";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your account email.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
        skipAuth: true,
      });
      setSubmitted(true);
    } catch (e) {
      // The route itself never returns a non-generic error except rate
      // limiting / malformed input — surface those, otherwise still show
      // the generic success state rather than leak anything.
      if (e instanceof ApiError && e.status === 429) {
        setError(e.message);
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>

          <Text style={styles.eyebrow}>ACCOUNT ACCESS</Text>
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>Enter your account email and we&apos;ll send you a reset link.</Text>

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="mail-outline" size={22} color={Color.gold} style={{ marginBottom: Spacing.sm }} />
              <Text style={styles.successText}>{GENERIC_MESSAGE}</Text>
              <Text style={styles.successHint}>
                Open the link on your phone, or come back here and paste the reset code from the email.
              </Text>
              <Link href="/(auth)/reset-password" style={styles.pasteLink}>
                I have a reset code →
              </Link>
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Send reset link" onPress={handleSubmit} loading={loading} style={styles.submit} />
            </View>
          )}

          <View style={styles.footer}>
            <Link href="/(auth)/login" style={styles.link}>
              Back to sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  backButton: { position: "absolute", top: Spacing.xl, left: Spacing.xl, padding: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Color.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Color.textPrimary,
    fontStyle: "italic",
  },
  subtitle: {
    fontSize: 14,
    color: Color.textMuted,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  form: { marginTop: Spacing.sm },
  submit: { marginTop: Spacing.sm },
  error: {
    color: Color.danger,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  successBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    alignItems: "flex-start",
  },
  successText: { fontSize: 14, color: Color.textPrimary, lineHeight: 20 },
  successHint: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  pasteLink: { fontSize: 13, fontWeight: "600", color: Color.gold, marginTop: Spacing.md },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  link: {
    color: Color.gold,
    fontSize: 14,
    fontWeight: "600",
  },
});

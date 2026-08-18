import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
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

// Matches lib/password.ts's validatePasswordStrength on the backend exactly
// — same rule, same hint copy as the web reset form, so this screen never
// accepts something the server will then reject.
const PASSWORD_REQUIREMENTS_HINT =
  "Must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.";

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character.";
  return null;
}

// The reset email links to a web URL (…/reset-password?token=xxx) since no
// app-link/deep-link handoff is configured for this domain. Rather than
// requiring that, this screen accepts either the bare token or the whole
// pasted link and pulls the token out of it either way.
function extractToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return trimmed;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(tokenParam ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    const cleanToken = extractToken(token);
    if (!cleanToken) {
      setError("Paste the reset code or link from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token: cleanToken, password },
        skipAuth: true,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset password. Please try again.");
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
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Paste the reset code or link from your email, then choose a new password.
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={22} color={Color.gold} style={{ marginBottom: Spacing.sm }} />
              <Text style={styles.successText}>Password updated. You can now sign in.</Text>
              <Button
                title="Sign in"
                onPress={() => router.replace("/(auth)/login")}
                style={{ marginTop: Spacing.md, alignSelf: "stretch" }}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label="Reset code"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                placeholder="Paste the code or link from your email"
                style={styles.tokenInput}
              />
              <TextField
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureToggle
                autoComplete="password-new"
                placeholder="At least 8 characters"
              />
              <Text style={styles.hint}>{PASSWORD_REQUIREMENTS_HINT}</Text>
              <TextField
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureToggle
                autoComplete="password-new"
                placeholder="Re-enter your new password"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Reset password" onPress={handleSubmit} loading={loading} style={styles.submit} />
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
  tokenInput: { height: 64, textAlignVertical: "top", paddingTop: Spacing.sm },
  hint: { fontSize: 12, color: Color.textFaint, marginTop: -Spacing.sm, marginBottom: Spacing.md },
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

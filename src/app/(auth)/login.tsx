import { Link } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Color, Spacing } from "@/constants/theme";
import { ApiError, useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BrandMark style={styles.logo} />
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Access your training, schedule, messages, and profile.
          </Text>

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
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureToggle
              autoComplete="password"
              placeholder="Enter your password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Sign in" onPress={handleSubmit} loading={loading} style={styles.submit} />

            <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need an account? </Text>
            <Link href="/(auth)/signup" style={styles.link}>
              Create one
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
  logo: {
    marginBottom: Spacing.lg,
  },
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
  form: {
    marginTop: Spacing.sm,
  },
  submit: {
    marginTop: Spacing.sm,
  },
  forgotLink: {
    color: Color.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  error: {
    color: Color.danger,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Color.textMuted,
    fontSize: 14,
  },
  link: {
    color: Color.gold,
    fontSize: 14,
    fontWeight: "600",
  },
});

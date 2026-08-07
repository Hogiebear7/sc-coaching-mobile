import { Link } from "expo-router";
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
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError, useAuth, type AuthUser } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { setToken as persistToken } from "@/lib/token-store";

// Condensed to exactly the fields the backend requires (see
// app/api/auth/signup/route.ts in the main repo) — everything else
// (dietary, cycle tracking, appearance, palette) gets a sensible server
// default and is editable later from Settings. Full step-by-step wizard
// parity is a Phase 2 item; this gets a working account created now.
const GENDERS = ["Male", "Female", "Other"] as const;
const GOALS = [
  "Weight Loss",
  "Build Muscle",
  "Maintenance",
  "Injury Recovery",
  "Sports Performance",
  "General Health",
  "Improve Fitness",
  "Improve Mobility",
] as const;

interface SignupResponse {
  success: true;
  token: string;
  user: AuthUser;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function SignupScreen() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number] | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<(typeof GOALS)[number] | null>(null);
  const [sportPlayed, setSportPlayed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password || !fullName.trim() || !phone.trim() || !dateOfBirth.trim()) {
      setError("Please fill in every field.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      setError("Date of birth must be in YYYY-MM-DD format.");
      return;
    }
    if (!gender) {
      setError("Select a gender.");
      return;
    }
    if (!primaryGoal) {
      setError("Select a primary goal.");
      return;
    }
    if (primaryGoal === "Sports Performance" && !sportPlayed.trim()) {
      setError("Sport played is required for a sports performance goal.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<SignupResponse>("/api/mobile/auth/signup", {
        method: "POST",
        skipAuth: true,
        body: {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
          dateOfBirth: dateOfBirth.trim(),
          gender,
          primaryGoal,
          sportPlayed: sportPlayed.trim() || undefined,
        },
      });
      await persistToken(res.token);
      await setSession(res.token, res.user);
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
          <Text style={styles.eyebrow}>CREATE YOUR ACCOUNT</Text>
          <Text style={styles.title}>Join the floor</Text>

          <View style={styles.form}>
            <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="8+ chars, upper/lower/number/symbol"
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+353 83 123 4567"
            />
            <TextField
              label="Date of birth"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>Primary goal</Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => (
                <Chip key={g} label={g} active={primaryGoal === g} onPress={() => setPrimaryGoal(g)} />
              ))}
            </View>

            {primaryGoal === "Sports Performance" ? (
              <TextField
                label="Sport played"
                value={sportPlayed}
                onChangeText={setSportPlayed}
                placeholder="e.g. GAA, Rugby"
                style={{ marginTop: Spacing.md }}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Create account" onPress={handleSubmit} loading={loading} style={styles.submit} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Color.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Color.textPrimary,
    fontStyle: "italic",
    marginBottom: Spacing.xl,
  },
  form: {},
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: Color.textSecondary,
    marginBottom: 6,
  },
  labelSpaced: {
    marginTop: Spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  chipActive: {
    borderColor: Color.gold,
    backgroundColor: Color.goldWeak,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Color.textMuted,
  },
  chipTextActive: {
    color: Color.gold,
  },
  submit: {
    marginTop: Spacing.xl,
  },
  error: {
    color: Color.danger,
    fontSize: 13,
    marginTop: Spacing.md,
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

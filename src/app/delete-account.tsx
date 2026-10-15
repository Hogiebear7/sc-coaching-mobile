import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { canSubmitDeletion, DELETE_CONFIRM_WORD } from "@/lib/account-deletion";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useDeleteAccount } from "@/lib/queries/profile";

// Settings -> Delete account. Two things are required, never one tap: the current password and the word DELETE. The server re-checks both and refuses
// (with a plain-language reason) while a paid subscription is live. On success the member is signed out, and that sign-out is the ONLY navigation:
// the root AuthGate replaces the route with the login screen. Nothing else is closed, reset or navigated in the same burst (two native transitions at once
// have crashed this app before).
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const deleteAccount = useDeleteAccount();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = deleteAccount.isPending;
  const ready = canSubmitDeletion(password, confirmText, busy);

  async function handleDelete() {
    if (!ready) return;
    setError(null);
    try {
      await deleteAccount.mutateAsync({ password, confirm: confirmText });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't delete your account. Please try again.");
      return;
    }
    await logout();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} disabled={busy} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete account</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={styles.warnTitle}>This permanently deletes your account</Text>
            <Text style={styles.body}>
              Your profile, workouts, programmes, recovery check-ins, food diary, bookings, messages and community activity are removed straight away. This can&apos;t be undone.
            </Text>
            <Text style={styles.body}>
              Payment records the club must keep for accounting are retained without your name. If you have an active paid membership, cancel it first. A Google Play
              subscription can only be cancelled in Google Play.
            </Text>
          </Card>

          <Text style={styles.label}>Your password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            editable={!busy}
            accessibilityLabel="Your password"
          />

          <Text style={styles.label}>Type {DELETE_CONFIRM_WORD} to confirm</Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            accessibilityLabel={`Type ${DELETE_CONFIRM_WORD} to confirm`}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={handleDelete}
              disabled={!ready}
              style={[styles.dangerButton, !ready && styles.dangerButtonDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
            >
              <Text style={styles.dangerText}>{busy ? "Deleting…" : "Permanently delete my account"}</Text>
            </Pressable>
            <Button title="Cancel" variant="secondary" onPress={() => router.back()} disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { padding: Spacing.md, gap: Spacing.sm },
  warnTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  body: { fontSize: 13, color: Color.textSecondary, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: "600", color: Color.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    color: Color.textPrimary,
    fontSize: 15,
    backgroundColor: Color.surface1,
  },
  error: { marginTop: Spacing.md, fontSize: 13, color: Color.danger, lineHeight: 18 },
  actions: { marginTop: Spacing.xl, gap: Spacing.md },
  dangerButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.danger,
    backgroundColor: Color.dangerWeak,
  },
  dangerButtonDisabled: { opacity: 0.5 },
  dangerText: { color: Color.danger, fontSize: 15, fontWeight: "700" },
});

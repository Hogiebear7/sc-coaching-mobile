import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { MAX_GYM_REPORT_REASON } from "@/lib/community-groups-format";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const QUICK_REASONS = ["Offensive or abusive", "Spam or fake", "Something else"] as const;

// Asks why a post or comment is being reported, then hands the reason back. The caller sends it (gym posts and comments use the gym report route) and
// shows the result. Reports go to the gym's coaches and admins, who can remove the content.
export function ReportReasonSheet({
  visible,
  onClose,
  onSubmit,
  submitting,
  heading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting: boolean;
  heading: string;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  function close() {
    setReason("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.body}>Tell us what is wrong. A coach or admin will look at it.</Text>
          <View style={styles.quickRow}>
            {QUICK_REASONS.map((q) => (
              <Pressable key={q} onPress={() => setReason(q)} style={[styles.chip, trimmed === q && styles.chipActive]} accessibilityRole="button">
                <Text style={[styles.chipText, trimmed === q && styles.chipTextActive]}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, MAX_GYM_REPORT_REASON))}
            placeholder="Add a few words (required)"
            placeholderTextColor={Color.textFaint}
            multiline
            style={styles.input}
            accessibilityLabel="Reason for the report"
          />
          <Text style={styles.count}>
            {trimmed.length}/{MAX_GYM_REPORT_REASON}
          </Text>
          {submitting ? (
            <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.md }} />
          ) : (
            <Button title="Send report" onPress={() => onSubmit(trimmed)} disabled={trimmed.length === 0} style={{ marginTop: Spacing.sm }} />
          )}
          <Pressable onPress={close} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(4,10,20,0.72)", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    card: { width: "100%", maxWidth: 380, borderRadius: Radius.lg, backgroundColor: Color.surface1, padding: Spacing.lg },
    title: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    body: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: Spacing.xs },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.md },
    chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold },
    chipText: { fontSize: 13, fontWeight: "600", color: Color.textFaint },
    chipTextActive: { color: Color.goldForeground },
    input: {
      minHeight: 72,
      marginTop: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: Color.surface2,
      padding: Spacing.sm,
      fontSize: 14,
      color: Color.textPrimary,
      textAlignVertical: "top",
    },
    count: { fontSize: 12, color: Color.textFaint, alignSelf: "flex-end", marginTop: 4 },
    secondary: { marginTop: Spacing.sm, alignSelf: "center", minHeight: 40, justifyContent: "center" },
    secondaryText: { fontSize: 14, fontWeight: "500", color: Color.textFaint, textDecorationLine: "underline" },
  })
);

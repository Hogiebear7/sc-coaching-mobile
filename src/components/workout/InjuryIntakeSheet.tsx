import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import {
  AREA_LABELS,
  FEEL_OPTIONS,
  STARTED_OPTIONS,
  SORE_TTL_DAYS,
  buildInjuryMessage,
  canSubmitIntake,
  type FeelValue,
  type InjuryIntake,
  type StartedValue,
} from "@/lib/injury-intake";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { INJURY_AREAS, type InjuryArea } from "@/lib/session-engine/types";

// "I'm sore or injured": a few taps that become a plain message to the coach. It is general information only (the server limits what the coach may say and
// catches serious symptoms first). It can also tell the workout generator to go easy on the area for a few days.
export function InjuryIntakeSheet({
  visible,
  onClose,
  onSubmit,
  sending,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string, goEasyAreas: InjuryArea[]) => void;
  sending: boolean;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [area, setArea] = useState<InjuryArea | null>(null);
  const [started, setStarted] = useState<StartedValue | null>(null);
  const [feel, setFeel] = useState<FeelValue | null>(null);
  const [note, setNote] = useState("");
  const [goEasy, setGoEasy] = useState(true);

  const intake: InjuryIntake = { area, started, feel, note };

  function chip(key: string, label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={key}
        onPress={() => {
          tapFeedback();
          onPress();
        }}
        style={[styles.chip, active && styles.chipActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  function submit() {
    if (!canSubmitIntake(intake) || !area) return;
    onSubmit(buildInjuryMessage(intake), goEasy ? [area] : []);
    setArea(null);
    setStarted(null);
    setFeel(null);
    setNote("");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurBackdrop />
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Sore or injured?</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={18} color={Color.warning} />
              <Text style={styles.warningText}>
                If you had a fall or accident, can&apos;t put weight on it, or have chest pain, numbness, a head injury or feel unwell, call 112 or 999 or go to an emergency
                department now. The coach gives general information only. It is not medical advice and it can&apos;t diagnose.
              </Text>
            </View>

            <Text style={styles.label}>WHERE?</Text>
            <View style={styles.row}>{INJURY_AREAS.map((a) => chip(a, AREA_LABELS[a], area === a, () => setArea(area === a ? null : a)))}</View>

            <Text style={styles.label}>WHEN DID IT START? — OPTIONAL</Text>
            <View style={styles.row}>
              {STARTED_OPTIONS.map((o) => chip(o.value, o.label, started === o.value, () => setStarted(started === o.value ? null : o.value)))}
            </View>

            <Text style={styles.label}>WHAT DOES IT FEEL LIKE? — OPTIONAL</Text>
            <View style={styles.row}>{FEEL_OPTIONS.map((o) => chip(o.value, o.label, feel === o.value, () => setFeel(feel === o.value ? null : o.value)))}</View>

            <Text style={styles.label}>ANYTHING ELSE? — OPTIONAL</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="For example: only when I squat"
              placeholderTextColor={Color.textFaint}
              maxLength={200}
              multiline
              style={styles.input}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Go easy on this in my workouts</Text>
                <Text style={styles.sub}>The workout generator leaves out exercises that load this area for the next {SORE_TTL_DAYS} days.</Text>
              </View>
              <Switch value={goEasy} onValueChange={setGoEasy} trackColor={{ false: Color.surface3, true: Color.success }} thumbColor="#ffffff" />
            </View>
          </ScrollView>

          <Button title="Ask the coach" onPress={submit} disabled={!canSubmitIntake(intake) || sending} loading={sending} style={{ marginTop: Spacing.md }} />
          <Pressable onPress={onClose} hitSlop={8} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", padding: Spacing.lg },
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.lg, maxHeight: "90%" },
    title: { fontSize: 20, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
    warning: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Color.surface2, marginBottom: Spacing.sm },
    warningText: { flex: 1, fontSize: 13, lineHeight: 19, color: Color.textSecondary },
    label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.md, marginBottom: Spacing.xs },
    row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: Color.surface2 },
    chipActive: { backgroundColor: Color.textPrimary },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    chipTextActive: { color: Color.bg0 },
    input: { minHeight: 64, borderRadius: Radius.md, backgroundColor: Color.surface2, padding: Spacing.md, color: Color.textPrimary, fontSize: 15, textAlignVertical: "top" },
    switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginTop: Spacing.md },
    switchTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    sub: { fontSize: 13, color: Color.textMuted, lineHeight: 19, marginTop: 2 },
    cancel: { alignItems: "center", paddingVertical: Spacing.md },
    cancelText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
  }),
);

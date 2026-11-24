import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { AREA_LABELS, DANGER_SIGNS, assessIntake, type IntakeOutcome } from "@/lib/injury-intake";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { INJURY_AREAS, type InjuryArea } from "@/lib/session-engine/types";

// "Sore or injured?": gives no advice and does not use the AI. A danger-sign checklist first (any tick means "get checked" and no workout is offered), then the
// area to work around. It cannot say whether the member should train; it only tells the workout generator what to leave out for a few days.
export function InjuryIntakeSheet({
  visible,
  onClose,
  onBuildSession,
}: {
  visible: boolean;
  onClose: () => void;
  /** The member chose to build a session around these areas (they are saved for a few days by the caller). */
  onBuildSession: (areas: InjuryArea[]) => void;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [areas, setAreas] = useState<InjuryArea[]>([]);
  const [dangers, setDangers] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<IntakeOutcome | null>(null);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function chip(key: string, label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={key}
        onPress={() => {
          tapFeedback();
          setOutcome(null);
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

  function close() {
    setOutcome(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <BlurBackdrop />
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Sore or injured?</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sub}>This gives no advice. It only tells the workout generator which area to work around. It can&apos;t say whether you should train.</Text>

            <Text style={styles.label}>ANY OF THESE?</Text>
            <View style={styles.row}>{DANGER_SIGNS.map((d) => chip(d.id, d.label, dangers.includes(d.id), () => setDangers((cur) => toggle(cur, d.id))))}</View>

            <Text style={styles.label}>WHICH AREA IS SORE?</Text>
            <View style={styles.row}>{INJURY_AREAS.map((a) => chip(a, AREA_LABELS[a], areas.includes(a), () => setAreas((cur) => toggle(cur, a))))}</View>

            {outcome?.kind === "danger" ? (
              <View style={[styles.result, styles.resultDanger]}>
                <Ionicons name="warning-outline" size={20} color={Color.warning} />
                <Text style={styles.resultText}>{outcome.reply}</Text>
              </View>
            ) : null}
            {outcome?.kind === "ok" ? (
              <View style={styles.result}>
                <Ionicons name="information-circle-outline" size={20} color={Color.textSecondary} />
                <Text style={styles.resultText}>{outcome.message}</Text>
              </View>
            ) : null}
            {outcome?.kind === "incomplete" ? <Text style={styles.sub}>Pick the area that is sore.</Text> : null}
          </ScrollView>

          {outcome?.kind === "ok" ? (
            <Button
              title="Build a session around it"
              onPress={() => {
                const o = outcome;
                setOutcome(null);
                setAreas([]);
                setDangers([]);
                onBuildSession(o.areas);
              }}
              style={{ marginTop: Spacing.md }}
            />
          ) : outcome?.kind === "danger" ? null : (
            <Button title="Continue" onPress={() => setOutcome(assessIntake({ areas, dangers }))} style={{ marginTop: Spacing.md }} />
          )}
          <Pressable onPress={close} hitSlop={8} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>{outcome?.kind === "danger" ? "Close" : "Cancel"}</Text>
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
    sub: { fontSize: 13, color: Color.textMuted, lineHeight: 19 },
    label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.md, marginBottom: Spacing.xs },
    row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: Color.surface2 },
    chipActive: { backgroundColor: Color.textPrimary },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    chipTextActive: { color: Color.bg0 },
    result: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Color.surface2, marginTop: Spacing.md },
    resultDanger: { borderWidth: 1, borderColor: Color.warning },
    resultText: { flex: 1, fontSize: 14, lineHeight: 20, color: Color.textPrimary },
    cancel: { alignItems: "center", paddingVertical: Spacing.md },
    cancelText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
  }),
);

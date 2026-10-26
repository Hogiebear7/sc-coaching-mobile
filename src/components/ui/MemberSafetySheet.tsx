import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { useBlockMember, useReportWorkout } from "@/lib/queries/community";

const REPORT_REASONS = ["Offensive or abusive", "Spam or fake", "Something else"] as const;

type Step = "menu" | "report" | "block" | "done";

// The Community safety actions for another member: report their shared workout (when workoutId is given) and block them. Blocking hides each of you from
// the other everywhere in Community and removes any follow; it can be undone from Community privacy. Same plain-Modal pattern as CommentSheet.
export function MemberSafetySheet({
  visible,
  onClose,
  memberUserId,
  memberName,
  workoutId,
  initialStep,
}: {
  visible: boolean;
  onClose: () => void;
  memberUserId: string;
  memberName: string;
  /** When set, "Report this workout" is offered. */
  workoutId?: string;
  /** Skip the menu (e.g. "Block" tapped directly beside a comment). */
  initialStep?: "block";
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [step, setStep] = useState<Step>(initialStep ?? "menu");
  const [doneText, setDoneText] = useState("");
  const report = useReportWorkout();
  const block = useBlockMember();
  const busy = report.isPending || block.isPending;

  function close() {
    setStep(initialStep ?? "menu");
    setDoneText("");
    report.reset();
    block.reset();
    onClose();
  }

  function sendReport(reason: string) {
    if (!workoutId) return;
    report.mutate(
      { workoutId, reason },
      {
        onSuccess: () => {
          setDoneText("Thanks. A coach will review it.");
          setStep("done");
        },
      }
    );
  }

  function confirmBlock() {
    block.mutate(memberUserId, {
      onSuccess: () => {
        setDoneText(`${memberName} is blocked. You won't see each other in Community. You can undo this in Community privacy.`);
        setStep("done");
      },
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {step === "menu" ? (
            <>
              <Text style={styles.title}>{memberName}</Text>
              {workoutId ? (
                <Pressable style={styles.row} onPress={() => setStep("report")} accessibilityRole="button">
                  <Text style={styles.rowText}>Report this workout</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.row} onPress={() => setStep("block")} accessibilityRole="button">
                <Text style={[styles.rowText, styles.danger]}>Block {memberName}</Text>
              </Pressable>
              <Pressable style={styles.row} onPress={close} accessibilityRole="button">
                <Text style={styles.rowText}>Cancel</Text>
              </Pressable>
            </>
          ) : null}

          {step === "report" ? (
            <>
              <Text style={styles.title}>Why are you reporting this?</Text>
              {REPORT_REASONS.map((reason) => (
                <Pressable key={reason} style={styles.row} disabled={busy} onPress={() => sendReport(reason)} accessibilityRole="button">
                  <Text style={styles.rowText}>{reason}</Text>
                </Pressable>
              ))}
              {report.isPending ? <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} /> : null}
              {report.isError ? <Text style={styles.error}>{report.error?.message ?? "Couldn't send that report."}</Text> : null}
              <Pressable style={styles.row} onPress={() => setStep("menu")} accessibilityRole="button">
                <Text style={styles.rowText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step === "block" ? (
            <>
              <Text style={styles.title}>Block {memberName}?</Text>
              <Text style={styles.body}>
                You won&apos;t see their workouts, comments or name in Community, and they won&apos;t see yours. Any follow between you is removed. You can unblock
                them in Community privacy.
              </Text>
              {block.isError ? <Text style={styles.error}>{block.error?.message ?? "Couldn't block that member."}</Text> : null}
              <View style={styles.buttons}>
                <Pressable style={[styles.button, styles.buttonGhost]} onPress={initialStep ? close : () => setStep("menu")} disabled={busy} accessibilityRole="button">
                  <Text style={styles.rowText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonDanger]} onPress={confirmBlock} disabled={busy} accessibilityRole="button">
                  {block.isPending ? <ActivityIndicator color={Color.textPrimary} size="small" /> : <Text style={styles.buttonDangerText}>Block</Text>}
                </Pressable>
              </View>
            </>
          ) : null}

          {step === "done" ? (
            <>
              <Text style={styles.body}>{doneText}</Text>
              <Pressable style={styles.row} onPress={close} accessibilityRole="button">
                <Text style={styles.rowText}>Done</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: Spacing.lg },
  card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Color.borderSubtle },
  title: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
  body: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginBottom: Spacing.md },
  row: { paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, textAlign: "center" },
  danger: { color: Color.danger },
  error: { fontSize: 12, color: Color.danger, marginVertical: Spacing.sm },
  buttons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  button: { flex: 1, minHeight: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  buttonGhost: { borderWidth: 1, borderColor: Color.borderSubtle },
  buttonDanger: { backgroundColor: Color.danger },
  buttonDangerText: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
})
);

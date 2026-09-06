import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import {
  useExerciseAlternatives,
  useSwapProgramExercise,
  type ExerciseAlternative,
  type PrescribedExercise,
} from "@/lib/queries/programs";

import { Button } from "./Button";
import { TextField } from "./TextField";

// "I can't do / don't like this exercise" — AI-suggested swap, one exercise
// at a time. A single shared instance lives in the Workouts tab and is
// re-opened for whichever exercise the member taps, so programId/exerciseId
// arrive as props each time rather than being fixed at mount. Modeled on
// InfoModal's plain-RN-Modal + backdrop pattern (no sheet/action-menu
// component exists elsewhere in this app to reuse instead).
export function ExerciseSwapSheet({
  visible,
  onClose,
  programId,
  dayId,
  exercise,
}: {
  visible: boolean;
  onClose: () => void;
  programId: string;
  dayId: string;
  exercise: PrescribedExercise | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Keyed by exercise id so switching which exercise is open remounts
            this content with fresh state, rather than resetting it via an
            effect (which would cascade an extra render on every open). */}
        {exercise ? (
          <SwapSheetContent
            key={exercise.id}
            programId={programId}
            dayId={dayId}
            exercise={exercise}
            onClose={onClose}
          />
        ) : null}
      </Pressable>
    </Modal>
  );
}

function SwapSheetContent({
  programId,
  dayId,
  exercise,
  onClose,
}: {
  programId: string;
  dayId: string;
  exercise: PrescribedExercise;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [alternatives, setAlternatives] = useState<ExerciseAlternative[] | null>(null);
  const fetchAlternatives = useExerciseAlternatives();
  const swapExercise = useSwapProgramExercise();

  function handleFindAlternatives() {
    tapFeedback();
    fetchAlternatives.mutate(
      { programId, exerciseId: exercise.id, dayId, reason: reason.trim() || undefined },
      { onSuccess: (result) => setAlternatives(result) }
    );
  }

  function handleSwap(newExerciseId: string) {
    tapFeedback();
    swapExercise.mutate({ programId, exerciseId: exercise.id, dayId, newExerciseId }, { onSuccess: onClose });
  }

  return (
    <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
      <Text style={styles.title}>Swap {exercise.name}</Text>

      {alternatives === null ? (
        <>
          <Text style={styles.hint}>
            Can&apos;t do this one, or just don&apos;t like it? Tell us why (optional) and we&apos;ll suggest similar
            exercises that work the same muscles.
          </Text>
          <TextField
            label="What's the issue? (optional)"
            placeholder="e.g. shoulder pain, no barbell available"
            value={reason}
            onChangeText={setReason}
          />
          {fetchAlternatives.isError ? (
            <Text style={styles.error}>Couldn&apos;t get alternatives right now. Try again.</Text>
          ) : null}
          <Button
            title="Find alternatives"
            onPress={handleFindAlternatives}
            loading={fetchAlternatives.isPending}
            style={{ marginTop: Spacing.sm }}
          />
        </>
      ) : (
        <ScrollView style={styles.altScroll} showsVerticalScrollIndicator={false}>
          {alternatives.length === 0 ? (
            <Text style={styles.hint}>No alternatives found for this exercise right now.</Text>
          ) : (
            alternatives.map((alt) => (
              <Pressable
                key={alt.exerciseId}
                style={styles.altCard}
                onPress={() => handleSwap(alt.exerciseId)}
                disabled={swapExercise.isPending}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.altName}>{alt.name}</Text>
                  <Text style={styles.altRationale}>{alt.rationale}</Text>
                </View>
                {swapExercise.isPending ? (
                  <ActivityIndicator size="small" color={Color.gold} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
                )}
              </Pressable>
            ))
          )}
          {swapExercise.isError ? <Text style={styles.error}>Couldn&apos;t swap that in. Try again.</Text> : null}
        </ScrollView>
      )}

      <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
        <Ionicons name="close" size={16} color={Color.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,10,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  hint: { fontSize: 12, color: Color.textSecondary, lineHeight: 17, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm },
  closeButton: { position: "absolute", top: Spacing.md, right: Spacing.md, padding: 4 },
  altScroll: { marginTop: Spacing.xs },
  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  altName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  altRationale: { fontSize: 12, color: Color.textMuted, marginTop: 2, lineHeight: 16 },
});

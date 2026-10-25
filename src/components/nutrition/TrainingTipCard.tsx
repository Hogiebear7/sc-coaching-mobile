import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useSaveNutritionPreferences, type ResolvedNutritionTarget } from "@/lib/queries/nutrition-diary";
import { useWorkouts } from "@/lib/queries/workouts";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { shouldSuggestTrainingSplit } from "@/lib/training-tip";
import { todayDateString } from "@/lib/workout-formatters";

const DISMISSED_KEY = "sc.trainingTipDismissed";

// One-time nudge (nutrition targets v2) for a member on even calories who
// trains regularly: offers to switch their weekly budget to match training.
// Shown once; dismissing or accepting hides it for good on this device.
export function TrainingTipCard({ target }: { target: ResolvedNutritionTarget | null | undefined }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { data: workouts } = useWorkouts();
  const save = useSaveNutritionPreferences();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => alive && setDismissed(v === "1"))
      .catch(() => alive && setDismissed(false));
    return () => {
      alive = false;
    };
  }, []);

  const show =
    dismissed === false &&
    target?.mode === "auto" &&
    shouldSuggestTrainingSplit({
      sessionDates: (workouts?.sessions ?? []).map((s) => s.date),
      today: todayDateString(),
      distribution: target.distribution,
      locked: target.distributionSource === "coach-locked",
    });
  if (!show) return null;

  function hide() {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="flash-outline" size={18} color={colors.text} />
        </View>
        <Text style={styles.title}>You&apos;re training regularly</Text>
        <Pressable
          onPress={() => {
            tapFeedback();
            hide();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tip"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.body}>
        Want your calories to match your training days? You&apos;d get more on heavy days and less on rest days — same weekly
        total.
      </Text>
      <Pressable
        onPress={() =>
          save.mutate(
            { calorieDistribution: "training" },
            {
              onSuccess: () => {
                successFeedback();
                hide();
              },
            }
          )
        }
        disabled={save.isPending}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{save.isPending ? "Switching…" : "Match my training"}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16, marginTop: 16 },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, fontSize: 16, fontWeight: "600", color: c.text },
    body: { fontSize: 15, lineHeight: 21, color: c.textSecondary, marginTop: 10 },
    button: { marginTop: 12, minHeight: 48, borderRadius: AppRadius.control, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    buttonText: { fontSize: 16, fontWeight: "600", color: c.onPrimary },
  })
);

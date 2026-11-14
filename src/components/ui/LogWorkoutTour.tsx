import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const STORAGE_PREFIX = "log-workout-tour-seen-v2-";

const TIPS = [
  "Each exercise (or superset) is one simple card, one set or round at a time. Tick each one as you do it. Tap Edit for the full card, and Simple view to go back.",
  "To make a superset, tap an exercise's number: it links with the one above. Tap a later one (A3) to start a new superset (B). Tap the first one again to undo. Cardio can join too.",
  "In a superset you work through rounds: A1, then A2, with no rest until the round is done. Your rest timer starts when you tick the last one.",
  "A timed exercise has a play button next to the tick. It counts you in, counts the time down, and puts the time back on the set for you to tick.",
  "Tap Weight (kg) to switch between kg, time and band. Tap Reps to split it into right and left. Weight carries down to the sets below.",
  "Cardio has its own stopwatch, and a tick and RPE circle. Add exercise and Add cardio put the new one at the end of your workout.",
  "The plate calculator works out which plates to load. Save as template reuses this workout later.",
  "When you finish, a quick \"how did that feel\" check leads to a session review.",
];

// One-time first-run card for the Log Workout screen — same "explain once,
// don't repeat" idea as the tab tour (tour-context.tsx), but log-workout is
// a stack-modal screen outside that tour's tab-only scope, so it gets its
// own small, self-contained version rather than being force-fit into that
// system. Member-only, same as the tab tour.
export function LogWorkoutTour() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const userId = user?.role === "member" ? user.id : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_PREFIX + userId).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function dismiss() {
    tapFeedback();
    setVisible(false);
    if (userId) AsyncStorage.setItem(STORAGE_PREFIX + userId, "1").catch(() => {});
  }

  if (!userId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="barbell-outline" size={22} color={Color.gold} />
          </View>
          <Text style={styles.title}>Logging a workout</Text>
          <Text style={styles.description}>A few things worth knowing before you start.</Text>
          <ScrollView style={styles.tipScroll}>
            <View style={styles.tipList}>
              {TIPS.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipBullet} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <Pressable onPress={dismiss} style={styles.gotItButton}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(4,10,20,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      borderRadius: Radius.lg,
      backgroundColor: Color.surface1,
      padding: Spacing.xl,
      alignItems: "center",
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: Radius.pill,
      backgroundColor: Color.goldWeak,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
    description: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.sm },
    tipScroll: { maxHeight: 380, width: "100%" },
    tipList: { width: "100%", marginTop: Spacing.lg, gap: Spacing.sm },
    tipRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
    tipBullet: { width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: Color.gold, marginTop: 6 },
    tipText: { flex: 1, fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
    gotItButton: {
      width: "100%",
      marginTop: Spacing.xl,
      height: 48,
      borderRadius: Radius.pill,
      backgroundColor: Color.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    gotItText: { fontSize: 15, fontWeight: "600", color: Color.goldForeground },
  })
);

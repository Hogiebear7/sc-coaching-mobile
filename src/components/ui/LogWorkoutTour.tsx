import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";

const STORAGE_PREFIX = "log-workout-tour-seen-v1-";

const TIPS = [
  "Tap a set's number to cycle its type — standard, warm-up, dropset, myoset, failure, or partial.",
  "The plate calculator works out which plates to load for a target weight.",
  "The timer icon starts a rest countdown; the stopwatch on a run tracks it live.",
  "Add more exercises or a run any time with the buttons at the bottom.",
  "Save as template to reuse this exact workout later.",
  "After you finish, a quick \"how did that feel\" check leads to a session review.",
];

// One-time first-run card for the Log Workout screen — same "explain once,
// don't repeat" idea as the tab tour (tour-context.tsx), but log-workout is
// a stack-modal screen outside that tour's tab-only scope, so it gets its
// own small, self-contained version rather than being force-fit into that
// system. Member-only, same as the tab tour.
export function LogWorkoutTour() {
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
          <View style={styles.tipList}>
            {TIPS.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipBullet} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={dismiss} style={styles.gotItButton}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    maxWidth: 380,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.xl,
    alignItems: "center",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
  description: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.sm },
  tipList: { width: "100%", marginTop: Spacing.lg, gap: Spacing.sm },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  tipBullet: { width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: Color.gold, marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  gotItButton: {
    width: "100%",
    marginTop: Spacing.xl,
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  gotItText: { fontSize: 15, fontWeight: "600", color: Color.goldForeground },
});

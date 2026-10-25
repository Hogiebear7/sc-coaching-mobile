import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useSetDayStatus, type DayLogStatus } from "@/lib/queries/nutrition-diary";
import { makeStyles, useAppTheme } from "@/lib/theme";

// The diary's "Day complete" mark (nutrition targets v2). A complete day
// teaches the app the member's real burn; an incomplete one never does.
// dayStatus undefined means the server predates v2 — render nothing.
export function DayCompleteCard({
  date,
  dayStatus,
  hasEntries,
  isFuture,
}: {
  date: string;
  dayStatus: DayLogStatus | null | undefined;
  hasEntries: boolean;
  isFuture: boolean;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const setStatus = useSetDayStatus();

  if (dayStatus === undefined || isFuture || (!hasEntries && dayStatus === null)) return null;

  function mark(status: DayLogStatus | null) {
    tapFeedback();
    setStatus.mutate(
      { date, status },
      { onSuccess: () => status === "complete" && successFeedback(), onError: () => errorFeedback() }
    );
  }

  if (dayStatus === "complete") {
    return (
      <View style={[styles.card, styles.row]}>
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Day complete</Text>
          <Text style={styles.sub}>This day helps the app learn your burn.</Text>
        </View>
        <Pressable onPress={() => mark(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo day complete">
          <Text style={styles.link}>Undo</Text>
        </Pressable>
      </View>
    );
  }

  if (dayStatus === "incomplete") {
    return (
      <View style={[styles.card, styles.row]}>
        <Ionicons name="remove-circle-outline" size={24} color={colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Marked incomplete</Text>
          <Text style={styles.sub}>Left out when learning your burn.</Text>
        </View>
        <Pressable onPress={() => mark(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear incomplete mark">
          <Text style={styles.link}>Undo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Logged everything you ate?</Text>
      <Text style={styles.sub}>Complete days teach the app how much you really burn. Partial days are left out.</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => mark("complete")}
          disabled={setStatus.isPending}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
          <Text style={styles.primaryText}>Day complete</Text>
        </Pressable>
        <Pressable
          onPress={() => mark("incomplete")}
          disabled={setStatus.isPending}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Mark this day as incomplete"
        >
          <Text style={styles.secondaryText}>Missed some</Text>
        </Pressable>
      </View>
      {setStatus.isError ? <Text style={styles.error}>Couldn&apos;t save that — try again.</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16, marginTop: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    title: { fontSize: 16, fontWeight: "600", color: c.text },
    sub: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginTop: 2 },
    link: { fontSize: 15, fontWeight: "600", color: c.textSecondary, textDecorationLine: "underline" },
    actions: { flexDirection: "row", gap: 10, marginTop: 12 },
    primary: { flex: 1, minHeight: 48, borderRadius: AppRadius.control, backgroundColor: c.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    primaryText: { fontSize: 16, fontWeight: "600", color: c.onPrimary },
    secondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: AppRadius.control, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    secondaryText: { fontSize: 16, fontWeight: "600", color: c.text },
    error: { fontSize: 14, color: c.danger, marginTop: 8 },
  })
);

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SessionCard } from "@/components/ui/SessionCard";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useWorkouts, type WorkoutSessionSummary } from "@/lib/queries/workouts";

function monthLabel(dateISO: string): string {
  const [y, m] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useWorkouts();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.sessions.filter(
          (s) => s.title.toLowerCase().includes(q) || s.exercises.some((e) => e.name.toLowerCase().includes(q))
        )
      : data.sessions;

    const byMonth = new Map<string, WorkoutSessionSummary[]>();
    for (const s of filtered) {
      const label = monthLabel(s.date);
      const list = byMonth.get(label) ?? [];
      list.push(s);
      byMonth.set(label, list);
    }
    return [...byMonth.entries()];
  }, [data, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout History</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Color.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title or exercise"
          placeholderTextColor={Color.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your history.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {groups.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="time-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>
                {query ? `No sessions match "${query}".` : "No workouts logged yet."}
              </Text>
            </Card>
          ) : (
            groups.map(([label, sessions]) => (
              <View key={label} style={styles.monthGroup}>
                <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
                {sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, color: Color.textPrimary, fontSize: 14 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  monthGroup: { marginBottom: Spacing.lg },
  monthLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
});

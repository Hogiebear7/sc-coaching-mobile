import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MonthCalendar } from "@/components/ui/MonthCalendar";
import { SessionCard } from "@/components/ui/SessionCard";
import { Radius, Spacing } from "@/constants/theme";
import { selectionFeedback } from "@/lib/haptics";
import { useWorkouts, type WorkoutSessionSummary } from "@/lib/queries/workouts";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

function monthLabel(dateISO: string): string {
  const [y, m] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDateLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

type ViewMode = "list" | "calendar";

export default function WorkoutHistoryScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useWorkouts();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, WorkoutSessionSummary[]> = {};
    for (const s of data?.sessions ?? []) {
      (map[s.date] ??= []).push(s);
    }
    return map;
  }, [data]);
  const sectionByExerciseId = useMemo(
    () => new Map((data?.exerciseLibrary ?? []).map((e) => [e.id, e.section])),
    [data]
  );
  const countByDate = useMemo(
    () => Object.fromEntries(Object.entries(sessionsByDate).map(([date, list]) => [date, list.length])),
    [sessionsByDate],
  );
  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] ?? []) : [];

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout history</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.viewToggle} accessibilityRole="tablist">
        {(["list", "calendar"] as const).map((mode) => {
          const active = view === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => {
                if (!active) selectionFeedback();
                setView(mode);
              }}
              style={[styles.viewToggleBtn, active && styles.viewToggleBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.viewToggleText, active && styles.viewToggleTextActive]}>{mode === "list" ? "List" : "Calendar"}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === "list" ? (
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
      ) : null}

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your history.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : view === "calendar" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <MonthCalendar countByDate={countByDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <View style={styles.calendarDetail}>
            <Text style={styles.monthLabel}>{selectedDate ? formatDateLabel(selectedDate) : "Select a date"}</Text>
            {selectedSessions.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>{selectedDate ? "Nothing logged this day." : "Tap a day to see what you logged."}</Text>
              </Card>
            ) : (
              selectedSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                  sectionByExerciseId={sectionByExerciseId}
                />
              ))
            )}
          </View>
        </ScrollView>
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
                <Text style={styles.monthLabel}>{label}</Text>
                {sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onPress={() => router.push({ pathname: "/session-detail", params: { id: s.id } })}
                    sectionByExerciseId={sectionByExerciseId}
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

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    viewToggle: { flexDirection: "row", gap: 2, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: 3, borderRadius: Radius.pill, backgroundColor: Color.surface2 },
    viewToggleBtn: { flex: 1, minHeight: 38, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    viewToggleBtnActive: { backgroundColor: Color.gold },
    viewToggleText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    viewToggleTextActive: { color: Color.goldForeground },
    calendarDetail: { marginTop: Spacing.lg },
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
      borderColor: "transparent",
      backgroundColor: Color.surface2,
    },
    searchInput: { flex: 1, color: Color.textPrimary, fontSize: 14 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    errorText: { color: Color.textMuted, fontSize: 14 },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    monthGroup: { marginBottom: Spacing.lg },
    monthLabel: { fontSize: 19, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
    emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
    emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
  })
);

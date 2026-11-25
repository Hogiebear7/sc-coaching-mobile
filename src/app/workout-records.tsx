import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useWorkouts } from "@/lib/queries/workouts";
import { getRecentRecords, todayDateString, type RecentRecord } from "@/lib/workout-formatters";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type SortMode = "recent" | "az";

interface ExerciseRecords {
  name: string;
  latest: string;
  records: RecentRecord[];
}

// The tile order inside an exercise, so the same record always sits in the same place.
const TYPE_ORDER: RecentRecord["type"][] = ["weight", "1RM", "volume", "reps"];
const TILE_LABEL: Record<RecentRecord["type"], string> = { weight: "Heaviest", "1RM": "Est. 1RM", volume: "Best set volume", reps: "Best set reps" };

// Every personal best, one card per exercise (its four records side by side) instead of one long list of rows. Search finds an exercise, and the list can be
// ordered by most recent record or A to Z. Tapping a card opens that exercise's detail.
export default function WorkoutRecordsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data, isLoading } = useWorkouts();
  const today = todayDateString();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const exercises = useMemo<ExerciseRecords[]>(() => {
    if (!data) return [];
    const byName = new Map<string, RecentRecord[]>();
    for (const r of getRecentRecords(data.sessions, 3650, today)) byName.set(r.exerciseName, [...(byName.get(r.exerciseName) ?? []), r]);
    return [...byName.entries()].map(([name, records]) => ({
      name,
      records: records.slice().sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)),
      latest: records.reduce((m, r) => (r.date > m ? r.date : m), ""),
    }));
  }, [data, today]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises;
    return list.slice().sort((a, b) => (sort === "az" ? a.name.localeCompare(b.name) : b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name)));
  }, [exercises, query, sort]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>All records</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No records yet — log a workout to start setting them.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={Color.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={Color.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search exercises"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={Color.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sortRow}>
            <Text style={styles.count}>
              {shown.length} exercise{shown.length === 1 ? "" : "s"}
            </Text>
            <View style={styles.chips}>
              {(["recent", "az"] as SortMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    tapFeedback();
                    setSort(m);
                  }}
                  style={[styles.chip, sort === m && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === m }}
                >
                  <Text style={[styles.chipText, sort === m && styles.chipTextOn]}>{m === "recent" ? "Newest" : "A–Z"}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {shown.length === 0 ? <Text style={[styles.emptyText, { marginTop: Spacing.lg }]}>{`No exercises match "${query}".`}</Text> : null}

          {shown.map((e, idx) => (
            <Card key={e.name} snow={idx === 0} style={styles.exerciseCard}>
              <Pressable
                onPress={() => {
                  tapFeedback();
                  router.push({ pathname: "/exercise-detail", params: { name: e.name } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${e.name}, open details`}
                style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.8 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.exerciseSub}>Latest record {formatShortDate(e.latest)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textMuted} />
              </Pressable>
              <View style={styles.tiles}>
                {e.records.map((r) => (
                  <View key={r.type} style={styles.tile}>
                    <Text style={styles.tileLabel}>{TILE_LABEL[r.type]}</Text>
                    <Text style={styles.tileValue}>{r.value}</Text>
                    <Text style={styles.tileDate}>{formatShortDate(r.date)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    emptyText: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    search: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: Color.surface1 },
    searchInput: { flex: 1, fontSize: 16, color: Color.textPrimary, paddingVertical: 10 },
    sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.md, marginBottom: Spacing.md },
    count: { fontSize: 14, color: Color.textMuted },
    chips: { flexDirection: "row", gap: 8 },
    chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface1 },
    chipOn: { backgroundColor: Color.textPrimary },
    chipText: { fontSize: 14, color: Color.textMuted, fontWeight: "500" },
    chipTextOn: { color: Color.bg0 },
    exerciseCard: { padding: 0, marginBottom: Spacing.md, overflow: "hidden" },
    cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: 16, paddingBottom: 10 },
    exerciseName: { fontSize: 17, fontWeight: "600", color: Color.textPrimary },
    exerciseSub: { fontSize: 13, color: Color.textFaint, marginTop: 2 },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
    tile: { width: "48.5%", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Color.surface2 },
    tileLabel: { fontSize: 12, color: Color.textMuted },
    tileValue: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
    tileDate: { fontSize: 12, color: Color.textFaint, marginTop: 2 },
  })
);

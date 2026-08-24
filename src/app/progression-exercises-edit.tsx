import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useUpdatePinnedProgressionExercises } from "@/lib/queries/progression-pins";
import { useExerciseLibrary } from "@/lib/queries/exercise-library";
import { useWorkouts } from "@/lib/queries/workouts";

const MAX_PINNED = 3;

// Search-to-add picker for the Progression chart's quick-view chips —
// unlike personal-bests-edit.tsx, the pinnable list is the FULL exercise
// library (not just exercises with a logged PB), since a member may want
// to quick-view progress on something they've only just started logging or
// haven't logged yet at all. Exercises the member has actually logged
// surface first so the common case (pin something you've been training) is
// still a short scroll.
export default function ProgressionExercisesEditScreen() {
  const router = useRouter();
  const { data: workouts, isLoading: workoutsLoading } = useWorkouts();
  const { data: library, isLoading: libraryLoading } = useExerciseLibrary();
  const updatePinned = useUpdatePinnedProgressionExercises();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[] | null>(null);

  const picked = useMemo(() => selected ?? workouts?.pinnedProgressionExercises ?? [], [selected, workouts]);
  const pickedLower = useMemo(() => new Set(picked.map((n) => n.toLowerCase())), [picked]);

  const loggedNames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of workouts?.sessions ?? []) {
      for (const ex of s.exercises) {
        const key = ex.name.trim().toLowerCase();
        if (key && !seen.has(key)) seen.set(key, ex.name.trim());
      }
    }
    return seen;
  }, [workouts]);

  const results = useMemo(() => {
    const all = library?.exercises ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
    return [...filtered].sort((a, b) => {
      const aLogged = loggedNames.has(a.name.toLowerCase());
      const bLogged = loggedNames.has(b.name.toLowerCase());
      if (aLogged !== bLogged) return aLogged ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [library, query, loggedNames]);

  const isLoading = workoutsLoading || libraryLoading;

  function toggle(name: string) {
    const lower = name.toLowerCase();
    tapFeedback();
    if (pickedLower.has(lower)) {
      setSelected(picked.filter((n) => n.toLowerCase() !== lower));
    } else if (picked.length < MAX_PINNED) {
      setSelected([...picked, name]);
    }
  }

  function handleSave() {
    updatePinned.mutate(picked, { onSuccess: () => router.back() });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Progression</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : (
        <>
          <View style={styles.introBlock}>
            <Text style={styles.introText}>Choose up to {MAX_PINNED} exercises to quick-view on your Workouts tab.</Text>
            <Text style={styles.countText}>
              {picked.length}/{MAX_PINNED} selected
            </Text>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={Color.textFaint} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search any exercise"
              placeholderTextColor={Color.textFaint}
              style={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {results.length === 0 ? (
              <View style={styles.centerFill}>
                <Text style={styles.emptyText}>No exercises match that search.</Text>
              </View>
            ) : (
              <Card style={styles.list}>
                {results.map((ex, idx) => {
                  const isPicked = pickedLower.has(ex.name.toLowerCase());
                  const disabled = !isPicked && picked.length >= MAX_PINNED;
                  const hasLogged = loggedNames.has(ex.name.toLowerCase());
                  return (
                    <Pressable
                      key={ex.id}
                      onPress={() => toggle(ex.name)}
                      disabled={disabled}
                      style={[styles.row, idx > 0 && styles.rowDivider, disabled && styles.rowDisabled]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{ex.name}</Text>
                        <Text style={styles.rowSub}>{hasLogged ? "Logged before" : (ex.bodyPart ?? "")}</Text>
                      </View>
                      <View style={[styles.checkbox, isPicked && styles.checkboxChecked]}>
                        {isPicked ? <Ionicons name="checkmark" size={14} color={Color.goldForeground} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Save" onPress={handleSave} loading={updatePinned.isPending} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center" },
  introBlock: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  introText: { fontSize: 13, color: Color.textSecondary },
  countText: { fontSize: 11, fontWeight: "600", color: Color.gold, marginTop: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  list: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, gap: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowDisabled: { opacity: 0.4 },
  rowName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  rowSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Color.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: Color.gold, backgroundColor: Color.gold },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
});

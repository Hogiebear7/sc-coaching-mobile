import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useExerciseLibrary, type ExerciseLibraryRecord } from "@/lib/queries/exercise-library";

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useExerciseLibrary();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const exercises = data?.exercises ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [data, query]);

  function renderItem({ item }: { item: ExerciseLibraryRecord }) {
    const meta = [item.bodyPart, item.equipment].filter(Boolean).join(" · ");
    return (
      <Pressable
        onPress={() => router.push({ pathname: "/exercise-library-detail", params: { slug: item.slug } })}
        style={styles.row}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Exercise Library</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Color.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises…"
          placeholderTextColor={Color.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load the exercise library.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="barbell-outline" size={28} color={Color.textFaint} />
          <Text style={styles.emptyTitle}>
            {(data?.exercises.length ?? 0) === 0 ? "No exercises yet" : "No matches"}
          </Text>
          <Text style={styles.emptyBody}>
            {(data?.exercises.length ?? 0) === 0
              ? "Your coach is still building out the demonstration library."
              : "Try a different search."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.xs },
  errorText: { color: Color.textMuted, fontSize: 14 },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
  emptyBody: { fontSize: 12, color: Color.textMuted, textAlign: "center", maxWidth: 260 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  separator: { height: 1, backgroundColor: Color.borderSubtle },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, gap: Spacing.sm },
  rowTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  rowMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2, textTransform: "capitalize" },
});

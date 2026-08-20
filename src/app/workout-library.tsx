import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { exerciseMatchesEquipmentSlugs } from "@/lib/equipment-matching";
import { useExerciseLibrary, type ExerciseLibraryRecord } from "@/lib/queries/exercise-library";
import { useEquipmentCatalog, useGymProfiles } from "@/lib/queries/gym-profiles";
import { useWorkoutTemplates, type WorkoutTemplate } from "@/lib/queries/workout-templates";

type LibraryTab = "exercises" | "workouts";

function TemplateCard({ template, onPress, onStart }: { template: WorkoutTemplate; onPress: () => void; onStart: () => void }) {
  return (
    <Card style={styles.templateCard}>
      <Pressable onPress={onPress}>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templatePreview} numberOfLines={2}>
          {template.exercises.map((e) => e.name).join(", ")}
        </Text>
        <Text style={styles.templateCount}>
          {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"}
        </Text>
      </Pressable>
      <Button title="Start" onPress={onStart} variant="secondary" style={{ marginTop: Spacing.sm }} />
    </Card>
  );
}

function WorkoutsTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const { data: templates, isLoading, isError, refetch } = useWorkoutTemplates();
  const active = (templates ?? []).filter((t) => !t.archivedAt);

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Color.gold} size="large" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Couldn&apos;t load your library.</Text>
        <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => router.push("/workout-generator")} style={styles.generatorBanner}>
        <View style={styles.generatorBannerIcon}>
          <Ionicons name="sparkles-outline" size={18} color={Color.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.generatorBannerTitle}>Generate a workout</Text>
          <Text style={styles.generatorBannerSub}>Pick muscles, time, and equipment — we&apos;ll build it</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
      </Pressable>

      {active.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="albums-outline" size={22} color={Color.textFaint} />
          <Text style={styles.emptyText}>No saved workouts yet.</Text>
          <Text style={styles.emptySub}>Build one once, reuse it every time you train that split.</Text>
          <Button
            title="New workout"
            onPress={() => router.push("/workout-template-builder")}
            variant="secondary"
            style={{ marginTop: Spacing.sm }}
          />
        </Card>
      ) : (
        active.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onPress={() => router.push({ pathname: "/workout-template-builder", params: { templateId: t.id } })}
            onStart={() => router.push({ pathname: "/log-workout", params: { templateId: t.id, title: t.name } })}
          />
        ))
      )}
    </ScrollView>
  );
}

function ExercisesTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const { data, isLoading, isError, refetch } = useExerciseLibrary();
  const { data: gymProfilesData } = useGymProfiles();
  const { data: equipmentCatalogData } = useEquipmentCatalog();
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [showAllEquipment, setShowAllEquipment] = useState(false);

  const activeProfile = gymProfilesData?.profiles.find((p) => p.id === gymProfilesData.activeGymProfileId) ?? null;
  const equipmentFilterActive = !!activeProfile && !showAllEquipment;

  const filtered = useMemo(() => {
    const exercises = data?.exercises ?? [];
    const q = query.trim().toLowerCase();
    const catalog = equipmentCatalogData?.equipment ?? [];
    return exercises.filter((e) => {
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.aliases.some((a) => a.toLowerCase().includes(q))) return false;
      if (equipmentFilterActive && activeProfile) {
        if (!exerciseMatchesEquipmentSlugs(e.equipment, activeProfile.equipmentSlugs, catalog)) return false;
      }
      return true;
    });
  }, [data, query, bodyPart, equipmentFilterActive, activeProfile, equipmentCatalogData]);

  function renderItem({ item }: { item: ExerciseLibraryRecord }) {
    const meta = [item.bodyPart, item.equipment].filter(Boolean).join(" · ");
    return (
      <Pressable
        onPress={() => router.push({ pathname: "/exercise-library-detail", params: { slug: item.slug } })}
        style={styles.exerciseRow}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          {meta ? <Text style={styles.exerciseMeta}>{meta}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
      </Pressable>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Color.gold} size="large" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Couldn&apos;t load the exercise library.</Text>
        <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
      </View>
    );
  }

  return (
    <>
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

      {activeProfile ? (
        <Pressable onPress={() => setShowAllEquipment((v) => !v)} style={styles.equipmentFilterRow}>
          <Ionicons name={equipmentFilterActive ? "barbell" : "barbell-outline"} size={13} color={equipmentFilterActive ? Color.gold : Color.textFaint} />
          <Text style={styles.equipmentFilterText}>
            {equipmentFilterActive
              ? `Filtered to ${activeProfile.icon ?? ""} ${activeProfile.name}`.trim()
              : "Showing all exercises"}
          </Text>
          <Text style={styles.equipmentFilterAction}>{equipmentFilterActive ? "Show all" : "Only what I have"}</Text>
        </Pressable>
      ) : null}

      {data && data.filters.bodyParts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bodyPartRow}
          style={styles.bodyPartScroll}
        >
          <Pressable onPress={() => setBodyPart(null)} style={[styles.bodyPartChip, bodyPart === null && styles.bodyPartChipActive]}>
            <Text style={[styles.bodyPartChipText, bodyPart === null && styles.bodyPartChipTextActive]}>All</Text>
          </Pressable>
          {data.filters.bodyParts.map((bp) => (
            <Pressable
              key={bp}
              onPress={() => setBodyPart(bp === bodyPart ? null : bp)}
              style={[styles.bodyPartChip, bodyPart === bp && styles.bodyPartChipActive]}
            >
              <Text style={[styles.bodyPartChipText, bodyPart === bp && styles.bodyPartChipTextActive]}>{bp}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {filtered.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="barbell-outline" size={28} color={Color.textFaint} />
          <Text style={styles.emptyText}>{(data?.exercises.length ?? 0) === 0 ? "No exercises yet" : "No matches"}</Text>
          <Text style={styles.emptySub}>
            {(data?.exercises.length ?? 0) === 0
              ? "Your coach is still building out the demonstration library."
              : equipmentFilterActive
                ? "Nothing matches your search within your active gym profile's equipment."
                : "Try a different search or muscle area."}
          </Text>
          {equipmentFilterActive ? (
            <Button
              title="Show all exercises"
              onPress={() => setShowAllEquipment(true)}
              variant="secondary"
              style={{ marginTop: Spacing.sm }}
            />
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.scroll}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );
}

export default function WorkoutLibraryScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<LibraryTab>(initialTab === "exercises" ? "exercises" : "workouts");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Library</Text>
        {tab === "workouts" ? (
          <Pressable onPress={() => router.push("/workout-template-builder")} hitSlop={12} style={styles.addButton}>
            <Ionicons name="add" size={22} color={Color.gold} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("exercises")} style={[styles.tabButton, tab === "exercises" && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, tab === "exercises" && styles.tabButtonTextActive]}>Exercises</Text>
        </Pressable>
        <Pressable onPress={() => setTab("workouts")} style={[styles.tabButton, tab === "workouts" && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, tab === "workouts" && styles.tabButtonTextActive]}>My Workouts</Text>
        </Pressable>
      </View>

      {tab === "exercises" ? <ExercisesTab router={router} /> : <WorkoutsTab router={router} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  addButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  tabButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: "center" },
  tabButtonActive: { backgroundColor: Color.surface2 },
  tabButtonText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  tabButtonTextActive: { color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.xs },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: 4 },
  emptyText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginTop: Spacing.xs },
  emptySub: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
  generatorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  generatorBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface1,
  },
  generatorBannerTitle: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
  generatorBannerSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  templateCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  templateName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  templatePreview: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  templateCount: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
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
  equipmentFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  equipmentFilterText: { flex: 1, fontSize: 11, color: Color.textMuted },
  equipmentFilterAction: { fontSize: 11, fontWeight: "600", color: Color.gold },
  bodyPartScroll: { flexGrow: 0, marginBottom: Spacing.sm },
  bodyPartRow: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  bodyPartChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  bodyPartChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  bodyPartChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted, textTransform: "capitalize" },
  bodyPartChipTextActive: { color: Color.gold },
  separator: { height: 1, backgroundColor: Color.borderSubtle },
  exerciseRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, gap: Spacing.sm },
  exerciseName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  exerciseMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2, textTransform: "capitalize" },
});

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useStaffClassCategories, useStaffWorkoutTemplates, type StaffWorkoutTemplate } from "@/lib/queries/staff";

function TemplateCard({
  template,
  categoryLabel,
  onPress,
}: {
  template: StaffWorkoutTemplate;
  categoryLabel: (slug: string) => string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.templateCard}>
        <Text style={styles.templateName}>{template.name}</Text>
        {template.categories.length > 0 ? (
          <View style={styles.categoryRow}>
            {template.categories.map((slug) => (
              <View key={slug} style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{categoryLabel(slug)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.templatePreview} numberOfLines={2}>
          {template.exercises.map((e) => e.name).join(", ")}
        </Text>
        <Text style={styles.templateCount}>
          {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"}
        </Text>
      </Card>
    </Pressable>
  );
}

export default function StaffWorkoutsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffWorkoutTemplates();
  const { data: categories } = useStaffClassCategories();

  function categoryLabel(slug: string): string {
    return categories?.find((c) => c.slug === slug)?.name ?? slug;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workouts</Text>
        <Pressable onPress={() => router.push("/staff-workout-template-builder")} hitSlop={12} style={styles.addButton}>
          <Ionicons name="add" size={22} color={Color.gold} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your workout library.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          <Text style={styles.introText}>
            Build reusable class templates here, then load one straight into any upcoming class instead
            of starting from scratch.
          </Text>

          {data.templates.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={22} color={Color.textFaint} />
              <Text style={styles.emptyText}>No templates yet.</Text>
              <Text style={styles.emptySub}>Build one once, reuse it for every class in that category.</Text>
              <Button
                title="New template"
                onPress={() => router.push("/staff-workout-template-builder")}
                variant="secondary"
                style={{ marginTop: Spacing.sm }}
              />
            </Card>
          ) : (
            data.templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                categoryLabel={categoryLabel}
                onPress={() => router.push({ pathname: "/staff-workout-template-builder", params: { templateId: t.id } })}
              />
            ))
          )}
        </ScrollView>
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
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  addButton: { padding: 4 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.xs },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  introText: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md, lineHeight: 17 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: 4 },
  emptyText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginTop: Spacing.xs },
  emptySub: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
  templateCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  templateName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  categoryChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: Color.textMuted },
  templatePreview: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs },
  templateCount: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
});

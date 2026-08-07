import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { useWorkoutTemplates, type WorkoutTemplate } from "@/lib/queries/workout-templates";

function TemplateCard({ template, onPress, onStart }: { template: WorkoutTemplate; onPress: () => void; onStart: () => void }) {
  return (
    <Card style={styles.card}>
      <Pressable onPress={onPress}>
        <Text style={styles.name}>{template.name}</Text>
        <Text style={styles.preview} numberOfLines={2}>
          {template.exercises.map((e) => e.name).join(", ")}
        </Text>
        <Text style={styles.count}>
          {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"}
        </Text>
      </Pressable>
      <Button title="Start" onPress={onStart} variant="secondary" style={{ marginTop: Spacing.sm }} />
    </Card>
  );
}

export default function WorkoutLibraryScreen() {
  const router = useRouter();
  const { data: templates, isLoading, isError, refetch } = useWorkoutTemplates();
  const active = (templates ?? []).filter((t) => !t.archivedAt);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout Library</Text>
        <Pressable onPress={() => router.push("/workout-template-builder")} hitSlop={12} style={styles.addButton}>
          <Ionicons name="add" size={22} color={Color.gold} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load your library.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  addButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  name: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  preview: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  count: { fontSize: 11, color: Color.textFaint, marginTop: 4 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: 4 },
  emptyText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary, marginTop: Spacing.xs },
  emptySub: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
});

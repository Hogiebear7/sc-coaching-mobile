import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useMyArchivedPrograms } from "@/lib/queries/programs";
import { useDeleteWorkoutTemplate, useUpdateWorkoutTemplate, useWorkoutTemplates } from "@/lib/queries/workout-templates";

export default function WorkoutArchiveScreen() {
  const router = useRouter();
  const { data: programs, isLoading: programsLoading } = useMyArchivedPrograms();
  const { data: templates, isLoading: templatesLoading } = useWorkoutTemplates();
  const restoreTemplate = useUpdateWorkoutTemplate();
  const deleteTemplate = useDeleteWorkoutTemplate();

  const archivedTemplates = (templates ?? []).filter((t) => t.archivedAt);

  function handleRestore(id: string, name: string, exercises: typeof archivedTemplates[number]["exercises"]) {
    tapFeedback();
    restoreTemplate.mutate({ id, name, exercises, archived: false });
  }

  function handleDeleteForever(id: string, name: string) {
    Alert.alert("Delete permanently?", `"${name}" will be gone for good.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTemplate.mutate(id) },
    ]);
  }

  const loading = programsLoading || templatesLoading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Archive</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>PAST PROGRAMS</Text>
          {!programs || programs.length === 0 ? (
            <Text style={styles.emptyText}>No archived programs yet.</Text>
          ) : (
            programs.map((p) => (
              <Card key={p.id} style={styles.card}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.sub}>
                  {p.days.length} day{p.days.length === 1 ? "" : "s"} · {p.days.map((d) => d.label).join(", ")}
                </Text>
              </Card>
            ))
          )}

          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>RETIRED WORKOUTS</Text>
          {archivedTemplates.length === 0 ? (
            <Text style={styles.emptyText}>No retired workouts yet.</Text>
          ) : (
            archivedTemplates.map((t) => (
              <Card key={t.id} style={styles.card}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {t.exercises.map((e) => e.name).join(", ")}
                </Text>
                <View style={styles.actionsRow}>
                  <Button title="Restore" variant="secondary" onPress={() => handleRestore(t.id, t.name, t.exercises)} style={{ flex: 1 }} />
                  <Pressable onPress={() => handleDeleteForever(t.id, t.name)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  emptyText: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md },
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  name: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  sub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  deleteButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.dangerWeak },
  deleteText: { fontSize: 12, fontWeight: "600", color: Color.danger },
});

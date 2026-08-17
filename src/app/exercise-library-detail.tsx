import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { pickHeroMedia, useExerciseLibraryDetail } from "@/lib/queries/exercise-library";

function GifSlot({ url, name }: { url: string | null; name: string }) {
  const [loaded, setLoaded] = useState(false);

  if (!url) {
    return (
      <View style={[styles.gifWrap, styles.gifPlaceholder]}>
        <Ionicons name="barbell-outline" size={32} color={Color.textFaint} />
        <Text style={styles.gifPlaceholderText}>No demonstration yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.gifWrap}>
      {!loaded ? (
        <View style={[styles.gifWrap, styles.gifPlaceholder, StyleSheet.absoluteFill]}>
          <ActivityIndicator color={Color.gold} />
        </View>
      ) : null}
      <Image
        source={{ uri: url }}
        accessibilityLabel={`${name} demonstration`}
        style={styles.gif}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

export default function ExerciseLibraryDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { data, isLoading, isError, refetch } = useExerciseLibraryDetail(slug ?? "");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data?.exercise.name ?? "Exercise"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load this exercise.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <GifSlot url={pickHeroMedia(data.media)?.url ?? null} name={data.exercise.name} />

          <View style={styles.chipRow}>
            {data.exercise.bodyPart ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.exercise.bodyPart}</Text>
              </View>
            ) : null}
            {data.exercise.equipment ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.exercise.equipment}</Text>
              </View>
            ) : null}
            {data.exercise.difficulty ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.exercise.difficulty}</Text>
              </View>
            ) : null}
          </View>

          {data.exercise.description ? (
            <Text style={styles.description}>{data.exercise.description}</Text>
          ) : null}

          {data.exercise.instructions.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>HOW TO</Text>
              <Card style={styles.instructionsCard}>
                {data.exercise.instructions.map((step, idx) => (
                  <View key={idx} style={[styles.stepRow, idx > 0 && styles.stepDivider]}>
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {data.exercise.targetMuscle || data.exercise.secondaryMuscles.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>MUSCLES WORKED</Text>
              <Card style={styles.musclesCard}>
                {data.exercise.targetMuscle ? (
                  <Text style={styles.muscleText}>
                    <Text style={styles.muscleLabel}>Primary: </Text>
                    {data.exercise.targetMuscle}
                  </Text>
                ) : null}
                {data.exercise.secondaryMuscles.length > 0 ? (
                  <Text style={[styles.muscleText, { marginTop: 4 }]}>
                    <Text style={styles.muscleLabel}>Secondary: </Text>
                    {data.exercise.secondaryMuscles.join(", ")}
                  </Text>
                ) : null}
              </Card>
            </>
          ) : null}
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
  backButton: { padding: 4 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: Color.textPrimary, marginHorizontal: Spacing.sm },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  gifWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Color.surface1,
  },
  gif: { width: "100%", height: "100%" },
  gifPlaceholder: { alignItems: "center", justifyContent: "center", gap: Spacing.xs },
  gifPlaceholderText: { fontSize: 12, color: Color.textFaint },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.md },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: "600", color: Color.gold, textTransform: "capitalize" },
  description: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginTop: Spacing.md },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  instructionsCard: { padding: 0, overflow: "hidden" },
  stepRow: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  stepDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  stepNumber: { fontSize: 12, fontWeight: "700", color: Color.gold, width: 18 },
  stepText: { flex: 1, fontSize: 13, color: Color.textSecondary, lineHeight: 19 },
  musclesCard: { padding: Spacing.md },
  muscleText: { fontSize: 13, color: Color.textSecondary, textTransform: "capitalize" },
  muscleLabel: { fontWeight: "700", color: Color.textPrimary },
});

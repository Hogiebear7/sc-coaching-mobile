import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Body, { type ExtendedBodyPart, type Slug } from "react-native-body-highlighter";

import { Color, Radius, Spacing } from "@/constants/theme";
import type { SetLevelTier, StrengthSection } from "@/lib/workout-set-levels";

// Real anatomical silhouette (react-native-body-highlighter) — the same
// package and figure BodyDiagram.tsx uses for the workout generator's
// muscle picker — instead of the earlier hand-drawn geometric-block pair.
// Coarser than that picker's 9 filterable zones: here every real slug maps
// onto one of the five tracked StrengthSections so the whole figure can be
// graded by training-volume tier rather than tapped in/out.
const SECTION_FOR_SLUG: Partial<Record<Slug, StrengthSection>> = {
  // Upper push — chest/shoulder/triceps-dominant pressing
  chest: "upper_push",
  deltoids: "upper_push",
  triceps: "upper_push",
  // Upper pull — back/biceps-dominant pulling
  trapezius: "upper_pull",
  "upper-back": "upper_pull",
  "lower-back": "upper_pull",
  biceps: "upper_pull",
  forearm: "upper_pull",
  // Lower push — quad/calf-dominant, anterior chain
  quadriceps: "lower_push",
  calves: "lower_push",
  // Lower pull — hamstring/glute-dominant, posterior chain / hip hinge
  hamstring: "lower_pull",
  gluteal: "lower_pull",
  adductors: "lower_pull",
  // Core
  abs: "core",
  obliques: "core",
  // tibialis, neck, and the decorative parts (hair/head/hands/feet/ankles/
  // knees) are left unmapped — always rendered at the muted default fill,
  // same as BodyDiagram's decorative parts.
};

const TIER_ALPHA_HEX: Record<Exclude<SetLevelTier, "none">, string> = {
  low: "61", // ~0.38
  moderate: "ad", // ~0.68
  high: "", // full opacity — no suffix needed
};

const MUTED_FILL = Color.surface2;

// Same width-driven scale as BodyDiagram.tsx, capped a little lower since
// this figure sits inside a card with a legend and section list below it
// rather than owning the full screen.
const NATIVE_W = 200;
const HORIZONTAL_INSET = 64;

export function MuscleSetLevelDiagram({
  levels,
  sex = "male",
}: {
  levels: Record<StrengthSection, { tier: SetLevelTier }>;
  sex?: "male" | "female";
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max((width - HORIZONTAL_INSET) / NATIVE_W, 1.2), 1.9);

  const data: ExtendedBodyPart[] = (Object.keys(SECTION_FOR_SLUG) as Slug[]).map((slug) => {
    const section = SECTION_FOR_SLUG[slug]!;
    const tier = levels[section].tier;
    const color = tier === "none" ? MUTED_FILL : `${Color.accentData}${TIER_ALPHA_HEX[tier]}`;
    return { slug, color };
  });

  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.segmentGroup} accessibilityRole="tablist" accessibilityLabel="Body view">
        <Pressable
          onPress={() => setView("front")}
          style={[styles.segment, view === "front" && styles.segmentActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === "front" }}
          accessibilityLabel="Show front of body"
        >
          <Text style={[styles.segmentText, view === "front" && styles.segmentTextActive]}>Front</Text>
        </Pressable>
        <Pressable
          onPress={() => setView("back")}
          style={[styles.segment, view === "back" && styles.segmentActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === "back" }}
          accessibilityLabel="Show back of body"
        >
          <Text style={[styles.segmentText, view === "back" && styles.segmentTextActive]}>Back</Text>
        </Pressable>
      </View>

      <View
        style={{ marginTop: Spacing.md }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Muscle set-level diagram, ${view} view.`}
      >
        <Body data={data} gender={sex} side={view} scale={scale} border={Color.borderSubtle} defaultFill={MUTED_FILL} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentGroup: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.bg0,
  },
  segment: { minWidth: 64, alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Color.surface2 },
  segmentText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  segmentTextActive: { color: Color.textPrimary },
});

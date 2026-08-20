import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BodyDiagram } from "@/components/ui/BodyDiagram";
import { Button } from "@/components/ui/Button";
import { EquipmentPicker } from "@/components/ui/EquipmentPicker";
import { Color, Radius, Spacing } from "@/constants/theme";
import { CARDIO_VENDOR_VALUE, findBodyZone, vendorValuesPresentForZone, type BodyZoneKey } from "@/lib/body-zones";
import { equipmentSlugMatchesVendorString } from "@/lib/equipment-matching";
import { tapFeedback } from "@/lib/haptics";
import { useExerciseLibrary } from "@/lib/queries/exercise-library";
import { useEquipmentCatalog, useGymProfiles } from "@/lib/queries/gym-profiles";
import { useProfile } from "@/lib/queries/profile";
import { generateWorkout } from "@/lib/workout-generator";

const TIME_PRESETS = [15, 30, 45, 60, 90];

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onToggle(opt)} style={[styles.chip, selected.has(opt) && styles.chipActive]}>
          <Text style={[styles.chipText, selected.has(opt) && styles.chipTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function WorkoutGeneratorScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useExerciseLibrary();
  const { data: gymProfilesData } = useGymProfiles();
  const { data: equipmentCatalogData } = useEquipmentCatalog();
  const { data: profileData } = useProfile();

  const [primaryBodyParts, setPrimaryBodyParts] = useState<Set<string>>(new Set());
  const [secondaryBodyParts, setSecondaryBodyParts] = useState<Set<string>>(new Set());
  const [bodyMode, setBodyMode] = useState<"primary" | "secondary">("primary");
  const [view, setView] = useState<"front" | "back">("front");
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);

  const [equipmentSlugs, setEquipmentSlugs] = useState<string[]>([]);
  const [selectedGymProfileId, setSelectedGymProfileId] = useState<string | null>(null);
  const [showEquipmentEditor, setShowEquipmentEditor] = useState(false);
  const [equipmentHydrated, setEquipmentHydrated] = useState(false);

  // Defaults equipment from the member's active gym profile once data's
  // ready, instead of making them re-pick every visit — still fully
  // editable afterward, and switching profiles or tapping "edit equipment
  // for this workout" only ever affects this one generation.
  useEffect(() => {
    if (equipmentHydrated || gymProfilesData === undefined) return;
    const active = gymProfilesData.profiles.find((p) => p.id === gymProfilesData.activeGymProfileId);
    if (active) {
      setSelectedGymProfileId(active.id);
      setEquipmentSlugs(active.equipmentSlugs);
    }
    setEquipmentHydrated(true);
  }, [gymProfilesData, equipmentHydrated]);

  const diagramSex: "male" | "female" = profileData?.gender === "Female" ? "female" : "male";

  function isZoneAvailable(key: BodyZoneKey): boolean {
    const zone = findBodyZone(key);
    if (!zone || !data) return false;
    return vendorValuesPresentForZone(zone, data.filters.bodyParts).length > 0;
  }

  function isZoneSelected(key: BodyZoneKey): boolean {
    const zone = findBodyZone(key);
    if (!zone) return false;
    return zone.vendorValues.some((v) => primaryBodyParts.has(v) || secondaryBodyParts.has(v));
  }

  function handleZoneToggle(key: BodyZoneKey) {
    const zone = findBodyZone(key);
    if (!zone || !data) return;
    const vendorValues = vendorValuesPresentForZone(zone, data.filters.bodyParts);
    if (vendorValues.length === 0) return;
    tapFeedback();
    const setter = bodyMode === "primary" ? setPrimaryBodyParts : setSecondaryBodyParts;
    setter((prev) => {
      const next = new Set(prev);
      const anySelected = vendorValues.some((v) => next.has(v));
      for (const v of vendorValues) {
        if (anySelected) next.delete(v);
        else next.add(v);
      }
      return next;
    });
  }

  const cardioAvailable = (data?.filters.bodyParts ?? []).some((v) => v.toLowerCase() === CARDIO_VENDOR_VALUE);
  const cardioSelected = primaryBodyParts.has(CARDIO_VENDOR_VALUE) || secondaryBodyParts.has(CARDIO_VENDOR_VALUE);
  function toggleCardio() {
    tapFeedback();
    const setter = bodyMode === "primary" ? setPrimaryBodyParts : setSecondaryBodyParts;
    setter((prev) => toggleInSet(prev, CARDIO_VENDOR_VALUE));
  }

  const selectedProfile = gymProfilesData?.profiles.find((p) => p.id === selectedGymProfileId) ?? null;

  function selectProfile(profileId: string, slugs: string[]) {
    tapFeedback();
    setSelectedGymProfileId(profileId);
    setEquipmentSlugs(slugs);
  }

  function toggleEquipmentSlug(slug: string) {
    setEquipmentSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    // Manual edits are a one-off mix, no longer exactly matching whichever
    // saved profile was selected — clear the highlight so it doesn't
    // misleadingly claim to still be "that" profile.
    setSelectedGymProfileId(null);
  }

  function handleGenerate() {
    if (!data || primaryBodyParts.size === 0) {
      setError("Pick at least one primary muscle area.");
      return;
    }
    setError(null);

    const equipmentCatalogItems = (equipmentCatalogData?.equipment ?? []).filter((e) => equipmentSlugs.includes(e.slug));
    const equipmentVendorValues = data.filters.equipment.filter((v) =>
      equipmentCatalogItems.some((item) => equipmentSlugMatchesVendorString(item, v))
    );

    const exercises = generateWorkout({
      exercises: data.exercises,
      primaryBodyParts: [...primaryBodyParts],
      secondaryBodyParts: [...secondaryBodyParts],
      equipment: equipmentVendorValues,
      timeMinutes,
    });

    if (exercises.length === 0) {
      setError("No matching exercises for that combination — try a different muscle area or equipment.");
      return;
    }

    router.push({
      pathname: "/log-workout",
      params: {
        title: "Generated Workout",
        generatedExercises: JSON.stringify(exercises),
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Generate a Workout</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load the exercise library.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>MUSCLE AREAS</Text>
          <Text style={styles.sectionSub}>Tap the body to pick where to focus.</Text>

          <View style={styles.diagramControlsRow}>
            <View style={styles.segmentGroup}>
              <Pressable onPress={() => setView("front")} style={[styles.segment, view === "front" && styles.segmentActive]}>
                <Text style={[styles.segmentText, view === "front" && styles.segmentTextActive]}>Front</Text>
              </Pressable>
              <Pressable onPress={() => setView("back")} style={[styles.segment, view === "back" && styles.segmentActive]}>
                <Text style={[styles.segmentText, view === "back" && styles.segmentTextActive]}>Back</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setBodyMode((m) => (m === "primary" ? "secondary" : "primary"))}
              style={[styles.modeToggle, bodyMode === "secondary" && styles.modeToggleActive]}
            >
              <Ionicons name="add-circle-outline" size={13} color={bodyMode === "secondary" ? Color.gold : Color.textMuted} />
              <Text style={[styles.modeToggleText, bodyMode === "secondary" && styles.modeToggleTextActive]}>
                {bodyMode === "primary" ? "Tapping: Primary" : "Tapping: Secondary"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.diagramWrap}>
            <BodyDiagram
              view={view}
              sex={diagramSex}
              isZoneSelected={isZoneSelected}
              isZoneAvailable={isZoneAvailable}
              onToggleZone={handleZoneToggle}
            />
          </View>

          {cardioAvailable ? (
            <Pressable onPress={toggleCardio} style={[styles.cardioChip, cardioSelected && styles.cardioChipActive]}>
              <Ionicons name="heart-outline" size={14} color={cardioSelected ? Color.gold : Color.textMuted} />
              <Text style={[styles.cardioChipText, cardioSelected && styles.cardioChipTextActive]}>
                Cardio {bodyMode === "primary" ? "(primary)" : "(secondary)"}
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Selected — primary</Text>
          <ChipGroup
            options={data.filters.bodyParts}
            selected={primaryBodyParts}
            onToggle={(v) => setPrimaryBodyParts((prev) => toggleInSet(prev, v))}
          />

          <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Selected — secondary (optional)</Text>
          <ChipGroup
            options={data.filters.bodyParts}
            selected={secondaryBodyParts}
            onToggle={(v) => setSecondaryBodyParts((prev) => toggleInSet(prev, v))}
          />

          <Text style={styles.sectionLabel}>TIME AVAILABLE</Text>
          <View style={styles.chipRow}>
            {TIME_PRESETS.map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setTimeMinutes(mins)}
                style={[styles.chip, timeMinutes === mins && styles.chipActive]}
              >
                <Text style={[styles.chipText, timeMinutes === mins && styles.chipTextActive]}>{mins} min</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>EQUIPMENT AVAILABLE — OPTIONAL</Text>
          <Text style={styles.sectionSub}>
            {equipmentSlugs.length > 0
              ? `Using ${equipmentSlugs.length} item${equipmentSlugs.length === 1 ? "" : "s"}${selectedProfile ? ` from "${selectedProfile.name}"` : ""}.`
              : "Leave blank to allow any equipment."}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileRow}>
            {(gymProfilesData?.profiles ?? []).map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => selectProfile(profile.id, profile.equipmentSlugs)}
                style={[styles.profileChip, selectedGymProfileId === profile.id && styles.profileChipActive]}
              >
                <Text style={styles.profileChipIcon}>{profile.icon ?? "🏋️"}</Text>
                <Text style={[styles.profileChipText, selectedGymProfileId === profile.id && styles.profileChipTextActive]}>
                  {profile.name}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push("/gym-profile-builder")} style={styles.addProfileChip}>
              <Ionicons name="add" size={16} color={Color.gold} />
              <Text style={styles.addProfileChipText}>New profile</Text>
            </Pressable>
          </ScrollView>

          {(gymProfilesData?.profiles.length ?? 0) === 0 ? (
            <Text style={styles.emptyProfileHint}>
              No gym profiles yet — add one to skip re-picking equipment every time, or just pick it below for this
              workout only.
            </Text>
          ) : null}

          <Pressable onPress={() => setShowEquipmentEditor((v) => !v)} style={styles.editEquipmentRow}>
            <Ionicons name={showEquipmentEditor ? "chevron-up" : "chevron-down"} size={14} color={Color.textMuted} />
            <Text style={styles.editEquipmentText}>
              {selectedProfile ? "Edit equipment for this workout" : "Choose equipment for this workout"}
            </Text>
          </Pressable>

          {showEquipmentEditor ? (
            <EquipmentPicker catalog={equipmentCatalogData} selectedSlugs={equipmentSlugs} onToggle={toggleEquipmentSlug} />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Generate workout" onPress={handleGenerate} style={{ marginTop: Spacing.lg }} />
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginTop: Spacing.lg },
  sectionSub: { fontSize: 12, color: Color.textFaint, marginTop: 2, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: Color.textSecondary, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted, textTransform: "capitalize" },
  chipTextActive: { color: Color.gold },
  diagramControlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  segmentGroup: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  segment: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Color.surface2 },
  segmentText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  segmentTextActive: { color: Color.textPrimary },
  modeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  modeToggleActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  modeToggleText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  modeToggleTextActive: { color: Color.gold },
  diagramWrap: { alignItems: "center", paddingVertical: Spacing.sm },
  cardioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginTop: Spacing.xs,
  },
  cardioChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  cardioChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  cardioChipTextActive: { color: Color.gold },
  profileRow: { gap: Spacing.xs, paddingBottom: 2 },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  profileChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  profileChipIcon: { fontSize: 14 },
  profileChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  profileChipTextActive: { color: Color.gold },
  addProfileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  addProfileChipText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  emptyProfileHint: { fontSize: 11, color: Color.textFaint, marginTop: Spacing.xs, lineHeight: 15 },
  editEquipmentRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  editEquipmentText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
});

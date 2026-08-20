import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Android needs this opt-in for LayoutAnimation pre-Fabric; harmless no-op
// on the New Architecture and on iOS/web. Runs once at module load.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

import { BodyDiagram, type ZoneSelectionState } from "@/components/ui/BodyDiagram";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EquipmentPicker } from "@/components/ui/EquipmentPicker";
import { Color, Radius, Spacing } from "@/constants/theme";
import { CARDIO_VENDOR_VALUE, findBodyZone, vendorValuesPresentForZone, type BodyZoneKey } from "@/lib/body-zones";
import { equipmentSlugMatchesVendorString } from "@/lib/equipment-matching";
import { tapFeedback } from "@/lib/haptics";
import { humanizeZoneValue } from "@/lib/muscle-slug-map";
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

// Labels: the friendly anatomical name the member actually tapped (e.g.
// "Biceps"), recorded separately from the coarse filter value it maps to
// (see workout-generator's zoneLabels state) — falls back to a Title-Cased
// version of the raw filter value for chips added directly from the list
// rather than by tapping the diagram.
function ChipGroup({
  options,
  selected,
  labels,
  onToggle,
  variant = "primary",
}: {
  options: string[];
  selected: Set<string>;
  labels: Record<string, string>;
  onToggle: (value: string) => void;
  variant?: "primary" | "secondary";
}) {
  const activeStyle = variant === "primary" ? styles.chipActive : styles.chipActiveSecondary;
  const activeTextStyle = variant === "primary" ? styles.chipTextActive : styles.chipTextActiveSecondary;
  const dotColor = variant === "primary" ? Color.gold : Color.accentData;

  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected.has(opt);
        const label = labels[opt] ?? humanizeZoneValue(opt);
        return (
          <Pressable
            key={opt}
            onPress={() => onToggle(opt)}
            style={[styles.chip, active && activeStyle]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}${active ? ", selected. Double tap to remove." : ". Double tap to add."}`}
          >
            <Text style={[styles.chipText, active && activeTextStyle]}>{label}</Text>
            {active ? <Ionicons name="close" size={12} color={dotColor} style={{ marginLeft: 4 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// "2 selected · Chest, Shoulders" / "4 selected · Chest, Shoulders +2 more"
// / "None selected" — first two names always shown so the summary stays
// legible instead of running off the header.
function summarizeSelection(names: string[]): string {
  if (names.length === 0) return "None selected";
  const shown = names.slice(0, 2).join(", ");
  const extra = names.length > 2 ? ` +${names.length - 2} more` : "";
  return `${names.length} selected · ${shown}${extra}`;
}

// Collapsed by default — the header alone (title + live count + a
// same-breath name summary) is the primary feedback loop for "did my tap
// register", so the member never has to open this to know what's
// selected. Expanding is only for reviewing/removing. Only ever renders
// values that are actually selected — this is a summary, not the full
// picker (that's the "Select from list" fallback below it).
function SelectedMusclesSection({
  title,
  values,
  labels,
  variant,
  onRemove,
  emptyHint,
}: {
  title: string;
  values: string[];
  labels: Record<string, string>;
  variant: "primary" | "secondary";
  onRemove: (value: string) => void;
  emptyHint: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const names = values.map((v) => labels[v] ?? humanizeZoneValue(v));
  const dotColor = variant === "primary" ? Color.gold : Color.accentData;
  const activeChipStyle = variant === "primary" ? styles.chipActive : styles.chipActiveSecondary;
  const activeTextStyle = variant === "primary" ? styles.chipTextActive : styles.chipTextActiveSecondary;

  function toggleExpanded() {
    animateLayout();
    tapFeedback();
    setExpanded((e) => !e);
  }

  return (
    <View style={styles.summarySection}>
      <Pressable
        onPress={toggleExpanded}
        style={styles.summaryHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${values.length} selected${names.length > 0 ? `: ${names.join(", ")}` : ""}.`}
        accessibilityHint={expanded ? "Double tap to collapse" : "Double tap to expand and review"}
      >
        <View style={[styles.summaryDot, { backgroundColor: dotColor }]} />
        <Text style={styles.summaryHeaderText} numberOfLines={1}>
          <Text style={styles.summaryTitle}>{title}</Text>
          <Text style={styles.summaryMeta}> · {summarizeSelection(names)}</Text>
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Color.textFaint} />
      </Pressable>

      {expanded ? (
        values.length === 0 ? (
          <Text style={styles.summaryEmptyText}>{emptyHint}</Text>
        ) : (
          <View style={styles.summaryChipRow}>
            {values.map((v) => (
              <Pressable
                key={v}
                onPress={() => {
                  animateLayout();
                  onRemove(v);
                }}
                style={[styles.chip, activeChipStyle]}
                accessibilityRole="button"
                accessibilityLabel={`${labels[v] ?? humanizeZoneValue(v)}, selected. Double tap to remove.`}
              >
                <Text style={[styles.chipText, activeTextStyle]}>{labels[v] ?? humanizeZoneValue(v)}</Text>
                <Ionicons name="close" size={12} color={dotColor} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </View>
        )
      ) : null}
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
  // Friendly anatomical label per selected filter value (e.g.
  // "upper arms" -> "Biceps") — set whenever a diagram tap turns a value
  // on, cleared only once that value is deselected everywhere. Purely
  // display state; generation always reads the coarse filter values above.
  const [zoneLabels, setZoneLabels] = useState<Record<string, string>>({});
  const [bodyMode, setBodyMode] = useState<"primary" | "secondary">("primary");
  const [view, setView] = useState<"front" | "back">("front");
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);
  // Precision/accessibility fallback — the full option list, hidden by
  // default now that the collapsed summaries are the primary review
  // surface. Diagram taps and this list both write the same state.
  const [showFullList, setShowFullList] = useState(false);

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

  function zoneSelectionFor(key: BodyZoneKey): ZoneSelectionState {
    const zone = findBodyZone(key);
    if (!zone) return "none";
    const inPrimary = zone.vendorValues.some((v) => primaryBodyParts.has(v));
    const inSecondary = zone.vendorValues.some((v) => secondaryBodyParts.has(v));
    if (inPrimary && inSecondary) return "both";
    if (inPrimary) return "primary";
    if (inSecondary) return "secondary";
    return "none";
  }

  // label is the friendly anatomical name of whichever region was actually
  // tapped (e.g. "Biceps") — recorded into zoneLabels so the chip list can
  // show it, even though `key`/vendorValues are the coarser filter zone.
  function handleZoneToggle(key: BodyZoneKey, label: string) {
    const zone = findBodyZone(key);
    if (!zone || !data) return;
    const vendorValues = vendorValuesPresentForZone(zone, data.filters.bodyParts);
    if (vendorValues.length === 0) return;
    tapFeedback();
    animateLayout();

    const currentSet = bodyMode === "primary" ? primaryBodyParts : secondaryBodyParts;
    const otherSet = bodyMode === "primary" ? secondaryBodyParts : primaryBodyParts;
    const turningOn = !vendorValues.some((v) => currentSet.has(v));

    const setter = bodyMode === "primary" ? setPrimaryBodyParts : setSecondaryBodyParts;
    setter((prev) => {
      const next = new Set(prev);
      for (const v of vendorValues) {
        if (turningOn) next.add(v);
        else next.delete(v);
      }
      return next;
    });

    setZoneLabels((prev) => {
      const next = { ...prev };
      for (const v of vendorValues) {
        if (turningOn) next[v] = label;
        else if (!otherSet.has(v)) delete next[v];
      }
      return next;
    });
  }

  // For chips toggled directly (not via a diagram tap) — no anatomical
  // slug context here, so labels only ever get cleaned up, never set; the
  // ChipGroup falls back to humanizeZoneValue for anything without a
  // recorded label.
  function toggleBodyPartChip(mode: "primary" | "secondary", value: string) {
    animateLayout();
    const setter = mode === "primary" ? setPrimaryBodyParts : setSecondaryBodyParts;
    const otherSet = mode === "primary" ? secondaryBodyParts : primaryBodyParts;
    setter((prev) => toggleInSet(prev, value));
    if (!otherSet.has(value)) {
      setZoneLabels((prev) => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
    }
  }

  const cardioAvailable = (data?.filters.bodyParts ?? []).some((v) => v.toLowerCase() === CARDIO_VENDOR_VALUE);
  const cardioSelected = primaryBodyParts.has(CARDIO_VENDOR_VALUE) || secondaryBodyParts.has(CARDIO_VENDOR_VALUE);
  function toggleCardio() {
    tapFeedback();
    toggleBodyPartChip(bodyMode, CARDIO_VENDOR_VALUE);
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

          <Card style={styles.diagramCard}>
            <View style={styles.diagramCardInner}>
              <View
                style={styles.segmentGroup}
                accessibilityRole="tablist"
                accessibilityLabel="Body view"
              >
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
                style={styles.modeSegmentGroup}
                accessibilityRole="tablist"
                accessibilityLabel="Selection mode"
              >
                <Pressable
                  onPress={() => setBodyMode("primary")}
                  style={[styles.modeSegment, bodyMode === "primary" && styles.modeSegmentActivePrimary]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: bodyMode === "primary" }}
                  accessibilityLabel="Tap muscles to add as primary focus"
                  accessibilityHint="Primary areas are required to generate a workout"
                >
                  <View style={[styles.modeDot, { backgroundColor: Color.gold }]} />
                  <Text style={[styles.modeSegmentText, bodyMode === "primary" && styles.modeSegmentTextActivePrimary]}>
                    Primary
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setBodyMode("secondary")}
                  style={[styles.modeSegment, bodyMode === "secondary" && styles.modeSegmentActiveSecondary]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: bodyMode === "secondary" }}
                  accessibilityLabel="Tap muscles to add as secondary focus"
                  accessibilityHint="Secondary areas are optional, added for variety"
                >
                  <View style={[styles.modeDot, { backgroundColor: Color.accentData }]} />
                  <Text
                    style={[styles.modeSegmentText, bodyMode === "secondary" && styles.modeSegmentTextActiveSecondary]}
                  >
                    Secondary
                  </Text>
                </Pressable>
              </View>

              <View style={styles.diagramWrap}>
                <BodyDiagram
                  view={view}
                  sex={diagramSex}
                  zoneSelection={zoneSelectionFor}
                  isZoneAvailable={isZoneAvailable}
                  onToggleZone={handleZoneToggle}
                />
              </View>

              {cardioAvailable ? (
                <Pressable
                  onPress={toggleCardio}
                  style={[
                    styles.cardioChip,
                    cardioSelected && (bodyMode === "primary" ? styles.chipActive : styles.chipActiveSecondary),
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cardioSelected }}
                  accessibilityLabel={`Cardio${cardioSelected ? ", selected" : ""}, as ${bodyMode} focus`}
                >
                  <Ionicons
                    name="heart-outline"
                    size={14}
                    color={cardioSelected ? (bodyMode === "primary" ? Color.gold : Color.accentData) : Color.textMuted}
                  />
                  <Text
                    style={[
                      styles.cardioChipText,
                      cardioSelected && (bodyMode === "primary" ? styles.chipTextActive : styles.chipTextActiveSecondary),
                    ]}
                  >
                    Cardio
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Card>

          <View style={styles.summaryGroup}>
            <SelectedMusclesSection
              title="Primary (required)"
              values={[...primaryBodyParts]}
              labels={zoneLabels}
              variant="primary"
              onRemove={(v) => toggleBodyPartChip("primary", v)}
              emptyHint="Tap the body above, in Primary mode, to add the muscles this workout should focus on."
            />
            <SelectedMusclesSection
              title="Secondary (optional)"
              values={[...secondaryBodyParts]}
              labels={zoneLabels}
              variant="secondary"
              onRemove={(v) => toggleBodyPartChip("secondary", v)}
              emptyHint="Tap the body above, in Secondary mode, to add extra areas for variety."
            />
          </View>

          <Pressable
            onPress={() => {
              animateLayout();
              setShowFullList((v) => !v);
            }}
            style={styles.fullListToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFullList }}
            accessibilityLabel={showFullList ? "Hide full muscle list" : "Select from full muscle list"}
          >
            <Ionicons name="list-outline" size={13} color={Color.textMuted} />
            <Text style={styles.fullListToggleText}>{showFullList ? "Hide full list" : "Select from list"}</Text>
          </Pressable>

          {showFullList ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>All primary options</Text>
              <ChipGroup
                options={data.filters.bodyParts}
                selected={primaryBodyParts}
                labels={zoneLabels}
                variant="primary"
                onToggle={(v) => toggleBodyPartChip("primary", v)}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>All secondary options</Text>
              <ChipGroup
                options={data.filters.bodyParts}
                selected={secondaryBodyParts}
                labels={zoneLabels}
                variant="secondary"
                onToggle={(v) => toggleBodyPartChip("secondary", v)}
              />
            </>
          ) : null}

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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipActiveSecondary: { borderColor: Color.accentData, backgroundColor: "rgba(85,196,254,0.12)" },
  chipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted, textTransform: "capitalize" },
  chipTextActive: { color: Color.gold },
  chipTextActiveSecondary: { color: Color.accentData },
  // Collapsed-by-default review area — replaces the old always-open chip
  // wall. Header alone (dot + title + live count/name summary + chevron)
  // is the whole feedback loop; expanding is only for removing chips.
  summaryGroup: { marginTop: Spacing.md, gap: Spacing.xs },
  summarySection: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    overflow: "hidden",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryHeaderText: { flex: 1 },
  summaryTitle: { fontSize: 12, fontWeight: "700", color: Color.textPrimary },
  summaryMeta: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  summaryEmptyText: {
    fontSize: 11,
    color: Color.textFaint,
    lineHeight: 16,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  summaryChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  fullListToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: 6,
  },
  fullListToggleText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  // The diagram module reads as one contained "picker" panel — Front/Back,
  // Primary/Secondary, the silhouette, and the cardio pill all live inside
  // it, rather than floating loose against the screen background.
  diagramCard: { marginTop: Spacing.xs },
  diagramCardInner: { padding: Spacing.md, alignItems: "center" },
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
  // Both modes shown at once (rather than one button whose label changes)
  // so it's always visually obvious which one is active, and the dot color
  // pre-teaches the gold/blue coding used on the silhouette itself.
  modeSegmentGroup: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  modeSegment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.bg0,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  modeSegmentActivePrimary: { borderColor: Color.goldBorder, backgroundColor: Color.goldWeak },
  modeSegmentActiveSecondary: { borderColor: Color.accentData, backgroundColor: "rgba(85,196,254,0.12)" },
  modeDot: { width: 7, height: 7, borderRadius: 4 },
  modeSegmentText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  modeSegmentTextActivePrimary: { color: Color.gold },
  modeSegmentTextActiveSecondary: { color: Color.accentData },
  diagramWrap: { alignItems: "center", paddingVertical: Spacing.md },
  cardioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  cardioChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
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

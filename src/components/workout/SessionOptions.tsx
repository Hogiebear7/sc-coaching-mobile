import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { INJURY_AREAS, type InjuryArea, type Intent, type Level, type PlannedExercise, type SessionFormat } from "@/lib/session-engine";
import { makeLegacyStyles } from "@/lib/theme";

// The extra choices for the rules-based session generator (src/lib/session-engine): level, focus, format, anything sore, and a note. Shown on the
// generator screen above the time and equipment choices, for the Full Body and Upper / Lower structures.

const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const INTENTS: { value: Intent; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "tempo", label: "High tempo" },
  { value: "sport", label: "Sport" },
  { value: "conditioning", label: "Conditioning" },
];
const FORMATS: { value: SessionFormat; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "circuit", label: "Circuit" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
  { value: "chipper", label: "Chipper" },
];
const AREA_LABELS: Record<InjuryArea, string> = {
  ankle: "Ankle",
  knee: "Knee",
  hip: "Hip",
  lower_back: "Lower back",
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  neck: "Neck",
};

export function SessionOptions(props: {
  level: Level;
  onLevel: (v: Level) => void;
  intent: Intent;
  onIntent: (v: Intent) => void;
  format: SessionFormat;
  onFormat: (v: SessionFormat) => void;
  injuries: InjuryArea[];
  onToggleInjury: (a: InjuryArea) => void;
  /** Areas added for the member (an active rehab plan, or a recent "sore or injured" note). Shown as on, and not changed here. */
  lockedInjuries?: InjuryArea[];
  note: string;
  onNote: (v: string) => void;
  pregnancyLabel: string | null;
}) {
  const styles = useStyles();
  const chip = (active: boolean, label: string, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.label}>LEVEL</Text>
      <Text style={styles.sub}>Only exercises at this level or easier are used.</Text>
      <View style={styles.row}>{LEVELS.map((l) => chip(props.level === l.value, l.label, () => props.onLevel(l.value), l.value))}</View>

      <Text style={styles.label}>FOCUS TODAY</Text>
      <View style={styles.row}>{INTENTS.map((i) => chip(props.intent === i.value, i.label, () => props.onIntent(i.value), i.value))}</View>

      <Text style={styles.label}>FORMAT</Text>
      <View style={styles.row}>{FORMATS.map((f) => chip(props.format === f.value, f.label, () => props.onFormat(f.value), f.value))}</View>

      <Text style={styles.label}>ANYTHING SORE OR INJURED? — OPTIONAL</Text>
      <Text style={styles.sub}>Exercises that load these areas are left out. It is not a diagnosis: see a physio or doctor for an injury.</Text>
      <View style={styles.row}>
        {INJURY_AREAS.map((a) => {
          const locked = props.lockedInjuries?.includes(a) ?? false;
          return chip(locked || props.injuries.includes(a), AREA_LABELS[a], () => (locked ? undefined : props.onToggleInjury(a)), a);
        })}
      </View>
      {props.lockedInjuries && props.lockedInjuries.length > 0 ? (
        <Text style={styles.sub}>
          {props.lockedInjuries.map((a) => AREA_LABELS[a].toLowerCase()).join(", ")} added from your rehab plan or a recent sore note. Pause the rehab exercise or wait a few days to clear it.
        </Text>
      ) : null}

      <Text style={styles.label}>NOTES — OPTIONAL</Text>
      <TextInput
        value={props.note}
        onChangeText={props.onNote}
        placeholder="For example: short on time, want to feel it in my legs"
        placeholderTextColor="#8a93a6"
        multiline
        maxLength={200}
        style={styles.input}
        accessibilityLabel="Notes for this workout"
      />

      {props.pregnancyLabel ? <Text style={styles.pregnancy}>Pregnancy guidance is on ({props.pregnancyLabel}). It limits the exercises and effort, and is explained with your workout.</Text> : null}
    </View>
  );
}

export function PlanPreview(props: { exercises: PlannedExercise[]; notes: string[]; onStart: () => void; onRegenerate: () => void; onClose: () => void }) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
      <View style={styles.previewHeader}>
        <Pressable onPress={props.onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to options">
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <Text style={styles.previewTitle}>Your workout</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.previewScroll}>
        {props.exercises.map((e, i) => (
          <View key={`${e.exerciseId}-${i}`} style={styles.exercise}>
            <View style={styles.exerciseTop}>
              <Text style={styles.exerciseName}>{e.name}</Text>
              {e.supersetGroup ? <Text style={styles.badge}>Superset {e.supersetGroup}</Text> : null}
            </View>
            <Text style={styles.exerciseRx}>
              {e.sets} × {e.reps}
              {e.weight ? `  ·  ${e.weight}` : ""}
              {e.setType === "dropset" ? "  ·  drop set" : ""}
            </Text>
            <Text style={styles.exerciseCue}>{e.cue}</Text>
          </View>
        ))}
        <Text style={styles.whyTitle}>Why this session</Text>
        {props.notes.map((n, i) => (
          <Text key={i} style={styles.whyLine}>
            {n}
          </Text>
        ))}
      </ScrollView>
      <View style={styles.previewFooter}>
        <Button title="Start workout" onPress={props.onStart} />
        <Button title="Make a different one" onPress={props.onRegenerate} variant="secondary" style={{ marginTop: Spacing.sm }} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    label: { fontSize: 15, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.lg, letterSpacing: 0.4 },
    sub: { fontSize: 13, color: Color.textFaint, marginTop: 2, marginBottom: Spacing.sm, lineHeight: 18 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },
    chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 8, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
    chipTextActive: { color: Color.goldForeground },
    input: {
      marginTop: Spacing.xs,
      minHeight: 64,
      borderRadius: Radius.md,
      backgroundColor: Color.surface2,
      color: Color.textPrimary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 15,
      textAlignVertical: "top",
    },
    pregnancy: { marginTop: Spacing.md, fontSize: 13, color: Color.textMuted, lineHeight: 18 },
    overlay: { ...StyleSheet.absoluteFill as object, backgroundColor: Color.bg0 },
    previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    previewTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary },
    link: { fontSize: 16, fontWeight: "600", color: Color.gold },
    previewScroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    exercise: { backgroundColor: Color.surface2, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
    exerciseTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm },
    exerciseName: { flexShrink: 1, fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    badge: { fontSize: 12, fontWeight: "700", color: Color.gold },
    exerciseRx: { marginTop: 4, fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    exerciseCue: { marginTop: 2, fontSize: 13, color: Color.textMuted, lineHeight: 18 },
    whyTitle: { marginTop: Spacing.lg, fontSize: 17, fontWeight: "700", color: Color.textPrimary },
    whyLine: { marginTop: Spacing.sm, fontSize: 14, color: Color.textMuted, lineHeight: 20 },
    previewFooter: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, paddingTop: Spacing.sm },
  }),
);

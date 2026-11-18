import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MuscleThumb } from "@/components/ui/MuscleThumb";
import { WorkoutBlock } from "@/components/workout/WorkoutBlock";
import { Spacing } from "@/constants/theme";
import { CARDIO_LABEL, describeCardio } from "@/lib/cardio";
import { shareableNote } from "@/lib/community-workout";
import { entryBlocks, orderedEntries } from "@/lib/entry-order";
import { muscleFocusFor } from "@/lib/exercise-muscles";
import type { ExerciseSection, WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";
import { groupExerciseRowsBySuperset, supersetColor } from "@/lib/superset-groups";
import { supersetLetter, supersetMemberLabel } from "@/lib/superset-label";
import { makeLegacyStyles } from "@/lib/theme";
import { entryToRow, runToRow } from "@/lib/view-rows";
import type { WeightUnit } from "@/lib/weight-input";
import { computeExerciseSetTotals, formatExerciseSetLabels, formatRun, groupSetLabels } from "@/lib/workout-formatters";
import type { ExerciseRow, RunRow } from "@/lib/workout-draft";

// A finished workout drawn with the same workout cards as a live one (WorkoutBlock): the focused view, one round or set at a time, and a "Details" switch for the
// full list of sets (the way it opens), in the same coloured superset boxes. Read-only. Used for a workout in the history and for someone else's workout in Community.
const noop = () => {};

export function ReadOnlyWorkout({
  exercises,
  runs,
  weightUnit,
  ownWorkout,
  sectionByExerciseId,
  onOpenExercise,
}: {
  exercises: WorkoutExerciseEntry[];
  runs: WorkoutRunEntry[];
  weightUnit: WeightUnit;
  /** True for the member's own workout (their notes show); false for someone else's (only the app's own format line shows, never their personal notes). */
  ownWorkout: boolean;
  sectionByExerciseId?: Map<string, ExerciseSection>;
  onOpenExercise?: (name: string) => void;
}) {
  const styles = useStyles();
  // Every block opens on its full details (all the sets); this holds the ones switched to the focused view.
  const [focused, setFocused] = useState<string[]>([]);

  const built = useMemo(() => {
    const exerciseRows = exercises.map((e) => ({ row: entryToRow(e), entry: e }));
    const runRows = runs.map((r) => ({ row: runToRow(r), entry: r }));
    return { exerciseRows, runRows };
  }, [exercises, runs]);

  const rows = built.exerciseRows.map((x) => x.row);
  const runRows = built.runRows.map((x) => x.row);
  const entryByKey = new Map<string, WorkoutExerciseEntry>(built.exerciseRows.map((x) => [x.row.key, x.entry]));
  const runEntryByKey = new Map<string, WorkoutRunEntry>(built.runRows.map((x) => [x.row.key, x.entry]));

  const ordered = orderedEntries(rows, runRows);
  const allGroupLabels = ordered.map((e) => e.row.supersetGroup ?? null);
  const numberOf = (key: string): number => ordered.findIndex((e) => e.row.key === key) + 1;
  const memberNumber = (key: string, group: string | null): number => (group ? ordered.filter((e) => e.row.supersetGroup === group).findIndex((e) => e.row.key === key) : 0);

  const toggle = (blockKey: string) => setFocused((prev) => (prev.includes(blockKey) ? prev.filter((k) => k !== blockKey) : [...prev, blockKey]));

  const exerciseCard = (row: ExerciseRow) => {
    const entry = entryByKey.get(row.key)!;
    const section = entry.exerciseId ? sectionByExerciseId?.get(entry.exerciseId) : undefined;
    const focus = muscleFocusFor(entry.name, section, entry.muscleSection);
    const totals = computeExerciseSetTotals(entry);
    const groups = groupSetLabels(formatExerciseSetLabels(entry));
    const note = ownWorkout ? entry.notes?.trim() || null : shareableNote(entry.notes);
    const body = (
      <>
        <View style={styles.head}>
          <View style={styles.icon}>{focus ? <MuscleThumb focus={focus} size={44} /> : <Ionicons name="barbell-outline" size={18} color="#9FB3D1" />}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{entry.name.trim() || "Exercise"}</Text>
            <Text style={styles.meta}>
              {totals.sets} set{totals.sets === 1 ? "" : "s"}
              {totals.volume > 0 ? ` · ${Math.round(totals.volume).toLocaleString()} kg` : ""}
            </Text>
          </View>
          {onOpenExercise ? <Ionicons name="chevron-forward" size={18} color="#9FB3D1" /> : null}
        </View>
        {groups.length > 0 ? (
          <View style={styles.table}>
            {groups.map((g, i) => (
              <View key={i} style={[styles.setRow, i > 0 && styles.setRowDivider]}>
                <Text style={styles.setNumber}>{g.from === g.to ? `Set ${g.from}` : `Sets ${g.from}–${g.to}`}</Text>
                <Text style={styles.setValue}>{g.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </>
    );
    return onOpenExercise ? (
      <Pressable key={row.key} onPress={() => onOpenExercise(entry.name)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`${entry.name}, ${totals.sets} sets`}>
        {body}
      </Pressable>
    ) : (
      <View key={row.key} style={styles.card}>
        {body}
      </View>
    );
  };

  const runCard = (row: RunRow) => {
    const entry = runEntryByKey.get(row.key)!;
    const desc = describeCardio({ cardioType: entry.cardioType, distance: entry.distance, durationSecs: entry.durationSecs, sets: entry.sets });
    return (
      <View key={row.key} style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name="walk-outline" size={18} color="#9FB3D1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{CARDIO_LABEL[entry.cardioType ?? "run"]}</Text>
            <Text style={styles.meta}>
              {desc.rounds > 1 ? `${desc.rounds} sets` : "Cardio"}
              {desc.total ? ` · ${desc.total} total` : ""}
            </Text>
          </View>
        </View>
        {desc.perSet ? (
          <View style={styles.table}>
            <View style={styles.setRow}>
              <Text style={styles.setNumber}>{desc.rounds > 1 ? `Sets 1–${desc.rounds}` : "Set 1"}</Text>
              <Text style={styles.setValue}>{desc.perSet}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.meta}>{formatRun(entry) || "Cardio"}</Text>
        )}
        {ownWorkout && entry.notes?.trim() ? <Text style={styles.note}>{entry.notes.trim()}</Text> : null}
      </View>
    );
  };

  const block = (opts: { blockKey: string; group: string | null; members: ({ kind: "exercise"; row: ExerciseRow } | { kind: "run"; row: RunRow })[]; headerText: string }) => {
    const colour = opts.group ? supersetColor(opts.group, allGroupLabels) : "#9FB3D1";
    const open = !focused.includes(opts.blockKey);
    const labels = opts.members.map((m) => (opts.group ? supersetMemberLabel(opts.group, allGroupLabels, memberNumber(m.row.key, opts.group)) : String(numberOf(m.row.key))));
    return (
      <WorkoutBlock
        key={opts.blockKey}
        colour={colour}
        headerText={opts.headerText}
        editing={open}
        showToggle
        toggleLabel={open ? "Focused view" : "Details"}
        toggleHint={open ? "Back to the focused view" : "Show every set"}
        onToggle={() => toggle(opts.blockKey)}
        fullCards={opts.members.map((m) => (m.kind === "exercise" ? exerciseCard(m.row) : runCard(m.row)))}
        rounds={{
          mode: "view",
          members: opts.members,
          labels,
          color: colour,
          roundWord: opts.group ? "Round" : "Set",
          weightUnit,
          onChangeSet: noop,
          onToggleSet: noop,
          onAddRound: noop,
          onRemoveRound: noop,
          onPickTime: noop,
          onStartTimer: noop,
          onCycleUnit: noop,
          onToggleSplit: noop,
          onCycleSuperset: noop,
          onChangeRun: noop,
          onPickRunTime: noop,
          onToggleRun: noop,
          onOpenRunTimer: noop,
        }}
      />
    );
  };

  return (
    <View>
      {entryBlocks(rows, runRows).map((blk) => {
        if (blk.kind === "mixed") {
          return block({
            blockKey: `g-${blk.label}`,
            group: blk.label,
            members: blk.entries.map((e) => (e.kind === "exercise" ? { kind: "exercise" as const, row: e.row } : { kind: "run" as const, row: e.row })),
            headerText: `Superset ${supersetLetter(blk.label, allGroupLabels)} · ${blk.entries.length} entries`,
          });
        }
        if (blk.kind === "run") {
          return block({ blockKey: `r-${blk.row.key}`, group: null, members: [{ kind: "run", row: blk.row }], headerText: "Cardio" });
        }
        return groupExerciseRowsBySuperset(blk.rows).map((grp) => {
          const isSuper = !!grp.group && grp.rows.length > 1;
          return block({
            blockKey: isSuper ? `g-${grp.group}` : `s-${grp.rows[0].key}`,
            group: grp.group,
            members: grp.rows.map((r) => ({ kind: "exercise" as const, row: r })),
            headerText: isSuper && grp.group ? `Superset ${supersetLetter(grp.group, allGroupLabels)} · ${grp.rows.length} exercises` : `Exercise ${numberOf(grp.rows[0].key)}`,
          });
        });
      })}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { backgroundColor: Color.surface1, borderRadius: 16, padding: Spacing.md, marginHorizontal: Spacing.sm, marginVertical: Spacing.xs },
    head: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Color.bg0, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    meta: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    table: { marginTop: Spacing.sm },
    setRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    setRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    setNumber: { fontSize: 13, color: Color.textMuted },
    setValue: { fontSize: 14, fontWeight: "500", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
    note: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm },
  })
);

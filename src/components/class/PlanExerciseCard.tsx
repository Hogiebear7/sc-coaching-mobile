import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DataColor, Radius, Spacing } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { distinctGroups, supersetLetter, supersetMemberLabel } from "@/lib/superset-label";
import { applyWeightFrom, normalizeWeights, sanitizeWeight, stripWeightUnit, withWeightUnit, type WeightUnit } from "@/lib/weight-input";

// One exercise of a class workout, drawn the way a member's own exercise card is: a numbered badge you tap to make a superset, kg / time / band,
// and a table of sets with weight and reps (tap "Reps" to split it into right and left). The coach is planning rather than logging, so there is no
// "done" circle and no previous column.

export type PlanSet = { key: string; weight: string; reps: string; repsRight: string; repsLeft: string; modeValues?: Partial<Record<UnitMode, string>> };
export type UnitMode = "weight" | "time" | "band";

export interface PlanExercise {
  key: string;
  supersetGroup: string | null;
  perSide: boolean;
  unitMode: UnitMode;
  setRows: PlanSet[];
}

const SUPERSET_COLOURS = [DataColor.sessions, DataColor.load, DataColor.sleep, DataColor.hydration];

let planSetCounter = 0;
export function newPlanSet(from?: PlanSet): PlanSet {
  planSetCounter += 1;
  return { key: `ps-${Date.now()}-${planSetCounter}`, weight: from?.weight ?? "", reps: from?.reps ?? "", repsRight: from?.repsRight ?? "", repsLeft: from?.repsLeft ?? "" };
}

export function PlanExerciseCard<R extends PlanExercise>({
  row,
  number,
  allGroups,
  memberIndex,
  nameField,
  weightUnit,
  onChange,
  onCycleSuperset,
  onRemove,
  onPickTime,
}: {
  row: R;
  /** Position among the exercises, from 1. */
  number: number;
  allGroups: (string | null)[];
  /** Position inside its superset, from 0. */
  memberIndex: number;
  nameField: ReactNode;
  weightUnit: WeightUnit;
  onChange: (patch: Partial<R>) => void;
  onCycleSuperset: () => void;
  onRemove: () => void;
  /** Opens the time wheel for one set; the parent writes the chosen "m:ss" back with `onChange`. */
  onPickTime: (setKey: string, currentSecs: number | null) => void;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const grouped = !!row.supersetGroup;
  const groupColour = grouped ? SUPERSET_COLOURS[Math.max(0, distinctGroups(allGroups).indexOf(row.supersetGroup as string)) % SUPERSET_COLOURS.length] : null;

  function setSets(setRows: PlanSet[]) {
    onChange({ setRows } as Partial<R>);
  }
  // An edit changes that set and every set below it, never the ones above.
  function carry(setKey: string, field: "reps" | "repsRight" | "repsLeft" | "weight", value: string) {
    const at = row.setRows.findIndex((s) => s.key === setKey);
    setSets(row.setRows.map((s, i) => (i >= at && at !== -1 ? { ...s, [field]: value } : s)));
  }
  function changeUnit(mode: UnitMode) {
    if (mode === row.unitMode) return;
    selectionFeedback();
    onChange({
      unitMode: mode,
      setRows: row.setRows.map((s) => {
        const saved = { ...(s.modeValues ?? {}), [row.unitMode]: s.weight };
        return { ...s, modeValues: saved, weight: saved[mode] ?? "" };
      }),
    } as Partial<R>);
  }
  function parseSecs(text: string): number | null {
    const m = text.trim().match(/^(\d+):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={onCycleSuperset}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={grouped ? `Exercise ${number}, in a superset. Tap to change.` : `Exercise ${number}. Tap to put it in a superset.`}
          style={[styles.badge, grouped && groupColour ? { backgroundColor: groupColour, borderColor: "transparent" } : null]}
        >
          <Text style={[styles.badgeText, grouped && { color: Color.bg0 }]}>
            {grouped ? supersetMemberLabel(row.supersetGroup as string, allGroups, memberIndex) : number}
          </Text>
          {!grouped ? <Ionicons name="link" size={9} color={Color.textMuted} style={styles.badgeIcon} /> : null}
        </Pressable>
        <View style={{ flex: 1 }}>{nameField}</View>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove exercise" style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color={Color.danger} />
        </Pressable>
      </View>
      {grouped ? (
        <Text style={[styles.groupNote, { color: groupColour ?? Color.textMuted }]}>
          Superset {supersetLetter(row.supersetGroup as string, allGroups)}: done back to back
        </Text>
      ) : null}

      <View style={styles.unitRow}>
        <Text style={styles.unitLabel}>{row.unitMode === "time" ? "Time unit" : row.unitMode === "band" ? "Band" : "Weight unit"}</Text>
        <View style={styles.unitChips}>
          {(["weight", "time", "band"] as UnitMode[]).map((m) => (
            <Pressable key={m} onPress={() => changeUnit(m)} accessibilityRole="button" style={[styles.chip, row.unitMode === m && styles.chipActive]}>
              <Text style={[styles.chipText, row.unitMode === m && styles.chipTextActive]}>{m === "weight" ? weightUnit : m}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.setHeader}>
        <Text style={[styles.colLabel, { width: 36, textAlign: "center" }]}>Set</Text>
        <Text style={[styles.colLabel, { flex: 1, textAlign: "center" }]}>{row.unitMode === "time" ? "Time" : row.unitMode === "band" ? "Band" : "Weight"}</Text>
        <Pressable
          onPress={() => {
            selectionFeedback();
            onChange({ perSide: !row.perSide } as Partial<R>);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={row.perSide ? "Reps are split into right and left. Tap to use one box." : "Reps. Tap to split into right and left."}
          style={styles.repsHeader}
        >
          <Text style={styles.repsHeaderText}>{row.perSide ? "Reps R | L" : "Reps"}</Text>
          <Ionicons name={row.perSide ? "remove-circle-outline" : "git-compare-outline"} size={14} color={Color.gold} />
        </Pressable>
      </View>

      {row.setRows.map((s, i) => (
        <View key={s.key} style={styles.setRow}>
          <View style={styles.setNumber}>
            <Text style={styles.setNumberText}>{i + 1}</Text>
          </View>
          {row.unitMode === "weight" ? (
            <TextInput
              value={focusedKey === s.key ? stripWeightUnit(s.weight) : withWeightUnit(s.weight, weightUnit)}
              onChangeText={(v) => setSets(applyWeightFrom(row.setRows, s.key, sanitizeWeight(v)))}
              onFocus={() => setFocusedKey(s.key)}
              onBlur={() => {
                setFocusedKey(null);
                setSets(normalizeWeights(row.setRows, weightUnit));
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="60"
              placeholderTextColor={Color.textFaint}
              accessibilityLabel={`Set ${i + 1} weight in ${weightUnit}`}
              style={[styles.input, { flex: 1 }]}
            />
          ) : row.unitMode === "time" ? (
            <Pressable
              onPress={() => onPickTime(s.key, parseSecs(s.weight))}
              accessibilityRole="button"
              accessibilityLabel={`Set ${i + 1} time. Tap to change.`}
              style={[styles.input, { flex: 1, justifyContent: "center" }]}
            >
              <Text style={[styles.inputText, !s.weight && { color: Color.textFaint }]}>{s.weight || "1:30"}</Text>
            </Pressable>
          ) : (
            <TextInput
              value={s.weight}
              onChangeText={(v) => carry(s.key, "weight", v)}
              placeholder="e.g. Purple"
              placeholderTextColor={Color.textFaint}
              style={[styles.input, { flex: 1 }]}
            />
          )}
          {row.perSide ? (
            <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
              <TextInput
                value={s.repsRight}
                onChangeText={(v) => carry(s.key, "repsRight", v.replace(/[^0-9]/g, ""))}
                placeholder="R"
                placeholderTextColor={Color.textFaint}
                keyboardType="number-pad"
                accessibilityLabel={`Set ${i + 1} right reps`}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={s.repsLeft}
                onChangeText={(v) => carry(s.key, "repsLeft", v.replace(/[^0-9]/g, ""))}
                placeholder="L"
                placeholderTextColor={Color.textFaint}
                keyboardType="number-pad"
                accessibilityLabel={`Set ${i + 1} left reps`}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          ) : (
            <TextInput
              value={s.reps}
              onChangeText={(v) => carry(s.key, "reps", v.replace(/[^0-9]/g, ""))}
              placeholder="10"
              placeholderTextColor={Color.textFaint}
              keyboardType="number-pad"
              accessibilityLabel={`Set ${i + 1} reps`}
              style={[styles.input, { flex: 1 }]}
            />
          )}
        </View>
      ))}

      <View style={styles.setActions}>
        <Pressable
          onPress={() => {
            tapFeedback();
            setSets([...row.setRows, newPlanSet(row.setRows[row.setRows.length - 1])]);
          }}
          accessibilityRole="button"
          style={styles.pill}
        >
          <Ionicons name="add" size={18} color={Color.textPrimary} />
          <Text style={styles.pillText}>Add set</Text>
        </Pressable>
        {row.setRows.length > 1 ? (
          <Pressable
            onPress={() => {
              tapFeedback();
              setSets(row.setRows.slice(0, -1));
            }}
            accessibilityRole="button"
            style={[styles.pill, { backgroundColor: "transparent" }]}
          >
            <Ionicons name="remove" size={18} color={Color.textMuted} />
            <Text style={[styles.pillText, { color: Color.textMuted }]}>Remove last</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
    header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    badge: { width: 34, height: 34, borderRadius: 17, backgroundColor: Color.surface2, borderWidth: 1.5, borderColor: Color.borderDefault, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
    badgeIcon: { position: "absolute", bottom: -4, right: -4 },
    removeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    groupNote: { fontSize: 13, fontWeight: "600", marginTop: 6 },
    unitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.md },
    unitLabel: { fontSize: 14, color: Color.textMuted },
    unitChips: { flexDirection: "row", gap: 6 },
    chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    chipActive: { backgroundColor: "#FFFFFF" },
    chipText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    chipTextActive: { color: "#0A1526" },
    setHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: Spacing.md, marginBottom: 4 },
    colLabel: { fontSize: 13, color: Color.textMuted },
    repsHeader: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 32 },
    repsHeaderText: { fontSize: 13, fontWeight: "700", color: Color.gold, textDecorationLine: "underline" },
    setRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    setNumber: { width: 36, alignItems: "center" },
    setNumberText: { fontSize: 14, fontWeight: "700", color: Color.textSecondary },
    input: { minHeight: 46, borderRadius: Radius.md, backgroundColor: Color.surface2, paddingHorizontal: 10, textAlign: "center", fontSize: 16, color: Color.textPrimary },
    inputText: { fontSize: 16, textAlign: "center", color: Color.textPrimary },
    setActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: Spacing.md },
    pill: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Color.surface2 },
    pillText: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  })
);

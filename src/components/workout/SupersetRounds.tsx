import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { isRoundComplete, roundCount } from "@/lib/superset-rounds";
import { supersetMemberLabel } from "@/lib/superset-label";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { sanitizeWeight, stripWeightUnit, withWeightUnit, type WeightUnit } from "@/lib/weight-input";
import type { ExerciseRow, SetRow } from "@/lib/workout-draft";

// A superset drawn one round at a time. Round 1 is set 1 of every exercise in the superset, Round 2 is set 2, and so on. Only the round you are on
// is open: a row of dashes shows how far you are (tap one to look at another round), the exercise you are on is marked NOW, and each exercise has its
// own tick. It reads the same sets the normal view does and writes back to them, so nothing is lost by switching views. Names and the other details
// stay in "Edit exercises".

export function SupersetRounds({
  rows,
  group,
  allGroups,
  color,
  onChangeSet,
  onToggleSet,
  onAddRound,
  onRemoveRound,
  weightUnit,
  onPickTime,
  renderFooter,
}: {
  rows: ExerciseRow[];
  group: string;
  allGroups: (string | null)[];
  color: string;
  onChangeSet: (rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) => void;
  /** Ticks or unticks one exercise's set. The parent starts the rest when the last exercise of a round is ticked. */
  onToggleSet: (rowKey: string, setKey: string) => void;
  onAddRound: () => void;
  onRemoveRound: () => void;
  weightUnit: WeightUnit;
  /** Opens the time wheel for a set of a timed exercise; the parent writes the result back. */
  onPickTime: (rowKey: string, setKey: string, secs: number | null) => void;
  /** Shown once a round is done, for each exercise (reps in reserve). */
  renderFooter?: (row: ExerciseRow, label: string) => ReactNode;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const rounds = roundCount(rows);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  // The round you are on: the first one not finished, unless you tapped a dash.
  const firstOpen = Array.from({ length: rounds }, (_, i) => i).find((i) => !isRoundComplete(rows, i));
  const current = Math.min(picked ?? firstOpen ?? Math.max(0, rounds - 1), Math.max(0, rounds - 1));
  const roundDone = isRoundComplete(rows, current);
  const nowIndex = roundDone ? -1 : rows.findIndex((r) => r.setRows[current] && !r.setRows[current].completed);

  const timeSecs = (text: string): number | null => {
    const m = text.trim().match(/^(\d+):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const labelOf = (k: number) => supersetMemberLabel(group, allGroups, k);

  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        <View style={styles.dashes}>
          {Array.from({ length: rounds }, (_, i) => {
            const done = isRoundComplete(rows, i);
            return (
              <Pressable
                key={i}
                onPress={() => setPicked(i)}
                hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
                accessibilityRole="button"
                accessibilityLabel={`Round ${i + 1}${done ? ", done" : ""}`}
                style={[styles.dash, done && { backgroundColor: color }, i === current && { borderColor: color, borderWidth: 2 }]}
              />
            );
          })}
        </View>
        <Text style={styles.roundOf}>
          Round {current + 1} of {rounds}
        </Text>
      </View>

      {rows.map((row, k) => {
        const s = row.setRows[current];
        const isNow = k === nowIndex;
        if (!s) {
          return (
            <View key={row.key} style={styles.line}>
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>{labelOf(k)}</Text>
              </View>
              <Text style={styles.noSet}>{row.name.trim() || "Exercise"}: no set this round</Text>
            </View>
          );
        }
        return (
          <View key={row.key} style={[styles.line, isNow && styles.lineNow, s.completed && styles.lineDone]}>
            <View style={styles.lineTop}>
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>{labelOf(k)}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {row.name.trim() || "New exercise"}
              </Text>
              {isNow ? <Text style={styles.nowText}>NOW</Text> : null}
            </View>
            <View style={styles.lineBottom}>
              <View style={styles.boxes}>
                {row.unitMode === "time" ? (
                  <Pressable
                    onPress={() => onPickTime(row.key, s.key, timeSecs(s.weight))}
                    accessibilityRole="button"
                    accessibilityLabel={`${labelOf(k)} time. Tap to change.`}
                    style={[styles.box, { justifyContent: "center" }]}
                  >
                    <Text style={{ textAlign: "center", fontSize: 16, color: s.weight ? Color.textPrimary : Color.textFaint }}>{s.weight || "1:30"}</Text>
                  </Pressable>
                ) : row.unitMode === "band" ? (
                  <TextInput
                    value={s.weight}
                    onChangeText={(v) => onChangeSet(row.key, s.key, { weight: v })}
                    placeholder="band"
                    placeholderTextColor={Color.textFaint}
                    accessibilityLabel={`${labelOf(k)} band`}
                    style={styles.box}
                  />
                ) : (
                  <TextInput
                    value={focusedKey === s.key ? stripWeightUnit(s.weight) : withWeightUnit(s.weight, weightUnit)}
                    onChangeText={(v) => onChangeSet(row.key, s.key, { weight: sanitizeWeight(v) })}
                    onFocus={() => setFocusedKey(s.key)}
                    onBlur={() => {
                      setFocusedKey(null);
                      onChangeSet(row.key, s.key, { weight: withWeightUnit(s.weight, weightUnit) });
                    }}
                    selectTextOnFocus
                    keyboardType="decimal-pad"
                    placeholder={weightUnit}
                    placeholderTextColor={Color.textFaint}
                    accessibilityLabel={`${labelOf(k)} weight`}
                    style={styles.box}
                  />
                )}
                {row.perSide ? (
                  <>
                    <TextInput
                      value={s.repsRight}
                      onChangeText={(v) => onChangeSet(row.key, s.key, { repsRight: v.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      placeholder="R"
                      placeholderTextColor={Color.textFaint}
                      accessibilityLabel={`${labelOf(k)} right reps`}
                      style={styles.box}
                    />
                    <TextInput
                      value={s.repsLeft}
                      onChangeText={(v) => onChangeSet(row.key, s.key, { repsLeft: v.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      placeholder="L"
                      placeholderTextColor={Color.textFaint}
                      accessibilityLabel={`${labelOf(k)} left reps`}
                      style={styles.box}
                    />
                  </>
                ) : (
                  <TextInput
                    value={s.reps}
                    onChangeText={(v) => onChangeSet(row.key, s.key, { reps: v.replace(/[^0-9]/g, "") })}
                    keyboardType="number-pad"
                    placeholder="reps"
                    placeholderTextColor={Color.textFaint}
                    accessibilityLabel={`${labelOf(k)} reps`}
                    style={styles.box}
                  />
                )}
              </View>
              <Pressable
                onPress={() => onToggleSet(row.key, s.key)}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.completed }}
                accessibilityLabel={`${labelOf(k)} round ${current + 1} done`}
                style={[styles.tick, s.completed && { backgroundColor: color, borderColor: color }]}
              >
                {s.completed ? <Ionicons name="checkmark" size={22} color={Color.bg0} /> : null}
              </Pressable>
            </View>
          </View>
        );
      })}

      {roundDone ? (
        <>
          <Text style={styles.hint}>
            {current < rounds - 1 ? `Round ${current + 1} done. Rest, then Round ${current + 2}.` : "Last round done. Well done."}
          </Text>
          {renderFooter ? (
            <View style={styles.footers}>
              <Text style={styles.footerTitle}>How hard was that?</Text>
              {rows.map((row, k) => (
                <View key={row.key} style={styles.footerLine}>
                  <View style={[styles.badge, { backgroundColor: color }]}>
                    <Text style={styles.badgeText}>{labelOf(k)}</Text>
                  </View>
                  <Text style={styles.footerName} numberOfLines={1}>
                    {row.name.trim() || "Exercise"}
                  </Text>
                  {renderFooter(row, labelOf(k))}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : nowIndex >= 0 ? (
        <Text style={styles.hint}>
          {nowIndex < rows.length - 1
            ? `No rest yet: go straight to ${labelOf(nowIndex + 1)} (${rows[nowIndex + 1].name.trim() || "next exercise"}).`
            : `Tick ${labelOf(nowIndex)} to start your rest.`}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onAddRound} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>+ Add round</Text>
        </Pressable>
        {rounds > 1 ? (
          <Pressable onPress={onRemoveRound} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionText}>− Remove last</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: { padding: Spacing.md, gap: Spacing.sm },
    progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm },
    dashes: { flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap" },
    dash: { width: 28, height: 10, borderRadius: 5, backgroundColor: Color.surface2, borderWidth: 2, borderColor: "transparent" },
    roundOf: { fontSize: 14, color: Color.textMuted },
    line: { borderRadius: Radius.lg, padding: Spacing.sm, gap: Spacing.xs, borderWidth: 2, borderColor: "transparent", backgroundColor: Color.surface1 },
    lineNow: { borderColor: "#FFFFFF" },
    lineDone: { opacity: 0.6 },
    lineTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    lineBottom: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    badge: { minWidth: 34, height: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 13, fontWeight: "700", color: "#0a1526" },
    name: { flex: 1, fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    nowText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, color: "#FFFFFF" },
    boxes: { flex: 1, flexDirection: "row", gap: Spacing.xs },
    box: {
      flex: 1,
      minWidth: 0,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: Color.surface2,
      textAlign: "center",
      fontSize: 18,
      color: Color.textPrimary,
    },
    tick: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: Color.textMuted, alignItems: "center", justifyContent: "center" },
    noSet: { flex: 1, fontSize: 13, color: Color.textMuted },
    hint: { fontSize: 14, color: Color.textMuted },
    footers: { gap: 6, borderTopWidth: 1, borderTopColor: Color.borderSubtle, paddingTop: Spacing.sm },
    footerTitle: { fontSize: 13, fontWeight: "700", color: Color.textMuted },
    footerLine: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    footerName: { flex: 1, fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    action: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Color.surface2, justifyContent: "center" },
    actionText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  })
);

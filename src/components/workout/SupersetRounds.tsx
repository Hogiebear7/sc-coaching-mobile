import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { isRoundComplete, roundCount } from "@/lib/superset-rounds";
import { supersetMemberLabel } from "@/lib/superset-label";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { sanitizeWeight, stripWeightUnit, withWeightUnit, type WeightUnit } from "@/lib/weight-input";
import type { ExerciseRow, SetRow } from "@/lib/workout-draft";

// A superset drawn in rounds: Round 1 has set 1 of every exercise in the superset, Round 2 has set 2, and so on, with one tick for the whole
// round. It reads the same sets the normal view does and writes back to them, so switching views loses nothing. Names and the other details
// (notes, reps in reserve, left/right) stay in the normal view; left/right exercises get separate right and left boxes here.

export function SupersetRounds({
  rows,
  group,
  allGroups,
  color,
  onChangeSet,
  onToggleRound,
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
  onToggleRound: (roundIndex: number) => void;
  onAddRound: () => void;
  onRemoveRound: () => void;
  weightUnit: WeightUnit;
  /** Opens the time wheel for a set of a timed exercise; the parent writes the result back. */
  onPickTime: (rowKey: string, setKey: string, secs: number | null) => void;
  /** Shown under the rounds for each exercise (reps in reserve). */
  renderFooter?: (row: ExerciseRow, label: string) => ReactNode;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const rounds = roundCount(rows);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const timeSecs = (text: string): number | null => {
    const m = text.trim().match(/^(\d+):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  return (
    <View style={styles.wrap}>
      {Array.from({ length: rounds }, (_, i) => {
        const done = isRoundComplete(rows, i);
        return (
          <View key={i} style={[styles.round, i > 0 && styles.roundDivider]}>
            <View style={styles.roundHead}>
              <Text style={[styles.roundTitle, done && { color: Color.textMuted }]}>Round {i + 1}</Text>
              <Pressable
                onPress={() => onToggleRound(i)}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`Round ${i + 1} done`}
                style={[styles.tick, done && { backgroundColor: color, borderColor: color }]}
              >
                {done ? <Ionicons name="checkmark" size={20} color={Color.bg0} /> : null}
              </Pressable>
            </View>

            {rows.map((row, k) => {
              const s = row.setRows[i];
              const label = supersetMemberLabel(group, allGroups, k);
              if (!s) {
                return (
                  <View key={row.key} style={styles.line}>
                    <View style={[styles.badge, { backgroundColor: color }]}>
                      <Text style={styles.badgeText}>{label}</Text>
                    </View>
                    <Text style={styles.noSet}>{row.name.trim() || "Exercise"}: no set this round</Text>
                  </View>
                );
              }
              return (
                <View key={row.key} style={[styles.line, s.completed && styles.lineDone]}>
                  <View style={[styles.badge, { backgroundColor: color }]}>
                    <Text style={styles.badgeText}>{label}</Text>
                  </View>
                  <View style={styles.fields}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.name.trim() || "New exercise"}
                    </Text>
                    <View style={styles.boxes}>
                      {row.unitMode === "time" ? (
                        <Pressable
                          onPress={() => onPickTime(row.key, s.key, timeSecs(s.weight))}
                          accessibilityRole="button"
                          accessibilityLabel={`${label} round ${i + 1} time. Tap to change.`}
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
                          accessibilityLabel={`${label} round ${i + 1} band`}
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
                          accessibilityLabel={`${label} round ${i + 1} weight`}
                          style={styles.box}
                        />
                      )}
                      {row.perSide ? (
                        <>
                          <TextInput
                            value={s.repsRight}
                            onChangeText={(v) => onChangeSet(row.key, s.key, { repsRight: v })}
                            keyboardType="number-pad"
                            placeholder="R"
                            placeholderTextColor={Color.textFaint}
                            accessibilityLabel={`${label} round ${i + 1} right reps`}
                            style={styles.box}
                          />
                          <TextInput
                            value={s.repsLeft}
                            onChangeText={(v) => onChangeSet(row.key, s.key, { repsLeft: v })}
                            keyboardType="number-pad"
                            placeholder="L"
                            placeholderTextColor={Color.textFaint}
                            accessibilityLabel={`${label} round ${i + 1} left reps`}
                            style={styles.box}
                          />
                        </>
                      ) : (
                        <TextInput
                          value={s.reps}
                          onChangeText={(v) => onChangeSet(row.key, s.key, { reps: v })}
                          keyboardType="number-pad"
                          placeholder="reps"
                          placeholderTextColor={Color.textFaint}
                          accessibilityLabel={`${label} round ${i + 1} reps`}
                          style={styles.box}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      {renderFooter ? (
        <View style={styles.footers}>
          {rows.map((row, k) => (
            <View key={row.key} style={styles.footerLine}>
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>{supersetMemberLabel(group, allGroups, k)}</Text>
              </View>
              <Text style={styles.footerName} numberOfLines={1}>
                {row.name.trim() || "Exercise"}
              </Text>
              {renderFooter(row, supersetMemberLabel(group, allGroups, k))}
            </View>
          ))}
        </View>
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
    round: { gap: Spacing.sm },
    roundDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle, paddingTop: Spacing.sm },
    roundHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    roundTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    tick: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Color.textMuted, alignItems: "center", justifyContent: "center" },
    line: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, minHeight: 56 },
    lineDone: { opacity: 0.6 },
    badge: { minWidth: 34, height: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 13, fontWeight: "700", color: "#0a1526" },
    fields: { flex: 1, gap: 4 },
    name: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    boxes: { flexDirection: "row", gap: Spacing.xs },
    box: {
      flex: 1,
      minWidth: 0,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: Color.surface2,
      textAlign: "center",
      fontSize: 16,
      color: Color.textPrimary,
    },
    noSet: { flex: 1, fontSize: 13, color: Color.textMuted },
    footers: { gap: 4, borderTopWidth: 1, borderTopColor: Color.borderSubtle, paddingTop: Spacing.sm },
    footerLine: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    footerName: { flex: 1, fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    action: { minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Color.surface2, justifyContent: "center" },
    actionText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  })
);

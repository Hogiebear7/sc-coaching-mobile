import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { CARDIO_LABEL, usesFloors } from "@/lib/cardio";
import { isRoundComplete, roundCount } from "@/lib/superset-rounds";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { sanitizeWeight, stripWeightUnit, withWeightUnit, type WeightUnit } from "@/lib/weight-input";
import { formatDuration, parseDuration } from "@/lib/workout-formatters";
import type { ExerciseRow, RunRow, SetRow } from "@/lib/workout-draft";

// The compact way to see a superset or a single exercise: one round (or set) at a time. Round 1 is set 1 of every exercise, Round 2 is set 2, and
// so on. A row of dashes shows every round (done, current, still to do) and you can tap one to look at it. The exercise you are on is marked NOW,
// and each exercise has its own tick, or a start button for a timed one. Cardio in a superset is a line in every round. It reads and writes the same
// sets as the full cards ("Edit exercises"), so switching loses nothing.

export type RoundMember = { kind: "exercise"; row: ExerciseRow } | { kind: "run"; row: RunRow };

export function SupersetRounds({
  members,
  labels,
  color,
  roundWord,
  weightUnit,
  onChangeSet,
  onToggleSet,
  onAddRound,
  onRemoveRound,
  onPickTime,
  onStartTimer,
  onCycleUnit,
  onToggleSplit,
  onCycleSuperset,
  onChangeRun,
  onPickRunTime,
  onToggleRun,
  onOpenRunTimer,
  renderFooter,
}: {
  members: RoundMember[];
  /** What to call each member: "A1", "A2" ... in a superset, "1" for a single exercise. */
  labels: string[];
  color: string;
  /** "Round" for a superset, "Set" for a single exercise. */
  roundWord: "Round" | "Set";
  weightUnit: WeightUnit;
  onChangeSet: (rowKey: string, setKey: string, patch: Partial<Omit<SetRow, "key">>) => void;
  /** Ticks or unticks one exercise's set. The parent starts the rest when the last exercise of a round is ticked. */
  onToggleSet: (rowKey: string, setKey: string) => void;
  onAddRound: () => void;
  onRemoveRound: () => void;
  onPickTime: (rowKey: string, setKey: string, secs: number | null) => void;
  onStartTimer: (rowKey: string, setKey: string) => void;
  /** Cycles an exercise between kg, time and band. */
  onCycleUnit: (rowKey: string) => void;
  /** Splits an exercise's reps into right and left (and back). */
  onToggleSplit: (rowKey: string) => void;
  /** Tapping a label changes which superset the entry is in. */
  onCycleSuperset: (key: string) => void;
  onChangeRun: (rowKey: string, patch: Partial<Omit<RunRow, "key">>) => void;
  onPickRunTime: (rowKey: string, secs: number) => void;
  /** Ticks or unticks a cardio line for one round. */
  onToggleRun: (rowKey: string, roundIndex: number) => void;
  /** Opens the run timer (timer or stopwatch) for a cardio line. */
  onOpenRunTimer: (rowKey: string) => void;
  /** Shown once a round is done, for each exercise (reps in reserve). */
  renderFooter?: (row: ExerciseRow, label: string) => ReactNode;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const exerciseRows = members.flatMap((m) => (m.kind === "exercise" ? [m.row] : []));
  const rounds = Math.max(1, roundCount(exerciseRows));
  const runList = members.flatMap((m) => (m.kind === "run" ? [m.row] : []));
  // A round is done when every exercise is ticked for it and so is every cardio line.
  const roundIsDone = (i: number) => isRoundComplete(exerciseRows, i) && runList.every((r) => (r.roundsDone ?? []).includes(i));
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  // The round you are on: the first one not finished, unless you tapped a dash.
  const firstOpen = Array.from({ length: rounds }, (_, i) => i).find((i) => !roundIsDone(i));
  const current = Math.min(picked ?? firstOpen ?? rounds - 1, rounds - 1);
  const roundDone = roundIsDone(current);
  // The exercise that is up next in this round (cardio lines are shown but never "next").
  const nowKey = roundDone
    ? null
    : (members.find((m) => (m.kind === "exercise" ? !!m.row.setRows[current] && !m.row.setRows[current].completed : !(m.row.roundsDone ?? []).includes(current)))?.row.key ?? null);

  const timeSecs = (text: string): number | null => {
    const m = text.trim().match(/^(\d+):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const unitLabel = (r: ExerciseRow) => (r.unitMode === "time" ? "Time" : r.unitMode === "band" ? "Band" : `Weight (${weightUnit})`);

  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        <View style={styles.dashes}>
          {Array.from({ length: rounds }, (_, i) => {
            const done = roundIsDone(i);
            const here = i === current;
            return (
              <Pressable
                key={i}
                onPress={() => setPicked(i)}
                hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
                accessibilityRole="button"
                accessibilityLabel={`${roundWord} ${i + 1}${done ? ", done" : here ? ", current" : ", still to do"}`}
                style={[
                  styles.dash,
                  { borderColor: done || here ? color : Color.textMuted },
                  done && { backgroundColor: color },
                  here && !done && { backgroundColor: color + "55", borderWidth: 2.5 },
                ]}
              />
            );
          })}
        </View>
        <Text style={styles.roundOf}>
          {roundWord} {current + 1} of {rounds}
        </Text>
      </View>

      {members.map((m, k) => {
        const label = labels[k] ?? String(k + 1);
        if (m.kind === "run") {
          const r = m.row;
          const ticked = (r.roundsDone ?? []).includes(current);
          return (
            <View key={r.key} style={[styles.line, r.key === nowKey && styles.lineNow, ticked && styles.lineDone]}>
              <View style={styles.lineTop}>
                <Pressable
                  onPress={() => onCycleSuperset(r.key)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, cardio. Tap to change superset.`}
                  style={[styles.badge, { backgroundColor: color }]}
                >
                  <Text style={styles.badgeText}>{label}</Text>
                </Pressable>
                <Text style={styles.name} numberOfLines={1}>
                  {r.typeChosen ? CARDIO_LABEL[r.cardioType] : "Cardio"}
                </Text>
                {r.key === nowKey ? <Text style={styles.nowText}>NOW</Text> : null}
                <Pressable
                  onPress={() => onOpenRunTimer(r.key)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Timer or stopwatch for this cardio"
                  style={styles.timerBtn}
                >
                  <Ionicons name="stopwatch-outline" size={20} color={Color.textPrimary} />
                </Pressable>
              </View>
              <View style={styles.lineBottom}>
                <View style={styles.boxes}>
                  <TextInput
                    value={r.distance}
                    onChangeText={(v) => onChangeRun(r.key, { distance: v.replace(/[^0-9.]/g, "") })}
                    keyboardType="decimal-pad"
                    placeholder={usesFloors(r.cardioType) ? "Floors" : r.distanceUnit === "m" ? "Distance (m)" : "Distance (km)"}
                    placeholderTextColor={Color.textFaint}
                    accessibilityLabel={`${label} distance`}
                    style={[styles.box, { flex: 1.3 }]}
                  />
                  {usesFloors(r.cardioType) ? null : (
                    <Pressable
                      onPress={() => onChangeRun(r.key, { distanceUnit: r.distanceUnit === "km" ? "m" : "km" })}
                      accessibilityRole="button"
                      accessibilityLabel={`Distance in ${r.distanceUnit}. Tap to change.`}
                      style={styles.unitBtn}
                    >
                      <Text style={styles.unitBtnText}>{r.distanceUnit}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => onPickRunTime(r.key, parseDuration(r.duration) ?? 0)}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} time. Tap to change.`}
                    style={[styles.box, { flex: 1, justifyContent: "center" }]}
                  >
                    <Text style={{ textAlign: "center", fontSize: 16, color: r.duration.trim() ? Color.textPrimary : Color.textFaint }}>
                      {r.duration.trim() ? formatDuration(parseDuration(r.duration) ?? 0) : "Time"}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => onToggleRun(r.key, current)}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ticked }}
                  accessibilityLabel={`${label} ${roundWord.toLowerCase()} ${current + 1} done`}
                  style={[styles.tick, ticked && { backgroundColor: color, borderColor: color }]}
                >
                  {ticked ? <Ionicons name="checkmark" size={22} color={Color.bg0} /> : null}
                </Pressable>
              </View>
            </View>
          );
        }

        const row = m.row;
        const s = row.setRows[current];
        const isNow = row.key === nowKey;
        if (!s) {
          return (
            <View key={row.key} style={styles.line}>
              <View style={styles.lineTop}>
                <Pressable onPress={() => onCycleSuperset(row.key)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${label}. Tap to change superset.`} style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{label}</Text>
                </Pressable>
                <Text style={styles.noSet}>{row.name.trim() || "Exercise"}: no {roundWord.toLowerCase()} here</Text>
              </View>
            </View>
          );
        }
        const timed = row.unitMode === "time";
        return (
          <View key={row.key} style={[styles.line, isNow && styles.lineNow, s.completed && styles.lineDone]}>
            <View style={styles.lineTop}>
              <Pressable
                onPress={() => onCycleSuperset(row.key)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${label}. Tap to change superset.`}
                style={[styles.badge, { backgroundColor: color }]}
              >
                <Text style={styles.badgeText}>{label}</Text>
              </Pressable>
              <Text style={styles.name} numberOfLines={1}>
                {row.name.trim() || "New exercise"}
              </Text>
              {isNow ? <Text style={styles.nowText}>NOW</Text> : null}
            </View>

            <View style={styles.headerLine}>
              <Pressable onPress={() => onCycleUnit(row.key)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${unitLabel(row)}. Tap to change to kg, time or band.`} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>{unitLabel(row)}</Text>
                <Ionicons name="swap-horizontal" size={13} color={Color.gold} />
              </Pressable>
              {timed ? null : (
                <Pressable
                  onPress={() => onToggleSplit(row.key)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={row.perSide ? "Reps are split into right and left. Tap to use one box." : "Reps. Tap to split into right and left."}
                  style={[styles.headerBtn, { flex: row.perSide ? 2 : 1 }]}
                >
                  <Text style={styles.headerBtnText}>{row.perSide ? "Reps R | L" : "Reps"}</Text>
                  <Ionicons name={row.perSide ? "remove-circle-outline" : "git-compare-outline"} size={13} color={Color.gold} />
                </Pressable>
              )}
              <View style={{ width: timed ? 52 + 8 + 52 : 52 }} />
            </View>

            <View style={styles.lineBottom}>
              <View style={styles.boxes}>
                {timed ? (
                  <Pressable
                    onPress={() => onPickTime(row.key, s.key, timeSecs(s.weight))}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} time. Tap to change.`}
                    style={[styles.box, { justifyContent: "center" }]}
                  >
                    <Text style={{ textAlign: "center", fontSize: 18, color: s.weight ? Color.textPrimary : Color.textFaint }}>{s.weight || "1:30"}</Text>
                  </Pressable>
                ) : row.unitMode === "band" ? (
                  <TextInput
                    value={s.weight}
                    onChangeText={(v) => onChangeSet(row.key, s.key, { weight: v })}
                    placeholder="band"
                    placeholderTextColor={Color.textFaint}
                    accessibilityLabel={`${label} band`}
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
                    accessibilityLabel={`${label} weight`}
                    style={styles.box}
                  />
                )}
                {timed ? null : row.perSide ? (
                  <>
                    <TextInput
                      value={s.repsRight}
                      onChangeText={(v) => onChangeSet(row.key, s.key, { repsRight: v.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      placeholder="R"
                      placeholderTextColor={Color.textFaint}
                      accessibilityLabel={`${label} right reps`}
                      style={styles.box}
                    />
                    <TextInput
                      value={s.repsLeft}
                      onChangeText={(v) => onChangeSet(row.key, s.key, { repsLeft: v.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      placeholder="L"
                      placeholderTextColor={Color.textFaint}
                      accessibilityLabel={`${label} left reps`}
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
                    accessibilityLabel={`${label} reps`}
                    style={styles.box}
                  />
                )}
              </View>
              {timed && !s.completed ? (
                <Pressable
                  onPress={() => onStartTimer(row.key, s.key)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Start the timer for ${label}`}
                  style={[styles.tick, { borderColor: color }]}
                >
                  <Ionicons name="play" size={22} color={color} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onToggleSet(row.key, s.key)}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.completed }}
                accessibilityLabel={`${label} ${roundWord.toLowerCase()} ${current + 1} done`}
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
            {current < rounds - 1 ? `${roundWord} ${current + 1} done. Rest, then ${roundWord} ${current + 2}.` : `Last ${roundWord.toLowerCase()} done. Well done.`}
          </Text>
          {renderFooter ? (
            <View style={styles.footers}>
              <Text style={styles.footerTitle}>How hard was that?</Text>
              {members.map((m, k) =>
                m.kind === "exercise" ? (
                  <View key={m.row.key} style={styles.footerLine}>
                    <View style={[styles.badge, { backgroundColor: color }]}>
                      <Text style={styles.badgeText}>{labels[k] ?? String(k + 1)}</Text>
                    </View>
                    <Text style={styles.footerName} numberOfLines={1}>
                      {m.row.name.trim() || "Exercise"}
                    </Text>
                    {renderFooter(m.row, labels[k] ?? String(k + 1))}
                  </View>
                ) : null
              )}
            </View>
          ) : null}
        </>
      ) : nowKey ? (
        <Text style={styles.hint}>
          {(() => {
            const at = members.findIndex((m) => m.row.key === nowKey);
            const next = members[at + 1];
            const nameOf = (m: RoundMember) => (m.kind === "exercise" ? m.row.name.trim() || "next exercise" : m.row.typeChosen ? CARDIO_LABEL[m.row.cardioType] : "cardio");
            return next ? `No rest yet: go straight to ${labels[at + 1]} (${nameOf(next)}).` : `Tick ${labels[at]} to start your rest.`;
          })()}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onAddRound} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>+ Add {roundWord.toLowerCase()}</Text>
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
    dash: { width: 28, height: 12, borderRadius: 6, borderWidth: 1.5, backgroundColor: "transparent" },
    roundOf: { fontSize: 14, color: Color.textMuted },
    line: { borderRadius: Radius.lg, padding: Spacing.sm, gap: Spacing.xs, borderWidth: 2, borderColor: "transparent", backgroundColor: Color.surface1 },
    lineNow: { borderColor: "#FFFFFF" },
    lineDone: { opacity: 0.6 },
    lineTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    lineBottom: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    headerLine: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: 2 },
    headerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 28 },
    headerBtnText: { fontSize: 12, fontWeight: "700", color: Color.gold, textDecorationLine: "underline" },
    colLabel: { fontSize: 12, color: Color.textMuted },
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
    unitBtn: { minWidth: 44, height: 48, borderRadius: Radius.md, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    unitBtnText: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
    timerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
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

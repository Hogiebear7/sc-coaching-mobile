import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useExerciseLibraryNameIndex } from "@/lib/queries/exercise-library";
import { tapFeedback } from "@/lib/haptics";
import {
  useClassWorkout,
  useSaveClassWorkout,
  type ClassWorkoutExerciseEntry,
} from "@/lib/queries/staff";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `cw-${Date.now()}-${keySeq}`;
}

type WorkoutFormat = "standard" | "circuit" | "amrap" | "emom" | "tabata" | "chipper";

const FORMAT_OPTIONS: { value: WorkoutFormat; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "chipper", label: "Chipper" },
  { value: "circuit", label: "Circuit" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
];

type CircuitStation = { key: string; name: string; mode: "reps" | "time"; reps: string; seconds: string };

// The class-workout builder has no live-timer executor — the coach is
// running the session in person — so format config is folded into the
// existing free-text `notes` field members already see, rather than adding
// a new backend field just for this screen.
function buildFormatSummary(
  format: WorkoutFormat,
  circuitStations: CircuitStation[],
  circuitRest: { station: string; round: string },
  circuitRounds: string,
  movements: string[],
  amrapMins: string,
  emomIntervalSecs: string,
  emomTotalMins: string,
  tabataWork: string,
  tabataRest: string,
  tabataRounds: string
): string {
  if (format === "chipper") return "Format: Chipper (for time)";
  if (format === "circuit") {
    const stationList = circuitStations
      .filter((s) => s.name.trim())
      .map((s) => (s.mode === "reps" && s.reps.trim() ? `${s.name} (${s.reps} reps)` : s.mode === "time" && s.seconds.trim() ? `${s.name} (${s.seconds}s)` : s.name))
      .join(", ");
    return `Format: Circuit — ${circuitRounds || "?"} rounds · Stations: ${stationList || "—"} · Rest ${circuitRest.station || "0"}s/station, ${circuitRest.round || "0"}s/round`;
  }
  if (format === "amrap") {
    return `Format: AMRAP — ${amrapMins || "?"} min · Movements: ${movements.join(", ") || "—"}`;
  }
  if (format === "emom") {
    return `Format: EMOM — ${emomIntervalSecs || "60"}s intervals × ${emomTotalMins || "?"} min · Movements: ${movements.join(", ") || "—"}`;
  }
  if (format === "tabata") {
    return `Format: Tabata — ${tabataWork || "20"}s work / ${tabataRest || "10"}s rest × ${tabataRounds || "8"} rounds · Movements: ${movements.join(", ") || "—"}`;
  }
  return "";
}

function newCircuitStation(): CircuitStation {
  return { key: nextKey(), name: "", mode: "reps", reps: "", seconds: "" };
}

function MovementsEditor({ movements, onChange }: { movements: string[]; onChange: (m: string[]) => void }) {
  const [draftText, setDraftText] = useState("");
  function add() {
    const v = draftText.trim();
    if (!v) return;
    onChange([...movements, v]);
    setDraftText("");
  }
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.rowLabel}>Movements</Text>
      <View style={{ flexDirection: "row", gap: Spacing.xs }}>
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder="e.g. 10 Burpees"
          placeholderTextColor={Color.textFaint}
          style={[inputStyleBase, { flex: 1 }]}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable onPress={add} style={styles.formatAddButton}>
          <Ionicons name="add" size={18} color={Color.goldForeground} />
        </Pressable>
      </View>
      {movements.length > 0 ? (
        <View style={styles.movementsList}>
          {movements.map((m, i) => (
            <View key={`${m}-${i}`} style={styles.movementChip}>
              <Text style={styles.movementChipText}>{m}</Text>
              <Pressable onPress={() => onChange(movements.filter((_, idx) => idx !== i))} hitSlop={6}>
                <Ionicons name="close" size={13} color={Color.textFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StationsEditor({ stations, onChange }: { stations: CircuitStation[]; onChange: (s: CircuitStation[]) => void }) {
  function updateStation(key: string, patch: Partial<CircuitStation>) {
    onChange(stations.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  return (
    <View>
      <Text style={styles.rowLabel}>Stations</Text>
      {stations.map((s, i) => (
        <View key={s.key} style={styles.stationRow}>
          <TextInput
            value={s.name}
            onChangeText={(v) => updateStation(s.key, { name: v })}
            placeholder={`Station ${i + 1} name`}
            placeholderTextColor={Color.textFaint}
            style={[inputStyleBase, { flex: 1 }]}
          />
          <Pressable onPress={() => updateStation(s.key, { mode: s.mode === "reps" ? "time" : "reps" })} style={styles.formatModeChip}>
            <Text style={styles.formatModeText}>{s.mode === "reps" ? "Reps" : "Time"}</Text>
          </Pressable>
          <TextInput
            value={s.mode === "reps" ? s.reps : s.seconds}
            onChangeText={(v) => updateStation(s.key, s.mode === "reps" ? { reps: v } : { seconds: v })}
            keyboardType="number-pad"
            placeholder={s.mode === "reps" ? "reps" : "secs"}
            placeholderTextColor={Color.textFaint}
            style={[inputStyleBase, { width: 56, paddingHorizontal: 4 }]}
          />
          <Pressable onPress={() => onChange(stations.filter((row) => row.key !== s.key))} hitSlop={6}>
            <Ionicons name="close" size={16} color={Color.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...stations, newCircuitStation()])} style={styles.addChip}>
        <Text style={styles.addChipText}>+ Station</Text>
      </Pressable>
    </View>
  );
}

type TemplateRow = {
  key: string;
  exerciseId: string | null;
  name: string;
  weight: string;
  reps: string;
  sets: string;
};

type MemberRow = {
  key: string;
  name: string;
  weight: string;
  reps: string;
  sets: string;
  rpe: string;
};

function newTemplateRow(): TemplateRow {
  return { key: nextKey(), exerciseId: null, name: "", weight: "", reps: "", sets: "" };
}

function rowsFromEntries(entries: ClassWorkoutExerciseEntry[] | null): TemplateRow[] {
  if (!entries || entries.length === 0) return [newTemplateRow()];
  return entries.map((e) => ({
    key: nextKey(),
    exerciseId: e.exerciseId,
    name: e.name,
    weight: e.weight ?? "",
    reps: e.reps === null ? "" : String(e.reps),
    sets: e.sets === null ? "" : String(e.sets),
  }));
}

function memberRowsFromTemplate(
  template: TemplateRow[],
  existing: ClassWorkoutExerciseEntry[] | null
): MemberRow[] {
  return template
    .filter((t) => t.name.trim())
    .map((t) => {
      const prior = existing?.find((e) => e.name.toLowerCase() === t.name.trim().toLowerCase());
      return {
        key: nextKey(),
        name: t.name.trim(),
        weight: prior?.weight ?? t.weight,
        reps: prior?.reps != null ? String(prior.reps) : t.reps,
        sets: prior?.sets != null ? String(prior.sets) : t.sets,
        rpe: prior?.rpe != null ? String(prior.rpe) : "",
      };
    });
}

const inputStyleBase = {
  height: 40,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Color.borderSubtle,
  backgroundColor: Color.surface1,
  paddingHorizontal: Spacing.sm,
  fontSize: 13,
  color: Color.textPrimary,
};

export default function ClassWorkoutBuilderScreen() {
  const router = useRouter();
  const { classId, classTitle, classDate, startTime } = useLocalSearchParams<{
    classId: string;
    classTitle?: string;
    classDate?: string;
    startTime?: string;
  }>();

  const { data, isLoading } = useClassWorkout(classId);
  const { data: libraryIndex } = useExerciseLibraryNameIndex();
  const saveWorkout = useSaveClassWorkout();

  const [template, setTemplate] = useState<TemplateRow[]>([newTemplateRow()]);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [format, setFormat] = useState<WorkoutFormat>("standard");
  const [circuitStations, setCircuitStations] = useState<CircuitStation[]>([]);
  const [circuitRestStation, setCircuitRestStation] = useState("15");
  const [circuitRestRound, setCircuitRestRound] = useState("60");
  const [circuitRounds, setCircuitRounds] = useState("3");
  const [amrapMins, setAmrapMins] = useState("12");
  const [amrapMovements, setAmrapMovements] = useState<string[]>([]);
  const [emomIntervalSecs, setEmomIntervalSecs] = useState("60");
  const [emomTotalMins, setEmomTotalMins] = useState("10");
  const [emomMovements, setEmomMovements] = useState<string[]>([]);
  const [tabataWork, setTabataWork] = useState("20");
  const [tabataRest, setTabataRest] = useState("10");
  const [tabataRounds, setTabataRounds] = useState("8");
  const [tabataMovements, setTabataMovements] = useState<string[]>([]);
  const [memberRows, setMemberRows] = useState<Record<string, MemberRow[]>>({});
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || !data) return;
    setTemplate(rowsFromEntries(data.existingWorkout?.exercises ?? null));
    setWorkoutNotes(data.existingWorkout?.notes ?? "");
    setMemberNotes(Object.fromEntries(data.checkedIn.map((m) => [m.userId, m.existingNotes ?? ""])));
    setHydrated(true);
  }, [data, hydrated]);

  function updateTemplate(key: string, patch: Partial<TemplateRow>) {
    setTemplate((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  function rowsFor(userId: string, existingExercises: ClassWorkoutExerciseEntry[] | null): MemberRow[] {
    return memberRows[userId] ?? memberRowsFromTemplate(template, existingExercises);
  }

  function updateMemberRow(userId: string, existingExercises: ClassWorkoutExerciseEntry[] | null, key: string, patch: Partial<MemberRow>) {
    setMemberRows((prev) => {
      const rows = prev[userId] ?? memberRowsFromTemplate(template, existingExercises);
      return { ...prev, [userId]: rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
    });
    setMessage(null);
  }

  async function handleSave() {
    if (!data) return;
    setError(null);
    setMessage(null);

    try {
      const results = data.checkedIn.map((member) => ({
        userId: member.userId,
        notes: memberNotes[member.userId] ?? "",
        exercises: rowsFor(member.userId, member.existingExercises).map((r) => ({
          name: r.name,
          weight: r.weight,
          reps: r.reps.trim() ? Number(r.reps) : null,
          sets: r.sets.trim() ? Number(r.sets) : null,
          rpe: r.rpe.trim() ? Number(r.rpe) : null,
        })),
      }));

      const formatSummary =
        format !== "standard"
          ? buildFormatSummary(
              format,
              circuitStations,
              { station: circuitRestStation, round: circuitRestRound },
              circuitRounds,
              format === "amrap" ? amrapMovements : format === "emom" ? emomMovements : format === "tabata" ? tabataMovements : [],
              amrapMins,
              emomIntervalSecs,
              emomTotalMins,
              tabataWork,
              tabataRest,
              tabataRounds
            )
          : "";
      const combinedNotes = [formatSummary, workoutNotes.trim()].filter(Boolean).join("\n\n");

      const res = await saveWorkout.mutateAsync({
        classId,
        notes: combinedNotes,
        exercises: template.map((r) => ({
          exerciseId: r.exerciseId,
          name: r.name,
          weight: r.weight,
          reps: r.reps.trim() ? Number(r.reps) : null,
          sets: r.sets.trim() ? Number(r.sets) : null,
        })),
        results,
      });
      tapFeedback();
      setMessage(res.message ?? "Class workout saved.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the class workout.");
    }
  }

  const libraryExercises = (data?.libraryExercises ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    section: e.section,
  }));

  if (isLoading && !hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {data?.classTitle ?? classTitle ?? "Class workout"}
            </Text>
            {(data?.classDate ?? classDate) && (data?.startTime ?? startTime) ? (
              <Text style={styles.headerSubtitle}>
                {data?.classDate ?? classDate} · {data?.startTime ?? startTime}
              </Text>
            ) : null}
          </View>
        </View>

        <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Save the workout below and it lands in every booked member&apos;s Workouts tab right
            away. Once someone&apos;s checked in you can also enter their exact numbers here, which
            sync straight into their history.
          </Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          {message ? <Text style={styles.successBanner}>{message}</Text> : null}

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Workout</Text>
            <Text style={styles.sectionHint}>
              The shared plan — default weight/reps/sets prefill each member&apos;s row.
            </Text>

            <View style={{ marginTop: Spacing.md }}>
              {template.map((row) => (
                <View key={row.key} style={styles.templateRow}>
                  <View style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <ExerciseAutocomplete
                        exercises={libraryExercises}
                        libraryNames={libraryIndex?.items ?? []}
                        value={row.name}
                        onChange={(name, exerciseId) => updateTemplate(row.key, { name, exerciseId })}
                      />
                    </View>
                    <Pressable
                      onPress={() => setTemplate((prev) => prev.filter((r) => r.key !== row.key))}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                  <View style={styles.gridRow}>
                    <TextInput
                      value={row.weight}
                      onChangeText={(v) => updateTemplate(row.key, { weight: v })}
                      placeholder="Weight"
                      placeholderTextColor={Color.textFaint}
                      style={[inputStyleBase, { flex: 1 }]}
                    />
                    <TextInput
                      value={row.reps}
                      onChangeText={(v) => updateTemplate(row.key, { reps: v })}
                      placeholder="Reps"
                      placeholderTextColor={Color.textFaint}
                      keyboardType="number-pad"
                      style={[inputStyleBase, { flex: 1 }]}
                    />
                    <TextInput
                      value={row.sets}
                      onChangeText={(v) => updateTemplate(row.key, { sets: v })}
                      placeholder="Sets"
                      placeholderTextColor={Color.textFaint}
                      keyboardType="number-pad"
                      style={[inputStyleBase, { flex: 1 }]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Pressable onPress={() => setTemplate((prev) => [...prev, newTemplateRow()])} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Add exercise</Text>
            </Pressable>

            <TextInput
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="Session notes (optional) — warm-up, focus, scaling options"
              placeholderTextColor={Color.textFaint}
              multiline
              style={[inputStyleBase, styles.notesInput]}
            />

            <Text style={[styles.rowLabel, { marginTop: Spacing.md }]}>Format</Text>
            <View style={styles.formatRow}>
              {FORMAT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    tapFeedback();
                    setFormat(opt.value);
                  }}
                  style={[styles.formatChip, format === opt.value && styles.formatChipActive]}
                >
                  <Text style={[styles.formatChipText, format === opt.value && styles.formatChipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {format === "chipper" ? (
              <Text style={styles.sectionHint}>List the movements above as exercises, done once for time.</Text>
            ) : null}

            {format === "circuit" ? (
              <View style={styles.formatConfig}>
                <StationsEditor stations={circuitStations} onChange={setCircuitStations} />
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest / station (s)</Text>
                    <TextInput value={circuitRestStation} onChangeText={setCircuitRestStation} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest / round (s)</Text>
                    <TextInput value={circuitRestRound} onChangeText={setCircuitRestRound} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rounds</Text>
                    <TextInput value={circuitRounds} onChangeText={setCircuitRounds} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                </View>
              </View>
            ) : null}

            {format === "amrap" ? (
              <View style={styles.formatConfig}>
                <Text style={styles.rowLabel}>Time cap (mins)</Text>
                <TextInput value={amrapMins} onChangeText={setAmrapMins} keyboardType="number-pad" style={inputStyleBase} />
                <MovementsEditor movements={amrapMovements} onChange={setAmrapMovements} />
              </View>
            ) : null}

            {format === "emom" ? (
              <View style={styles.formatConfig}>
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Interval (secs)</Text>
                    <TextInput value={emomIntervalSecs} onChangeText={setEmomIntervalSecs} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Total (mins)</Text>
                    <TextInput value={emomTotalMins} onChangeText={setEmomTotalMins} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                </View>
                <MovementsEditor movements={emomMovements} onChange={setEmomMovements} />
              </View>
            ) : null}

            {format === "tabata" ? (
              <View style={styles.formatConfig}>
                <View style={styles.gridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Work (secs)</Text>
                    <TextInput value={tabataWork} onChangeText={setTabataWork} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rest (secs)</Text>
                    <TextInput value={tabataRest} onChangeText={setTabataRest} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Rounds</Text>
                    <TextInput value={tabataRounds} onChangeText={setTabataRounds} keyboardType="number-pad" style={inputStyleBase} />
                  </View>
                </View>
                <MovementsEditor movements={tabataMovements} onChange={setTabataMovements} />
              </View>
            ) : null}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Checked-in members</Text>
            {!data || data.checkedIn.length === 0 ? (
              <Text style={styles.sectionHint}>
                Nobody is checked in yet. Mark attendance on the Classes tab first — results only
                sync for checked-in members.
              </Text>
            ) : (
              <View style={{ marginTop: Spacing.sm }}>
                {data.checkedIn.map((member) => {
                  const open = openMember === member.userId;
                  const rows = rowsFor(member.userId, member.existingExercises);
                  return (
                    <View key={member.userId} style={styles.memberWell}>
                      <Pressable
                        onPress={() => setOpenMember(open ? null : member.userId)}
                        style={styles.memberHeader}
                      >
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberStatus}>
                          {member.existingExercises ? "Synced — edit" : open ? "Close" : "Enter results"}
                        </Text>
                      </Pressable>

                      {open ? (
                        <View style={styles.memberBody}>
                          {rows.map((row) => (
                            <View key={row.key} style={{ marginBottom: Spacing.sm }}>
                              <Text style={styles.rowLabel}>{row.name}</Text>
                              <View style={styles.gridRow4}>
                                <TextInput
                                  value={row.weight}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { weight: v })}
                                  placeholder="Weight"
                                  placeholderTextColor={Color.textFaint}
                                  style={[inputStyleBase, { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.reps}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { reps: v })}
                                  placeholder="Reps"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase, { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.sets}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { sets: v })}
                                  placeholder="Sets"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase, { flex: 1 }]}
                                />
                                <TextInput
                                  value={row.rpe}
                                  onChangeText={(v) => updateMemberRow(member.userId, member.existingExercises, row.key, { rpe: v })}
                                  placeholder="RPE"
                                  placeholderTextColor={Color.textFaint}
                                  keyboardType="number-pad"
                                  style={[inputStyleBase, { flex: 1 }]}
                                />
                              </View>
                            </View>
                          ))}
                          <TextInput
                            value={memberNotes[member.userId] ?? ""}
                            onChangeText={(v) => {
                              setMemberNotes((prev) => ({ ...prev, [member.userId]: v }));
                              setMessage(null);
                            }}
                            placeholder="Notes for this member (optional)"
                            placeholderTextColor={Color.textFaint}
                            style={inputStyleBase}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <Button
            title={saveWorkout.isPending ? "Saving…" : "Save & sync to members"}
            onPress={handleSave}
            loading={saveWorkout.isPending}
            style={{ marginTop: Spacing.sm }}
          />
        </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  headerSubtitle: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: { fontSize: 12, color: Color.textMuted, lineHeight: 18, marginBottom: Spacing.md },
  errorBanner: {
    fontSize: 12,
    color: Color.danger,
    backgroundColor: Color.dangerWeak,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  successBanner: {
    fontSize: 12,
    color: Color.gold,
    backgroundColor: Color.goldWeak,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionCard: { padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  sectionHint: { fontSize: 12, color: Color.textMuted, marginTop: 4 },
  templateRow: {
    backgroundColor: Color.surface2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  removeButton: { paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  removeText: { fontSize: 12, color: Color.danger },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  gridRow4: { flexDirection: "row", gap: Spacing.xs },
  addChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  addChipText: { fontSize: 11, fontWeight: "600", color: Color.textSecondary },
  notesInput: { marginTop: Spacing.md, minHeight: 64, textAlignVertical: "top", paddingVertical: Spacing.sm },
  memberWell: {
    backgroundColor: Color.surface2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  memberHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  memberName: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  memberStatus: { fontSize: 11, color: Color.textMuted },
  memberBody: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  rowLabel: { fontSize: 12, fontWeight: "600", color: Color.textPrimary, marginBottom: 6 },
  formatRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },
  formatChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  formatChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  formatChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  formatChipTextActive: { color: Color.gold },
  formatConfig: { marginTop: Spacing.sm },
  formatAddButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.gold,
  },
  formatModeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle },
  formatModeText: { fontSize: 10, fontWeight: "700", color: Color.textMuted },
  stationRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  movementsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  movementChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  movementChipText: { fontSize: 11, color: Color.textSecondary, fontWeight: "500" },
});

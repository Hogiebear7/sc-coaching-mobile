import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete } from "@/components/ui/ExerciseAutocomplete";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
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
  const saveWorkout = useSaveClassWorkout();

  const [template, setTemplate] = useState<TemplateRow[]>([newTemplateRow()]);
  const [workoutNotes, setWorkoutNotes] = useState("");
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

      const res = await saveWorkout.mutateAsync({
        classId,
        notes: workoutNotes,
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      </KeyboardAvoidingView>
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
});

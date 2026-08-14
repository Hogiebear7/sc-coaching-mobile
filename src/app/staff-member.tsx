import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { API_BASE_URL } from "@/constants/config";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useStaffNutritionTarget } from "@/lib/queries/nutrition-diary";
import { useStaffPrograms } from "@/lib/queries/programs";
import { useSaveCoachNotes, useStaffMemberDetail } from "@/lib/queries/staff";
import type { TrainingDayOfWeek } from "@/lib/queries/weekly-training";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const WEEKDAY_ORDER: TrainingDayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL: Record<TrainingDayOfWeek, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};

function openMemberOnWeb(userId: string) {
  tapFeedback();
  Linking.openURL(`${API_BASE_URL}/staff/members/${userId}`);
}

export default function StaffMemberScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data, isLoading, isError, refetch } = useStaffMemberDetail(userId);
  const { data: programs } = useStaffPrograms(userId);
  const activeProgram = programs?.find((p) => p.status === "active") ?? null;
  const { data: nutritionTarget } = useStaffNutritionTarget(userId);

  const saveNotes = useSaveCoachNotes(userId);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (data && !notesDirty) setNotes(data.coachNotes ?? "");
  }, [data, notesDirty]);

  async function handleSaveNotes() {
    await saveNotes.mutateAsync(notes);
    setNotesDirty(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Member</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load this member.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.name}>{data.fullName ?? data.email}</Text>
          <Text style={styles.email}>{data.email}</Text>

          <Button
            title="Message member"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/staff-message-thread",
                params: { memberId: userId, memberName: data.fullName ?? data.email },
              })
            }
            style={{ marginBottom: Spacing.md }}
          />

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>MEMBERSHIP</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Plan</Text>
              <Text style={styles.rowValue}>{data.currentPlanName ?? "No active plan"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text style={styles.rowValue}>{data.currentStatus ?? "—"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Renews / ends</Text>
              <Text style={styles.rowValue}>{formatDate(data.currentPeriodEnd)}</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Phone</Text>
              <Text style={styles.rowValue}>{data.phone ?? "—"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Date of birth</Text>
              <Text style={styles.rowValue}>{formatDate(data.dateOfBirth)}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Joined</Text>
              <Text style={styles.rowValue}>{formatDate(data.joinedAt)}</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
            {!data.emergencyContactName && !data.emergencyContactPhone ? (
              <Text style={styles.rowValue}>Not provided yet.</Text>
            ) : (
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>{data.emergencyContactName ?? "—"}</Text>
                <Text style={styles.rowValue}>{data.emergencyContactPhone ?? "—"}</Text>
              </View>
            )}
            {data.emergencyContact2Name || data.emergencyContact2Phone ? (
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>{data.emergencyContact2Name ?? "—"}</Text>
                <Text style={styles.rowValue}>{data.emergencyContact2Phone ?? "—"}</Text>
              </View>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>TRAINING</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Primary goal</Text>
              <Text style={styles.rowValue}>{data.primaryGoal}</Text>
            </View>
            {data.sportPlayed ? (
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>Sport</Text>
                <Text style={styles.rowValue}>{data.sportPlayed}</Text>
              </View>
            ) : null}
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Sessions logged</Text>
              <Text style={styles.rowValue}>{data.totalSessionsLogged}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Total bookings</Text>
              <Text style={styles.rowValue}>{data.totalBookings}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Last session</Text>
              <Text style={styles.rowValue}>{formatDate(data.lastSessionDate)}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Latest readiness</Text>
              <Text style={styles.rowValue}>
                {data.latestReadinessScore !== null ? `${data.latestReadinessScore}/100` : "No check-in yet"}
              </Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>PERSONAL BESTS</Text>
            <View style={styles.pbGrid}>
              {data.personalBests.map((pb) => (
                <View key={pb.label} style={styles.pbCell}>
                  <Text style={styles.pbLabel}>{pb.label}</Text>
                  {!pb.heaviestWeight && !pb.highestReps ? (
                    <Text style={styles.pbEmpty}>No data yet.</Text>
                  ) : (
                    <>
                      {pb.heaviestWeight ? (
                        <Text style={styles.pbValue}>
                          {pb.heaviestWeight.weightStr}
                          {pb.heaviestWeight.reps !== null ? ` × ${pb.heaviestWeight.reps}` : ""}
                        </Text>
                      ) : null}
                      {pb.highestReps ? <Text style={styles.pbValue}>{pb.highestReps.reps} reps</Text> : null}
                    </>
                  )}
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>WEEKLY TRAINING PATTERN</Text>
            {!data.weeklyTrainingSchedule || data.weeklyTrainingSchedule.sessions.length === 0 ? (
              <Text style={styles.rowValue}>Not set up yet.</Text>
            ) : (
              WEEKDAY_ORDER.map((day) => {
                const sessions = data.weeklyTrainingSchedule!.sessions.filter((s) => s.dayOfWeek === day);
                if (sessions.length === 0) return null;
                return (
                  <View key={day} style={styles.rowLine}>
                    <Text style={styles.rowLabel}>{WEEKDAY_LABEL[day]}</Text>
                    <Text style={styles.rowValue}>
                      {sessions
                        .map((s) => [s.label, s.timeOfDay, s.intensity].filter(Boolean).join(" · "))
                        .join(", ")}
                    </Text>
                  </View>
                );
              })
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>UPCOMING BOOKINGS</Text>
            {data.upcomingBookings.length === 0 ? (
              <Text style={styles.rowValue}>No upcoming bookings.</Text>
            ) : (
              data.upcomingBookings.map((b) => (
                <View key={b.bookingId} style={styles.bookingRow}>
                  <Text style={styles.bookingTitle}>{b.title}</Text>
                  <Text style={styles.bookingMeta}>
                    {formatDate(b.date)} · {b.startTime}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {data.pastBookings.length > 0 ? (
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>PAST BOOKINGS</Text>
              {data.pastBookings.map((b) => (
                <View key={b.bookingId} style={styles.bookingRow}>
                  <Text style={styles.bookingTitle}>{b.title}</Text>
                  <Text style={styles.bookingMeta}>
                    {formatDate(b.date)} · {b.startTime}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>TRAINING PROGRAM</Text>
            {activeProgram ? (
              <>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Program</Text>
                  <Text style={styles.rowValue}>{activeProgram.name}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Days</Text>
                  <Text style={styles.rowValue}>{activeProgram.days.length}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Next up</Text>
                  <Text style={styles.rowValue}>{activeProgram.days[activeProgram.currentDayIndex]?.label ?? "—"}</Text>
                </View>
                <Button
                  title="Edit program"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: "/staff-program-builder", params: { userId, programId: activeProgram.id } })
                  }
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <>
                <Text style={styles.rowValue}>No program assigned yet.</Text>
                <Button
                  title="Assign program"
                  onPress={() => router.push({ pathname: "/staff-program-builder", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>NUTRITION TARGET</Text>
            {nutritionTarget ? (
              <>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Calories</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.calories} kcal</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Protein</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.proteinG} g</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Carbs</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.carbsG} g</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Fat</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.fatG} g</Text>
                </View>
                <Button
                  title="Edit target"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/staff-nutrition-target", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <>
                <Text style={styles.rowValue}>No target set yet.</Text>
                <Button
                  title="Set target"
                  onPress={() => router.push({ pathname: "/staff-nutrition-target", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>COACH NOTES</Text>
            <Text style={styles.notesHint}>Internal only — the member never sees these.</Text>
            <TextInput
              value={notes}
              onChangeText={(t) => {
                setNotes(t);
                setNotesDirty(true);
                setNotesSaved(false);
              }}
              placeholder="Add training cues, injury history, preferences…"
              placeholderTextColor={Color.textFaint}
              style={styles.notesInput}
              multiline
            />
            <View style={styles.notesFooter}>
              {notesSaved ? <Text style={styles.notesSaved}>Saved</Text> : <View />}
              <Button
                title="Save notes"
                variant="secondary"
                onPress={handleSaveNotes}
                loading={saveNotes.isPending}
                disabled={!notesDirty || saveNotes.isPending}
                style={styles.notesSaveButton}
              />
            </View>
          </Card>

          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>
              Billing and account actions (plan changes, refunds, hard delete) still require the staff web app —
              this device may not show every permission a full admin has.
            </Text>
            <Button
              title="Manage billing & account on web"
              variant="secondary"
              onPress={() => openMemberOnWeb(userId)}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
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
  name: { fontSize: 20, fontWeight: "700", color: Color.textPrimary },
  email: { fontSize: 12, color: Color.textMuted, marginTop: 2, marginBottom: Spacing.lg },
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  rowLabel: { fontSize: 12, color: Color.textMuted },
  rowValue: { fontSize: 13, color: Color.textPrimary, fontWeight: "500" },
  noteCard: { padding: Spacing.md, marginBottom: Spacing.md },
  noteText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  notesHint: { fontSize: 11, color: Color.textFaint, marginBottom: Spacing.sm },
  notesInput: {
    minHeight: 80,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    color: Color.textPrimary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  notesSaved: { fontSize: 11, color: Color.success, fontWeight: "600" },
  notesSaveButton: { height: 36, paddingHorizontal: Spacing.md },
  pbGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pbCell: {
    width: "47%",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.sm,
  },
  pbLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: Color.textFaint, marginBottom: 4 },
  pbValue: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  pbEmpty: { fontSize: 12, color: Color.textFaint },
  bookingRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  bookingTitle: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  bookingMeta: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
});

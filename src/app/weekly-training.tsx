import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
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
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { tapFeedback } from "@/lib/haptics";
import {
  useUpdateWeeklyTraining,
  useWeeklyTraining,
  type TrainingActivityType,
  type TrainingDayOfWeek,
  type TrainingIntensity,
  type TrainingTimeOfDay,
  type WeeklyTrainingSession,
} from "@/lib/queries/weekly-training";

let keySeq = 0;
function nextId(): string {
  keySeq += 1;
  return `wt-${Date.now()}-${keySeq}`;
}

function newSession(dayOfWeek: TrainingDayOfWeek): WeeklyTrainingSession {
  return {
    id: nextId(),
    dayOfWeek,
    label: "",
    activityType: "gym",
    timeOfDay: null,
    intensity: null,
    notes: null,
    recurring: true,
    weekOf: null,
  };
}

// Monday-first display order — reads more naturally as "the week" than
// Date#getDay()'s Sunday-first numbering, which is what's actually stored.
const DAY_ORDER: TrainingDayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<TrainingDayOfWeek, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};

const ACTIVITY_OPTIONS: { value: TrainingActivityType; label: string }[] = [
  { value: "gym", label: "Gym" },
  { value: "sport", label: "Sport" },
  { value: "cardio", label: "Cardio" },
  { value: "rest", label: "Rest" },
  { value: "other", label: "Other" },
];

const TIME_OPTIONS: { value: TrainingTimeOfDay | null; label: string }[] = [
  { value: null, label: "Any time" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

const INTENSITY_OPTIONS: { value: TrainingIntensity | null; label: string }[] = [
  { value: null, label: "—" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// Members set a recurring weekly pattern of when/what they train — including
// activities outside the gym (sport practice, running club) that never
// touch logged workout data — so the nutrition AI coach and staff can see
// the member's typical week. Full-replace save: the whole session list is
// sent on every "Save", matching the backend's upsert-by-userId semantics.
export default function WeeklyTrainingScreen() {
  const router = useRouter();
  const { data, isLoading } = useWeeklyTraining();
  const updateSchedule = useUpdateWeeklyTraining();

  const [sessions, setSessions] = useState<WeeklyTrainingSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each session card has several chip rows below its label input — on a
  // shorter screen the keyboard can cover all of them once it opens, and
  // KeyboardAvoidingView alone only resizes the container, it doesn't scroll
  // a specific field into view. Scroll the tapped card to the top instead.
  const scrollRef = useRef<ScrollView>(null);
  const cardRefs = useRef<Record<string, View | null>>({});

  function scrollCardIntoView(id: string) {
    const card = cardRefs.current[id];
    const scrollNode = scrollRef.current;
    if (!card || !scrollNode) return;
    const scrollHandle = findNodeHandle(scrollNode);
    if (!scrollHandle) return;
    setTimeout(() => {
      card.measureLayout(
        scrollHandle,
        (_x, y) => scrollNode.scrollTo({ y: Math.max(0, y - 12), animated: true }),
        () => {}
      );
    }, 150);
  }

  useEffect(() => {
    if (hydrated || isLoading) return;
    setSessions(data?.sessions ?? []);
    setHydrated(true);
  }, [data, hydrated, isLoading]);

  function updateSession(id: string, patch: Partial<Omit<WeeklyTrainingSession, "id" | "dayOfWeek">>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSession(id: string) {
    tapFeedback();
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function addSession(day: TrainingDayOfWeek) {
    tapFeedback();
    setSessions((prev) => [...prev, newSession(day)]);
  }

  async function handleSave() {
    setError(null);
    const payload = sessions.filter((s) => s.label.trim()).map((s) => ({ ...s, label: s.label.trim() }));
    try {
      await updateSchedule.mutateAsync(payload);
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your weekly pattern. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Weekly Training</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : (
        <>
          <View style={styles.introBlock}>
            <Text style={styles.introText}>
              Set your typical week — gym sessions, sport practice, anything else — so your nutrition coach and your
              trainer can see your real training load, not just what&apos;s logged here. Mark a session &quot;This
              week only&quot; for a one-off that shouldn&apos;t stick around — it clears itself once the week&apos;s
              over.
            </Text>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
            {DAY_ORDER.map((day) => {
              const daySessions = sessions.filter((s) => s.dayOfWeek === day);
              return (
                <View key={day} style={styles.daySection}>
                  <View style={styles.dayHeaderRow}>
                    <Text style={styles.dayLabel}>{DAY_LABEL[day]}</Text>
                    <Pressable onPress={() => addSession(day)} style={styles.addChip}>
                      <Ionicons name="add" size={14} color={Color.gold} />
                      <Text style={styles.addChipText}>Add session</Text>
                    </Pressable>
                  </View>

                  {daySessions.length === 0 ? (
                    <Text style={styles.dayEmptyText}>Nothing set</Text>
                  ) : (
                    daySessions.map((s) => (
                      <View key={s.id} ref={(el) => { cardRefs.current[s.id] = el; }}>
                      <Card style={styles.sessionCard}>
                        <View style={styles.sessionTopRow}>
                          <TextInput
                            value={s.label}
                            onChangeText={(text) => updateSession(s.id, { label: text })}
                            onFocus={() => scrollCardIntoView(s.id)}
                            placeholder="e.g. Football training"
                            placeholderTextColor={Color.textFaint}
                            style={styles.labelInput}
                          />
                          <Pressable onPress={() => removeSession(s.id)} hitSlop={10} style={styles.removeButton}>
                            <Ionicons name="trash-outline" size={16} color={Color.textFaint} />
                          </Pressable>
                        </View>

                        <View style={styles.chipRow}>
                          {ACTIVITY_OPTIONS.map((opt) => (
                            <Chip
                              key={opt.value}
                              label={opt.label}
                              active={s.activityType === opt.value}
                              onPress={() => updateSession(s.id, { activityType: opt.value })}
                            />
                          ))}
                        </View>
                        <View style={styles.chipRow}>
                          {TIME_OPTIONS.map((opt) => (
                            <Chip
                              key={opt.label}
                              label={opt.label}
                              active={s.timeOfDay === opt.value}
                              onPress={() => updateSession(s.id, { timeOfDay: opt.value })}
                            />
                          ))}
                        </View>
                        <View style={styles.chipRow}>
                          {INTENSITY_OPTIONS.map((opt) => (
                            <Chip
                              key={opt.label}
                              label={opt.label}
                              active={s.intensity === opt.value}
                              onPress={() => updateSession(s.id, { intensity: opt.value })}
                            />
                          ))}
                        </View>
                        <View style={styles.recurringRow}>
                          <View style={styles.chipRow}>
                            <Chip label="Every week" active={s.recurring} onPress={() => updateSession(s.id, { recurring: true })} />
                            <Chip label="This week only" active={!s.recurring} onPress={() => updateSession(s.id, { recurring: false })} />
                          </View>
                          {!s.recurring ? (
                            <Text style={styles.oneOffHint}>Clears automatically after this week.</Text>
                          ) : null}
                        </View>
                      </Card>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Save" onPress={handleSave} loading={updateSchedule.isPending} />
          </View>
        </>
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
  introBlock: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  introText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  daySection: { marginBottom: Spacing.lg },
  dayHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  dayLabel: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  addChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  addChipText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  dayEmptyText: { fontSize: 12, color: Color.textFaint, fontStyle: "italic" },
  sessionCard: { padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  sessionTopRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  labelInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  removeButton: { padding: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
  recurringRow: { borderTopWidth: 1, borderTopColor: Color.borderSubtle, paddingTop: Spacing.sm, marginTop: 2 },
  oneOffHint: { fontSize: 11, color: Color.textFaint, marginTop: 6, fontStyle: "italic" },
  errorText: { fontSize: 12, color: Color.warning, textAlign: "center", marginTop: Spacing.sm },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
});

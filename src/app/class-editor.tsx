import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { MonthDatePicker } from "@/components/ui/MonthDatePicker";
import { Stepper } from "@/components/ui/Stepper";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { tapFeedback } from "@/lib/haptics";
import {
  useDeleteClass,
  useSaveClass,
  useStaffClassCategories,
  useStaffClasses,
  useStopClassSeries,
} from "@/lib/queries/staff";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

// A curated set of common class start times as tap targets — the raw text
// field below still covers anything else, so this is a convenience, not a
// constraint.
const QUICK_TIMES = ["06:00", "07:00", "09:00", "12:00", "17:00", "18:00", "19:00"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
}
function isValidTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export default function ClassEditorScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const isEditing = !!classId;

  // No dedicated GET-by-id route exists server-side — the web app edits
  // client-side from its full list too, so this reuses the same cached
  // list the Classes tab already fetched rather than adding a new endpoint.
  const { data: classes, isLoading: classesLoading } = useStaffClasses();
  const { data: categories } = useStaffClassCategories();
  const saveClass = useSaveClass();
  const deleteClass = useDeleteClass();
  const stopSeries = useStopClassSeries();

  const existing = isEditing ? classes?.find((c) => c.id === classId) : undefined;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(isoOf(new Date()));
  const [startTime, setStartTime] = useState("");
  const [durationMins, setDurationMins] = useState(60);
  const [capacity, setCapacity] = useState(12);
  const [repeat, setRepeat] = useState<"none" | "weekly">("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fires once the matched class actually loads (id transitions from
  // undefined to a real value) — not on every refetch, so it doesn't stomp
  // on in-progress edits if the list silently revalidates in the background.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setCategory(existing.category);
    setDate(existing.date);
    setStartTime(existing.startTime);
    setDurationMins(existing.durationMins);
    setCapacity(existing.capacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  useEffect(() => {
    if (!isEditing && !category && categories && categories.length > 0) {
      setCategory(categories[0].slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, isEditing]);

  function toggleWeekday(v: number) {
    tapFeedback();
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort()));
  }

  async function handleSave() {
    setError(null);
    if (!title.trim()) return setError("Class name is required.");
    if (!category) return setError("Pick a category.");
    if (!isValidDate(date)) return setError("Date must be in YYYY-MM-DD format.");
    if (!isValidTime(startTime)) return setError("Start time must be in HH:MM (24-hour) format.");
    if (repeat === "weekly" && weekdays.length === 0) return setError("Pick at least one day for a repeating class.");
    const trimmedEndDate = repeatEndDate.trim();
    if (repeat === "weekly" && trimmedEndDate && !isValidDate(trimmedEndDate)) {
      return setError("End date must be in YYYY-MM-DD format.");
    }

    try {
      await saveClass.mutateAsync({
        id: existing?.id,
        title: title.trim(),
        category,
        date,
        startTime,
        durationMins,
        capacity,
        repeat: isEditing ? "none" : repeat,
        weekdays: repeat === "weekly" ? weekdays : undefined,
        repeatEndDate: repeat === "weekly" && trimmedEndDate ? trimmedEndDate : null,
      });
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this class. Please try again.");
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert("Delete this class?", "Anyone booked will be removed and their credit returned. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteClass.mutateAsync(existing.id);
            tapFeedback();
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof ApiError ? e.message : "Please try again.");
          }
        },
      },
    ]);
  }

  function confirmStopSeries() {
    if (!existing?.seriesId) return;
    const seriesId = existing.seriesId;
    Alert.alert(
      "Stop this repeating series?",
      "No new occurrences will be created. Classes already booked stay as-is — cancel those individually if needed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop series",
          style: "destructive",
          onPress: async () => {
            try {
              await stopSeries.mutateAsync(seriesId);
              tapFeedback();
              router.back();
            } catch (e) {
              Alert.alert("Couldn't stop series", e instanceof ApiError ? e.message : "Please try again.");
            }
          },
        },
      ]
    );
  }

  const today = isoOf(new Date());
  const tomorrow = isoOf(addDays(new Date(), 1));

  if (isEditing && classesLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isEditing && !existing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Class</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t find this class — it may have been deleted, or falls outside the next 14 days.</Text>
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
        <Text style={styles.headerTitle}>{isEditing ? "Edit Class" : "New Class"}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Class name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Saturday HIIT"
          placeholderTextColor={Color.textFaint}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipRow}>
          {(categories ?? []).map((c) => (
            <Pressable key={c.slug} onPress={() => setCategory(c.slug)} style={[styles.chip, category === c.slug && styles.chipActive]}>
              <Text style={[styles.chipText, category === c.slug && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Date</Text>
        <View style={styles.chipRow}>
          <Pressable onPress={() => setDate(today)} style={[styles.chip, date === today && styles.chipActive]}>
            <Text style={[styles.chipText, date === today && styles.chipTextActive]}>Today</Text>
          </Pressable>
          <Pressable onPress={() => setDate(tomorrow)} style={[styles.chip, date === tomorrow && styles.chipActive]}>
            <Text style={[styles.chipText, date === tomorrow && styles.chipTextActive]}>Tomorrow</Text>
          </Pressable>
          <Pressable
            onPress={() => setCalendarOpen((v) => !v)}
            style={[styles.chip, { flexDirection: "row", alignItems: "center" }, calendarOpen && styles.chipActive]}
          >
            <Ionicons name="calendar-outline" size={13} color={calendarOpen ? Color.gold : Color.textMuted} />
            <Text style={[styles.chipText, calendarOpen && styles.chipTextActive, { marginLeft: 4 }]}>Calendar</Text>
          </Pressable>
        </View>

        {calendarOpen ? (
          <MonthDatePicker
            value={date}
            minDate={today}
            onChange={(iso) => {
              tapFeedback();
              setDate(iso);
              setCalendarOpen(false);
            }}
          />
        ) : null}

        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Color.textFaint}
          style={[styles.input, { marginTop: Spacing.xs }]}
          autoCapitalize="none"
        />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Start time</Text>
        <View style={styles.chipRow}>
          {QUICK_TIMES.map((t) => (
            <Pressable key={t} onPress={() => setStartTime(t)} style={[styles.chip, startTime === t && styles.chipActive]}>
              <Text style={[styles.chipText, startTime === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={startTime}
          onChangeText={setStartTime}
          placeholder="HH:MM (24-hour)"
          placeholderTextColor={Color.textFaint}
          style={[styles.input, { marginTop: Spacing.xs }]}
          autoCapitalize="none"
        />

        <Stepper label="Duration" value={durationMins} onChange={setDurationMins} min={15} max={180} step={15} suffix="min" />
        <Stepper label="Capacity" value={capacity} onChange={setCapacity} min={1} max={50} step={1} suffix="spots" />

        {!isEditing ? (
          <>
            <Text style={styles.fieldLabel}>Repeat</Text>
            <View style={styles.chipRow}>
              <Pressable onPress={() => setRepeat("none")} style={[styles.chip, repeat === "none" && styles.chipActive]}>
                <Text style={[styles.chipText, repeat === "none" && styles.chipTextActive]}>One-off</Text>
              </Pressable>
              <Pressable onPress={() => setRepeat("weekly")} style={[styles.chip, repeat === "weekly" && styles.chipActive]}>
                <Text style={[styles.chipText, repeat === "weekly" && styles.chipTextActive]}>Repeats weekly</Text>
              </Pressable>
            </View>

            {repeat === "weekly" ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>On which days</Text>
                <View style={styles.chipRow}>
                  {WEEKDAYS.map((w) => (
                    <Pressable key={w.value} onPress={() => toggleWeekday(w.value)} style={[styles.chip, weekdays.includes(w.value) && styles.chipActive]}>
                      <Text style={[styles.chipText, weekdays.includes(w.value) && styles.chipTextActive]}>{w.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>End date (optional)</Text>
                <TextInput
                  value={repeatEndDate}
                  onChangeText={setRepeatEndDate}
                  placeholder="YYYY-MM-DD — leave blank to repeat indefinitely"
                  placeholderTextColor={Color.textFaint}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={isEditing ? "Save changes" : "Create class"} onPress={handleSave} loading={saveClass.isPending} style={{ marginTop: Spacing.lg }} />

        {isEditing ? (
          <>
            {existing?.seriesId ? (
              <Pressable onPress={confirmStopSeries} disabled={stopSeries.isPending} style={styles.dangerLink}>
                <Text style={styles.dangerLinkText}>{stopSeries.isPending ? "Stopping…" : "Stop repeating series"}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={confirmDelete} disabled={deleteClass.isPending} style={styles.dangerLink}>
              <Text style={styles.dangerLinkText}>{deleteClass.isPending ? "Deleting…" : "Delete this class"}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Color.textPrimary,
    marginBottom: Spacing.md,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.sm, textAlign: "center" },
  dangerLink: { alignItems: "center", paddingVertical: Spacing.md },
  dangerLinkText: { fontSize: 13, fontWeight: "600", color: Color.danger },
});

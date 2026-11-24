import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { TextField } from "@/components/ui/TextField";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { INJURY_AREAS } from "@/lib/session-engine/types";
import { selectionFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { newTargetId, normaliseTime } from "@/lib/targets/data";
import type { Target, TargetKind, TargetPeriod } from "@/lib/targets";
import { ensureReminderPermission } from "@/lib/targets/reminders";
import { useTargets } from "@/lib/targets/store";

type ReminderMode = "none" | "times" | "every";

const UNITS = ["reps", "sets", "minutes", "km", "sessions", "times"];
const PERIODS: { value: TargetPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
// Monday first.
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const EVERY_OPTIONS = [60, 90, 120, 180];
const AREA_LABEL: Record<string, string> = {
  ankle: "Ankle",
  knee: "Knee",
  hip: "Hip",
  lower_back: "Lower back",
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  neck: "Neck",
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function TargetEditScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { loading, targets } = useTargets();
  const existing = params.id ? targets.find((t) => t.id === params.id) ?? null : null;
  const kind: TargetKind = existing ? existing.kind : params.kind === "rehab" ? "rehab" : "goal";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{existing ? "Edit" : "Add"} {kind === "rehab" ? "rehab exercise" : "goal"}</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : params.id && !existing ? (
        <View style={styles.center}>
          <Text style={styles.muted}>This one no longer exists.</Text>
        </View>
      ) : (
        <TargetForm key={existing?.id ?? "new"} kind={kind} existing={existing} />
      )}
    </SafeAreaView>
  );
}

function TargetForm({ kind, existing }: { kind: TargetKind; existing: Target | null }) {
  const styles = useStyles();
  const router = useRouter();
  const { save, remove } = useTargets();

  const initialMode: ReminderMode = existing?.reminders?.every ? "every" : existing?.reminders?.times?.length ? "times" : "none";
  const [title, setTitle] = useState(existing?.title ?? "");
  const [count, setCount] = useState(existing ? String(existing.goalCount) : kind === "rehab" ? "3" : "");
  const [unit, setUnit] = useState(existing?.unit ?? (kind === "rehab" ? "sets" : "reps"));
  const [period, setPeriod] = useState<TargetPeriod>(existing?.period ?? "day");
  const [days, setDays] = useState<number[]>(existing?.days ?? []);
  const [mode, setMode] = useState<ReminderMode>(initialMode);
  const [times, setTimes] = useState<string[]>(existing?.reminders?.times?.length ? existing.reminders.times : ["09:00"]);
  const [everyMinutes, setEveryMinutes] = useState(existing?.reminders?.every?.minutes ?? 120);
  const [everyStart, setEveryStart] = useState(existing?.reminders?.every?.start ?? "09:00");
  const [everyEnd, setEveryEnd] = useState(existing?.reminders?.every?.end ?? "20:00");
  const [area, setArea] = useState<string | null>(existing?.area ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  async function onSave() {
    const goalCount = Number(count.replace(",", "."));
    if (!title.trim()) return setError("Give it a name.");
    if (!Number.isFinite(goalCount) || goalCount <= 0) return setError("Enter how many, as a number above zero.");
    if (!unit.trim()) return setError("Say what you're counting (reps, minutes, km...).");

    let reminders: Target["reminders"];
    if (mode === "times") {
      const cleaned = times.map((t) => normaliseTime(t));
      if (cleaned.some((t) => t === null)) return setError("Reminder times need the form 09:00 or 18:30.");
      reminders = { times: [...new Set(cleaned as string[])] };
    } else if (mode === "every") {
      const start = normaliseTime(everyStart);
      const end = normaliseTime(everyEnd);
      if (!start || !end) return setError("Start and end times need the form 09:00 or 20:00.");
      if (end < start) return setError("The end time must be after the start time.");
      reminders = { every: { minutes: everyMinutes, start, end } };
    }

    setSaving(true);
    setError(null);
    const target: Target = {
      id: existing?.id ?? newTargetId(),
      kind,
      title: title.trim(),
      period,
      goalCount,
      unit: unit.trim(),
      days: period === "day" && days.length > 0 && days.length < 7 ? days : undefined,
      reminders,
      active,
      notes: notes.trim() || undefined,
      area: kind === "rehab" && area ? area : undefined,
    };
    await save(target);
    if (reminders && active) {
      const allowed = await ensureReminderPermission();
      if (!allowed) {
        Alert.alert("Reminders are off", "Notifications are turned off for this app, so there will be no reminders. You can turn them on in your phone's settings. Your goal is saved either way.");
      }
    }
    setSaving(false);
    router.back();
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert("Delete this?", `"${existing.title}" and its history will be removed from this phone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void remove(existing.id).then(() => router.back());
        },
      },
    ]);
  }

  return (
    <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
      <TextField
        label={kind === "rehab" ? "Exercise" : "Goal"}
        value={title}
        onChangeText={setTitle}
        placeholder={kind === "rehab" ? "Band ankle circles" : "Squats"}
        maxLength={80}
        autoCapitalize="sentences"
      />

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <TextField label="How many" value={count} onChangeText={setCount} keyboardType="decimal-pad" placeholder={kind === "rehab" ? "3" : "500"} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Counting" value={unit} onChangeText={setUnit} placeholder="reps" maxLength={24} autoCapitalize="none" />
        </View>
      </View>
      <View style={styles.chips}>
        {UNITS.map((u) => (
          <Chip key={u} label={u} active={unit.trim().toLowerCase() === u} onPress={() => setUnit(u)} />
        ))}
      </View>

      <Text style={styles.label}>{kind === "rehab" ? "How often" : "Per"}</Text>
      <View style={styles.chips}>
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} active={period === p.value} onPress={() => setPeriod(p.value)} />
        ))}
      </View>

      {period === "day" ? (
        <>
          <Text style={styles.label}>Which days (none selected means every day)</Text>
          <View style={styles.chips}>
            {DAYS.map((d) => (
              <Chip key={d.value} label={d.label} active={days.includes(d.value)} onPress={() => toggleDay(d.value)} />
            ))}
          </View>
        </>
      ) : null}

      {kind === "rehab" ? (
        <>
          <Text style={styles.label}>Body area (so the workout generator can go easy on it)</Text>
          <View style={styles.chips}>
            {INJURY_AREAS.map((a) => (
              <Chip key={a} label={AREA_LABEL[a] ?? a} active={area === a} onPress={() => setArea(area === a ? null : a)} />
            ))}
          </View>
          <TextField label="Notes (what your physio said, tempo, band colour)" value={notes} onChangeText={setNotes} multiline maxLength={400} style={{ minHeight: 80 }} />
        </>
      ) : null}

      <Text style={styles.label}>Reminders</Text>
      <View style={styles.chips}>
        <Chip label="None" active={mode === "none"} onPress={() => setMode("none")} />
        <Chip label="At set times" active={mode === "times"} onPress={() => setMode("times")} />
        <Chip label="Every few hours" active={mode === "every"} onPress={() => setMode("every")} />
      </View>

      {mode === "times" ? (
        <View style={styles.block}>
          {times.map((t, i) => (
            <View key={i} style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <TextField label={`Time ${i + 1}`} value={t} onChangeText={(v) => setTimes((cur) => cur.map((x, j) => (j === i ? v : x)))} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} />
              </View>
              {times.length > 1 ? (
                <Pressable onPress={() => setTimes((cur) => cur.filter((_, j) => j !== i))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove time ${i + 1}`}>
                  <Ionicons name="close-circle-outline" size={24} color="#888" />
                </Pressable>
              ) : null}
            </View>
          ))}
          {times.length < 6 ? <Button title="Add another time" variant="secondary" onPress={() => setTimes((cur) => [...cur, "18:00"])} /> : null}
        </View>
      ) : null}

      {mode === "every" ? (
        <View style={styles.block}>
          <Text style={styles.label}>Every</Text>
          <View style={styles.chips}>
            {EVERY_OPTIONS.map((m) => (
              <Chip key={m} label={m % 60 === 0 ? `${m / 60} h` : `${m} min`} active={everyMinutes === m} onPress={() => setEveryMinutes(m)} />
            ))}
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <TextField label="From" value={everyStart} onChangeText={setEveryStart} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Until" value={everyEnd} onChangeText={setEveryEnd} placeholder="20:00" keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
          </View>
        </View>
      ) : null}

      {mode !== "none" ? (
        <Text style={styles.muted}>
          Reminders are scheduled a few days ahead on your phone. Open the app at least once a week to keep them topped up. Once a daily target is done, the rest of that day&apos;s reminders are dropped.
        </Text>
      ) : null}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Active</Text>
          <Text style={styles.muted}>Switch off to pause it without deleting.</Text>
        </View>
        <Switch value={active} onValueChange={setActive} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save" onPress={() => void onSave()} loading={saving} />
      {existing ? <Button title="Delete" variant="secondary" onPress={onDelete} /> : null}
    </KeyboardAwareScroll>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: AppSpace.gutter, paddingVertical: 8 },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { ...appTitle(20, c.text), fontSize: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { padding: AppSpace.gutter, gap: 14, paddingBottom: 56 },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: "600" },
    muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    row2: { flexDirection: "row", gap: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: c.control, borderRadius: AppRadius.control, paddingHorizontal: 14, paddingVertical: 9 },
    chipActive: { backgroundColor: c.primary },
    chipText: { color: c.text, fontSize: 14, fontWeight: "600" },
    chipTextActive: { color: c.onPrimary },
    block: { gap: 10 },
    timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
    switchTitle: { color: c.text, fontSize: 16, fontWeight: "600" },
    error: { color: c.danger, fontSize: 14, fontWeight: "600" },
  }),
);

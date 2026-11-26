import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DurationField } from "@/components/ui/DurationField";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { TextField } from "@/components/ui/TextField";
import { AppSpace, appTitle } from "@/constants/theme";
import { BENCHMARK_FIELDS, displayValue, formatDuration, parseDuration, parseField, type BenchmarkField, type BenchmarkValues } from "@/lib/benchmarks";
import { useBenchmarks } from "@/lib/benchmarks/store";
import { makeStyles, useAppTheme } from "@/lib/theme";

const GROUPS: { key: BenchmarkField["group"]; title: string; note: string }[] = [
  { key: "strength", title: "Strength", note: "Your heaviest weight for 5 clean reps, in kg. Not a one-rep max." },
  { key: "bodyweight", title: "Bodyweight", note: "Most reps in one go, and your longest plank." },
  { key: "running", title: "Running", note: "Your best times. Tap one and spin the wheel to set it." },
];

// Optional personal benchmarks. The workout generator uses the four lifts to suggest starting weights; with none entered it gives effort targets instead.
// Stored on this phone only.
export default function BenchmarksScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { loading, values, save } = useBenchmarks();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Benchmarks</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <BenchmarksForm initial={values} onSave={save} onDone={() => router.back()} />
      )}
    </SafeAreaView>
  );
}

function BenchmarksForm({ initial, onSave, onDone }: { initial: BenchmarkValues; onSave: (v: BenchmarkValues) => Promise<void>; onDone: () => void }) {
  const styles = useStyles();
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(BENCHMARK_FIELDS.map((f) => [f.key, displayValue(f, initial[f.key])])));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const next: BenchmarkValues = {};
    const problems: string[] = [];
    for (const f of BENCHMARK_FIELDS) {
      const { value, error } = parseField(f, text[f.key] ?? "");
      if (error) problems.push(error);
      else if (value !== null) next[f.key] = value;
    }
    setErrors(problems);
    if (problems.length > 0) return;
    setSaving(true);
    await onSave(next);
    setSaving(false);
    onDone();
  }

  return (
    <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        All optional. Add your lifts and the workout generator suggests a starting weight for each exercise. Leave them blank and it gives you an effort
        target instead. Stays on this phone.
      </Text>
      <Text style={styles.safety}>Only enter a 5-rep best you have actually lifted with good form, with a spotter or safety bars where needed. Never test a max alone.</Text>

      {GROUPS.map((g) => (
        <Card key={g.key}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{g.title}</Text>
            <Text style={styles.muted}>{g.note}</Text>
            {BENCHMARK_FIELDS.filter((f) => f.group === g.key).map((f) =>
              f.kind === "time" ? (
                <DurationField
                  key={f.key}
                  label={`${f.label} (${f.hint})`}
                  valueSecs={parseDuration(text[f.key] ?? "")}
                  startSecs={f.startSecs ?? 60}
                  onChange={(secs) => setText((cur) => ({ ...cur, [f.key]: secs === null ? "" : formatDuration(secs) }))}
                />
              ) : (
              <TextField
                key={f.key}
                label={`${f.label} (${f.hint})`}
                value={text[f.key] ?? ""}
                onChangeText={(v) => setText((cur) => ({ ...cur, [f.key]: v }))}
                keyboardType="decimal-pad"
                placeholder="Not set"
                maxLength={8}
              />
              )
            )}
          </View>
        </Card>
      ))}

      {errors.length > 0 ? (
        <View style={{ gap: 4 }}>
          {errors.map((e) => (
            <Text key={e} style={styles.error}>
              {e}
            </Text>
          ))}
        </View>
      ) : null}

      <Button title="Save" onPress={() => void handleSave()} loading={saving} />
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
    scroll: { padding: AppSpace.gutter, gap: AppSpace.gap, paddingBottom: 56 },
    intro: { color: c.textSecondary, fontSize: 15, lineHeight: 21 },
    safety: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    cardBody: { padding: 16, gap: 12 },
    cardTitle: { color: c.text, fontSize: 17, fontWeight: "700" },
    error: { color: c.danger, fontSize: 14, fontWeight: "600" },
  }),
);

import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton, SectionTitle } from "@/components/app/primitives";
import { AppRadius, AppSpace } from "@/constants/theme";
import { useSaveWatchData } from "@/lib/queries/workouts";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Optional numbers from the member's watch after a session. Half of the
// calories count towards today's target if the session went beyond their
// plan (watches usually overestimate); heart rate goes to the review only.
export function WatchDataCard({ sessionId }: { sessionId: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const save = useSaveWatchData();
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");

  const toNumber = (s: string) => (s.trim() ? Number(s) : undefined);
  const nothing = !calories.trim() && !avgHr.trim() && !maxHr.trim();

  return (
    <View style={styles.section}>
      <SectionTitle title="From your watch (optional)" />
      <View style={styles.card}>
        <View style={styles.row}>
          <Field label="Calories" value={calories} onChange={setCalories} placeholder="e.g. 420" />
          <Field label="Avg HR" value={avgHr} onChange={setAvgHr} placeholder="e.g. 138" />
          <Field label="Max HR" value={maxHr} onChange={setMaxHr} placeholder="e.g. 172" />
        </View>
        <Text style={styles.help}>
          If this session went beyond your plan, half of these calories go on today&apos;s target. Watches tend to overestimate.
        </Text>
        {save.isError ? <Text style={[styles.help, { color: colors.danger }]}>{save.error?.message ?? "Couldn't save that."}</Text> : null}
        {save.isSuccess ? <Text style={[styles.help, { color: colors.success }]}>Saved.</Text> : null}
        <PillButton
          title={save.isPending ? "Saving…" : "Save watch data"}
          variant="secondary"
          onPress={() => {
            if (nothing || save.isPending) return;
            save.mutate({ sessionId, calories: toNumber(calories), avgHr: toNumber(avgHr), maxHr: toNumber(maxHr) });
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    section: { marginTop: AppSpace.section },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 16 },
    row: { flexDirection: "row", gap: AppSpace.gap },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 6 },
    input: { minHeight: 44, borderRadius: AppRadius.inner, backgroundColor: c.control, color: c.text, paddingHorizontal: 12, fontSize: 16 },
    help: { fontSize: 13, lineHeight: 18, color: c.textMuted, marginTop: 10 },
  })
);

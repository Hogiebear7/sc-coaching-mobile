import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { TimeWheelPicker } from "@/components/ui/TimeWheelPicker";
import { AppRadius, Spacing } from "@/constants/theme";
import { formatDuration } from "@/lib/benchmarks";
import { makeStyles } from "@/lib/theme";

// A time (a plank hold, a run) picked on the same wheel as the rest of the app. Looks like a text field; tapping it opens the wheel. `valueSecs` is null
// while nothing is set. The wheel carries seconds into minutes and minutes into hours.

export function DurationField({
  label,
  valueSecs,
  startSecs,
  maxHours = 3,
  onChange,
}: {
  label: string;
  valueSecs: number | null;
  /** Where the wheel starts the first time, so it opens near a sensible time rather than at zero. */
  startSecs: number;
  maxHours?: number;
  onChange: (next: number | null) => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState(startSecs);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => {
          setSecs(valueSecs ?? startSecs);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={valueSecs === null ? `${label}. Not set. Tap to set.` : `${label} ${formatDuration(valueSecs)}. Tap to change.`}
        style={styles.field}
      >
        <Text style={valueSecs === null ? styles.placeholder : styles.value}>{valueSecs === null ? "Not set" : formatDuration(valueSecs)}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <BlurBackdrop />
          <View style={styles.card} onStartShouldSetResponder={() => true}>
            <Text style={styles.title}>{label}</Text>
            <TimeWheelPicker totalSecs={secs} onChange={setSecs} showHours maxHours={maxHours} />
            <Button
              title="Done"
              onPress={() => {
                onChange(secs);
                setOpen(false);
              }}
              style={{ marginTop: Spacing.lg }}
            />
            {valueSecs !== null ? (
              <Button
                title="Clear"
                variant="secondary"
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={{ marginTop: Spacing.sm }}
              />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    label: { fontSize: 14, fontWeight: "500", color: c.textSecondary, marginBottom: 6 },
    field: { height: 50, borderRadius: AppRadius.inner + 2, backgroundColor: c.control, paddingHorizontal: Spacing.lg, justifyContent: "center" },
    value: { fontSize: 16, color: c.text },
    placeholder: { fontSize: 16, color: c.textMuted },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
    card: { width: "100%", maxWidth: 420, backgroundColor: c.surface, borderRadius: 24, padding: Spacing.lg },
    title: { fontSize: 18, fontWeight: "700", color: c.text, textAlign: "center", marginBottom: Spacing.md },
  }),
);

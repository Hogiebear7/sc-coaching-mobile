import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { TimeWheelPicker } from "@/components/ui/TimeWheelPicker";
import { AppRadius, Spacing } from "@/constants/theme";
import { makeStyles } from "@/lib/theme";

// A time of day picked on the same wheel as the rest of the app. Shows a field that looks like a text field; tapping it opens the wheel.
// `value` and `onChange` use "HH:MM" (24-hour).

function toSecs(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 9 * 3600;
  return Math.min(23, Number(m[1])) * 3600 + Math.min(59, Number(m[2])) * 60;
}

function toText(secs: number): string {
  const h = Math.min(23, Math.floor(secs / 3600));
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState(toSecs(value));

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => {
          setSecs(toSecs(value));
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}. Tap to change.`}
        style={styles.field}
      >
        <Text style={styles.value}>{value}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <BlurBackdrop />
          <View style={styles.card} onStartShouldSetResponder={() => true}>
            <Text style={styles.title}>{label}</Text>
            <TimeWheelPicker clock totalSecs={secs} onChange={setSecs} />
            <Button
              title="Done"
              onPress={() => {
                onChange(toText(secs));
                setOpen(false);
              }}
              style={{ marginTop: Spacing.lg }}
            />
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
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
    card: { width: "100%", maxWidth: 420, backgroundColor: c.surface, borderRadius: 24, padding: Spacing.lg },
    title: { fontSize: 18, fontWeight: "700", color: c.text, textAlign: "center", marginBottom: Spacing.md },
  }),
);

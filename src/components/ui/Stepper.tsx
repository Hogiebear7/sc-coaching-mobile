import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

// Numeric +/- stepper for the recovery check-in's 1-10/1-5 scale fields —
// simplest reliable cross-platform control for a bounded numeric range
// without pulling in a native slider dependency.
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const current = value ?? min;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(Math.max(min, +(current - step).toFixed(1)))}
          style={styles.button}
          hitSlop={8}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{value ?? "—"}</Text>
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, +(current + step).toFixed(1)))}
          style={styles.button}
          hitSlop={8}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    height: 48,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 18, fontWeight: "700", color: Color.gold },
  valueWrap: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  value: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  suffix: { fontSize: 12, color: Color.textMuted },
});

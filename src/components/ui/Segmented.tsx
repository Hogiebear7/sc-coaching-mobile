import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { selectionFeedback } from "@/lib/haptics";
import { makeStyles } from "@/lib/theme";

// App v2 segmented control: a control-coloured pill track with the
// selected option as a primary-ink capsule (same look as RangePills).
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => {
              if (!active) selectionFeedback();
              onChange(opt);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {format(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      gap: 2,
      borderRadius: AppRadius.control,
      backgroundColor: c.control,
      padding: 3,
    },
    segment: { flex: 1, borderRadius: AppRadius.control, minHeight: 36, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
    segmentTextActive: { color: c.onPrimary },
  })
);

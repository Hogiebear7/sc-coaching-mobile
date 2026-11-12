import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, Spacing } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  /** A short line under the label. */
  hint?: string;
  /** A small coloured dot before the label (the drink colours, say). */
  color?: string;
}

// One pick from a longer list. A row of chips hides the options that run off the edge (the cardio row looked as if it ended at "Stair
// climber"), so for more than about four options this shows one button with the current choice. Tapping it opens the whole list from the bottom,
// with the screen behind dimmed and a tick on the current choice. Three or four options still read better as chips: use those instead.
export function OptionPicker<T extends string>({
  label,
  title,
  options,
  value,
  onChange,
  disabled,
  placeholder = "Choose",
}: {
  /** Small label above the button (optional). */
  label?: string;
  /** Heading of the list. */
  title: string;
  options: readonly PickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  function pick(next: T) {
    selectionFeedback();
    onChange(next);
    setOpen(false);
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => {
          tapFeedback();
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? title}: ${current?.label ?? placeholder}. Tap to change`}
        style={({ pressed }) => [styles.field, disabled && styles.disabled, pressed && styles.pressed]}
      >
        {current?.color ? <View style={[styles.dot, { backgroundColor: current.color }]} /> : null}
        <Text style={[styles.fieldText, !current && styles.placeholder]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Color.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close list" accessibilityRole="button">
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{title}</Text>
            <ScrollView style={styles.list} bounces={false} showsVerticalScrollIndicator={false}>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => pick(o.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
                  >
                    {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{o.label}</Text>
                      {o.hint ? <Text style={styles.rowHint}>{o.hint}</Text> : null}
                    </View>
                    {active ? <Ionicons name="checkmark" size={22} color={Color.textPrimary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    label: { fontSize: 13, color: Color.textMuted, marginBottom: 6 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    field: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: Color.surface2,
    },
    fieldText: { flex: 1, fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    placeholder: { color: Color.textFaint, fontWeight: "400" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: Color.surface1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      maxHeight: "75%",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Color.borderDefault, marginBottom: Spacing.md },
    title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
    list: { flexGrow: 0 },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
    },
    rowActive: { backgroundColor: Color.surface2 },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 16, color: Color.textSecondary },
    rowLabelActive: { color: Color.textPrimary, fontWeight: "700" },
    rowHint: { fontSize: 13, color: Color.textMuted },
  })
);

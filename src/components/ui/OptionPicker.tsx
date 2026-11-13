import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, Spacing } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

const ROW_H = 52;
const MAX_VISIBLE = 6.5;
const ARC_PAD = 8;
const ARC_DEPTH = 36;

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
  const [scrollY, setScrollY] = useState(0);
  const { height: screenH } = useWindowDimensions();
  // About six or seven rows show at once; a longer list scrolls inside the curve.
  const viewportHeight = Math.min(options.length, MAX_VISIBLE) * ROW_H + ARC_PAD * 2;
  const menuHeight = Math.min(viewportHeight + 56, screenH - 120);
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
          <Pressable style={[styles.menu, { height: menuHeight, marginTop: Math.max(insets.top, 16) }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.menuViewport}>
              <ScrollView
                style={{ height: viewportHeight }}
                contentContainerStyle={{ paddingVertical: ARC_PAD }}
                bounces={false}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
              >
                {options.map((o, i) => {
                  const active = o.value === value;
                  // Rows swing out along an arc: furthest to the left at the middle of the visible area, easing back to the right at the top and bottom.
                  const centre = scrollY + viewportHeight / 2 - ARC_PAD;
                  const rowMid = i * ROW_H + ROW_H / 2;
                  const t = Math.max(-1, Math.min(1, (rowMid - centre) / (viewportHeight / 2)));
                  const shift = ARC_DEPTH * (1 - Math.cos((t * Math.PI) / 2));
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => pick(o.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.row,
                        { transform: [{ translateX: shift }], opacity: 1 - Math.abs(t) * 0.3 },
                        active && styles.rowActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
                      <View style={styles.rowText}>
                        <Text style={[styles.rowLabel, active && styles.rowLabelActive]} numberOfLines={1}>{o.label}</Text>
                        {o.hint ? <Text style={styles.rowHint} numberOfLines={1}>{o.hint}</Text> : null}
                      </View>
                      {active ? <Ionicons name="checkmark" size={22} color="#0A1526" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
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
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", alignItems: "flex-end", justifyContent: "center" },
    menu: { width: "78%", justifyContent: "center", paddingLeft: Spacing.md, overflow: "hidden" },
    menuViewport: { flexShrink: 1 },
    title: { fontSize: 14, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#FFFFFF", marginBottom: Spacing.sm, paddingLeft: Spacing.md },
    list: { flexGrow: 0 },
    row: {
      height: ROW_H,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderTopLeftRadius: 26,
      borderBottomLeftRadius: 26,
      backgroundColor: "#2A3B5C",
      marginBottom: 0,
    },
    rowActive: { backgroundColor: "#F2F4F8" },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
    rowLabelActive: { color: "#0A1526", fontWeight: "800" },
    rowHint: { fontSize: 13, color: Color.textMuted },
  })
);

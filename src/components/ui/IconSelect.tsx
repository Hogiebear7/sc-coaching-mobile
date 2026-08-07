import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

export interface IconSelectOption<T extends string> {
  value: T;
  label: string;
  icon: string;
  sublabel?: string;
}

// RN touch port of the web app's IconSelect.tsx — a button that expands an
// inline options list (no absolutely-positioned popover on mobile; keyboard
// nav isn't applicable to a touch picker).
export function IconSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: IconSelectOption<T>[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.button}>
        <View style={styles.buttonContent}>
          <Text style={styles.icon}>{selected?.icon}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {selected?.label}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Color.textFaint} />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={[styles.option, opt.value === value && styles.optionActive]}
            >
              <Text style={styles.icon}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                {opt.sublabel ? <Text style={styles.optionSublabel}>{opt.sublabel}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flex: 1 },
  icon: { fontSize: 16 },
  label: { fontSize: 14, color: Color.textPrimary, flexShrink: 1 },
  list: {
    marginTop: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  optionActive: { backgroundColor: Color.goldWeak },
  optionLabel: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  optionSublabel: { fontSize: 11, color: Color.textMuted, marginTop: 1 },
});

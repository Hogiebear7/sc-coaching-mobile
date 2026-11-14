import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// One movement (or station) of a workout format, in the same card style as an exercise: a numbered badge, the name, a remove button, and the
// target fields underneath with a small label each. The five formats (circuit, EMOM, AMRAP, tabata, chipper) all set up their movements with this.

export function FormatMovementCard({
  index,
  name,
  onChangeName,
  namePlaceholder,
  onRemove,
  children,
}: {
  index: number;
  name: string;
  onChangeName: (v: string) => void;
  namePlaceholder: string;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder={namePlaceholder}
          placeholderTextColor={Color.textFaint}
          accessibilityLabel={`Movement ${index + 1} name`}
          style={styles.nameInput}
        />
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove movement ${index + 1}`} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={18} color={Color.danger} />
        </Pressable>
      </View>
      {children ? <View style={styles.fields}>{children}</View> : null}
    </View>
  );
}

export function FormatMiniField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "number-pad",
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  onBlur?: () => void;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={Color.textFaint}
        accessibilityLabel={label}
        style={styles.fieldInput}
      />
    </View>
  );
}

/** A small tappable chip that flips between two choices (Reps / Time). */
export function FormatChoiceChip({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. Tap to change.`} style={styles.choice}>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.sm, marginTop: Spacing.sm, gap: Spacing.xs },
    head: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 14, fontWeight: "800", color: Color.goldForeground },
    nameInput: { flex: 1, minHeight: 44, borderRadius: Radius.md, backgroundColor: Color.surface2, paddingHorizontal: 12, fontSize: 16, color: Color.textPrimary },
    removeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    fields: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-end" },
    field: { flex: 1, gap: 2 },
    fieldLabel: { fontSize: 12, color: Color.textMuted },
    fieldInput: { minHeight: 44, borderRadius: Radius.md, backgroundColor: Color.surface2, paddingHorizontal: 10, textAlign: "center", fontSize: 16, color: Color.textPrimary },
    choice: { minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    choiceText: { fontSize: 14, fontWeight: "700", color: Color.gold },
  })
);

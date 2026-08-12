import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

export function TextField({
  label,
  error,
  style,
  secureToggle,
  ...inputProps
}: TextInputProps & { label: string; error?: string | null; secureToggle?: boolean }) {
  const [revealed, setRevealed] = useState(false);

  if (secureToggle) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputRow, error ? styles.inputError : null]}>
          <TextInput
            placeholderTextColor={Color.textFaint}
            secureTextEntry={!revealed}
            style={[styles.inputInner, style]}
            {...inputProps}
          />
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={19} color={Color.textFaint} />
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Color.textFaint}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: Color.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Color.textPrimary,
  },
  inputError: {
    borderColor: Color.danger,
  },
  error: {
    fontSize: 12,
    color: Color.danger,
    marginTop: 4,
  },
  inputRow: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    flexDirection: "row",
    alignItems: "center",
  },
  inputInner: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Color.textPrimary,
  },
  eyeButton: {
    height: "100%",
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

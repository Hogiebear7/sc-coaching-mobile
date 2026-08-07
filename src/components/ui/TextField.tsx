import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

export function TextField({
  label,
  error,
  style,
  ...inputProps
}: TextInputProps & { label: string; error?: string | null }) {
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
});

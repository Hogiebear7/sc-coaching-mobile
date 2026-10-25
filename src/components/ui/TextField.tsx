import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { AppRadius, Spacing } from "@/constants/theme";
import { makeStyles, useAppTheme } from "@/lib/theme";

// App v2 text field: visible label above a soft, borderless control-filled
// input. Focus and error are shown with a 1.5dp outline so the field never
// relies on colour fill alone.
export function TextField({
  label,
  error,
  style,
  secureToggle,
  onFocus,
  onBlur,
  ...inputProps
}: TextInputProps & { label: string; error?: string | null; secureToggle?: boolean }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const stateStyle = error ? styles.inputError : focused ? styles.inputFocused : null;
  const focusProps = {
    onFocus: (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setFocused(true);
      onFocus?.(e);
    },
    onBlur: (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setFocused(false);
      onBlur?.(e);
    },
  };

  if (secureToggle) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputRow, stateStyle]}>
          <TextInput
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!revealed}
            style={[styles.inputInner, style]}
            accessibilityLabel={label}
            {...focusProps}
            {...inputProps}
          />
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
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
        placeholderTextColor={colors.textMuted}
        style={[styles.input, stateStyle, style]}
        accessibilityLabel={label}
        {...focusProps}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: {
      marginBottom: Spacing.md,
    },
    label: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textSecondary,
      marginBottom: 6,
    },
    input: {
      height: 50,
      borderRadius: AppRadius.inner + 2,
      borderWidth: 1.5,
      borderColor: "transparent",
      backgroundColor: c.control,
      paddingHorizontal: Spacing.lg,
      fontSize: 16,
      color: c.text,
    },
    inputFocused: {
      borderColor: c.text,
    },
    inputError: {
      borderColor: c.danger,
    },
    error: {
      fontSize: 13,
      color: c.danger,
      marginTop: 4,
    },
    inputRow: {
      height: 50,
      borderRadius: AppRadius.inner + 2,
      borderWidth: 1.5,
      borderColor: "transparent",
      backgroundColor: c.control,
      flexDirection: "row",
      alignItems: "center",
    },
    inputInner: {
      flex: 1,
      height: "100%",
      paddingHorizontal: Spacing.lg,
      fontSize: 16,
      color: c.text,
    },
    eyeButton: {
      height: "100%",
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);

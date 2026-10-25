import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { AppRadius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme } from "@/lib/theme";

// App v2 button: a solid pill. Primary is the theme's primary ink (white on
// dark, navy on light); gold is no longer spent on actions — it is the
// brand mark only. `variant="secondary"` is the quieter control-coloured
// pill used for Back/Skip.
export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const primary = variant === "primary";
  const handlePress = () => {
    tapFeedback();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        style,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: primary ? colors.onPrimary : colors.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    base: {
      height: 48,
      borderRadius: AppRadius.control,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
    },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.control },
    text: {
      fontSize: 16,
      fontWeight: "600",
    },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  })
);

import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

// Ported from the web app's .btn-primary utility: gold gradient pill,
// dark-navy text, subtle border + glow. `variant="secondary"` matches the
// web's bordered/translucent secondary buttons used for Back/Skip actions.
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
  const isDisabled = disabled || loading;

  if (variant === "secondary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.secondary,
          style,
          isDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Color.textPrimary} size="small" />
        ) : (
          <Text style={styles.secondaryText}>{title}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={[styles.wrap, style]}>
      {({ pressed }) => (
        <LinearGradient
          colors={[Color.goldHover, Color.gold]}
          style={[styles.primary, isDisabled && styles.disabled, pressed && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator color={Color.goldForeground} size="small" />
          ) : (
            <Text style={styles.primaryText}>{title}</Text>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.pill,
  },
  primary: {
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  primaryText: {
    color: Color.goldForeground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  secondary: {
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  secondaryText: {
    color: Color.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});

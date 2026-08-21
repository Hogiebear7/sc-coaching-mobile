import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/Button";
import { Color, Spacing } from "@/constants/theme";

// Every empty state across the app used to be a single flat line of muted
// text — "Nothing booked", "No check-ins logged yet" — with no action to
// take and no sense of why it mattered. This is the one place that pattern
// gets fixed: an icon to anchor it, a title that names what's missing, a
// body line that says why it's worth doing something about, and (usually)
// one tappable way to actually do it. `variant="primary"` is reserved for
// the handful of empty states that ARE the screen's main action (Home's
// Next Session) — everything else defaults to the quieter secondary
// button so gold doesn't get spent on every empty list in the app.
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  variant = "secondary",
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={Color.textFaint} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant={variant} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Color.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: Color.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  action: {
    marginTop: Spacing.md,
  },
});

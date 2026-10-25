import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/Button";
import { Spacing } from "@/constants/theme";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Every empty state used to be a single flat line of muted text with no
// action to take and no sense of why it mattered. This is the one place
// that pattern gets fixed: an icon to anchor it, a title that names what's
// missing, a body line that says why it's worth doing something about, and
// (usually) one tappable way to actually do it. `variant="primary"` is
// reserved for the handful of empty states that ARE the screen's main
// action — everything else defaults to the quieter secondary pill.
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
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.wrap, style]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={colors.textSecondary} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant={variant} style={styles.action} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.control,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
      textAlign: "center",
      marginBottom: 4,
    },
    body: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 21,
      maxWidth: 300,
    },
    action: {
      marginTop: Spacing.lg,
    },
  })
);

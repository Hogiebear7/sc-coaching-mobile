import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeStyles } from "@/lib/theme";

// Every screen used to hand-roll this exact label + optional trailing-link
// row with its own locally-duplicated style block. One shared component
// means hierarchy/spacing changes land everywhere at once. `action` covers
// the common "See all"-style text link; `right` is an escape hatch for the
// rare non-text trailing element (a status chip).
//
// App v2: a sentence-case section title in the text colour, with the action
// as an underlined secondary link (gold is the brand mark only).
export function SectionHeader({
  label,
  action,
  right,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
  right?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label} accessibilityRole="header">
        {label}
      </Text>
      {action ? (
        <Pressable
          onPress={() => {
            tapFeedback();
            action.onPress();
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : (
        right ?? null
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
      marginTop: Spacing.xs,
    },
    label: {
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
    },
    action: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textSecondary,
      textDecorationLine: "underline",
    },
  })
);

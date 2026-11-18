import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SupersetRounds } from "@/components/workout/SupersetRounds";
import { Radius, Spacing } from "@/constants/theme";
import { makeLegacyStyles } from "@/lib/theme";

// THE workout card: one exercise, or one superset, in a coloured box with a header ("Exercise 1", "Superset A · 2 exercises"), the focused view (one round or set at
// a time, see SupersetRounds) and a button to switch to the full details. The logging screen, the template editor and the read-only views (history, someone
// else's workout in Community) all draw their exercises with this, so a workout looks the same wherever it is shown. `mode` says whether it is live ("log"), being
// planned ("template") or only being looked at ("view"); the parts that change things are switched off outside "log" and "template".
export type WorkoutBlockProps = {
  /** The box and header colour (a superset's colour, or the plain blue-grey for a single exercise). */
  colour: string;
  /** "Exercise 1" or "Superset A · 2 exercises". */
  headerText: string;
  /** True while the full details are showing instead of the focused view. */
  editing: boolean;
  /** Hide the switch (for example while an exercise has no name yet and must stay in the full card). */
  showToggle: boolean;
  /** What the switch says right now: "Focused view" while editing, otherwise "Edit" / "Edit exercises" / "Details". */
  toggleLabel: string;
  toggleHint: string;
  onToggle: () => void;
  /** A superset can be ungrouped; absent for a single exercise and in views. */
  onUngroup?: () => void;
  /** Extra props for the tour highlights on the first card of the logging screen. */
  headerTarget?: object;
  toggleTarget?: object;
  /** The full details, shown while `editing`. */
  fullCards: ReactNode;
  /** The focused view's props. */
  rounds: ComponentProps<typeof SupersetRounds>;
  boxTarget?: object;
};

export function WorkoutBlock({ colour, headerText, editing, showToggle, toggleLabel, toggleHint, onToggle, onUngroup, toggleTarget, boxTarget, fullCards, rounds }: WorkoutBlockProps) {
  const styles = useStyles();
  return (
    <View style={[styles.wrap, { borderColor: colour }]} {...(boxTarget ?? {})}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colour }]}>{headerText}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
          {showToggle ? (
            <Pressable
              onPress={onToggle}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={toggleHint}
              {...(toggleTarget ?? {})}
            >
              <Text style={styles.link}>{toggleLabel}</Text>
            </Pressable>
          ) : null}
          {onUngroup ? (
            <Pressable onPress={onUngroup} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ungroup this superset">
              <Text style={styles.link}>Ungroup</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {editing ? fullCards : <SupersetRounds {...rounds} />}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: {
      borderRadius: Radius.md,
      borderWidth: 2,
      backgroundColor: Color.goldWeak,
      marginBottom: Spacing.md,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Color.goldBorder,
    },
    headerText: { fontSize: 14, fontWeight: "700", color: Color.gold, letterSpacing: 0.4 },
    link: { fontSize: 13, fontWeight: "600", color: Color.textMuted, textDecorationLine: "underline" },
  })
);

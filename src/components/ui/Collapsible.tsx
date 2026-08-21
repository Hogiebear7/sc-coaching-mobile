import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

import { Color, Spacing } from "@/constants/theme";

// Generalizes the collapsed-by-default / expand-to-review pattern already
// proven in workout-generator.tsx's SelectedMusclesSection, for use
// anywhere advanced options should stay out of the way until asked for
// (workout logging's per-exercise "More options", Nutrition's tool list).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Collapsible({
  title,
  summary,
  defaultExpanded = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        hitSlop={8}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {summary && !expanded ? (
            <Text style={styles.summary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={Color.textMuted}
        />
      </Pressable>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  headerText: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: Color.textSecondary,
  },
  summary: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: 2,
  },
  content: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
});

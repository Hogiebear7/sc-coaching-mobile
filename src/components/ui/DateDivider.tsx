import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { makeLegacyStyles } from "@/lib/theme";

/** A centred day label between chat messages ("Today", "Yesterday", "Friday", "17 November 2026"). */
export function DateDivider({ label }: { label: string }) {
  const styles = useStyles();
  if (!label) return null;
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: { alignSelf: "center", backgroundColor: Color.surface2, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4, marginVertical: Spacing.xs },
    text: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  }),
);

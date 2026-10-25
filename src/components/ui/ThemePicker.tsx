import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppRadius, DarkPalette, DataColor, DataColorLight, LightPalette, type AppPalette, type DataPalette } from "@/constants/theme";
import { selectionFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Three preview cards — a miniature of the app in each theme — rather than a
// text list, so the choice is visible before it is made. "System" shows the
// light and dark halves together. Rendered in Settings only once
// LIGHT_MODE_AVAILABLE is on.
export function ThemePicker() {
  const styles = useStyles();
  const { preference, setPreference } = useAppTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const selected = preference === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!selected) selectionFeedback();
              setPreference(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${o.label} theme`}
            style={styles.option}
          >
            <View style={[styles.preview, selected && styles.previewSelected]}>
              {o.value === "system" ? (
                <>
                  <Mini palette={LightPalette} data={DataColorLight} />
                  <Mini palette={DarkPalette} data={DataColor} />
                </>
              ) : (
                <Mini palette={o.value === "light" ? LightPalette : DarkPalette} data={o.value === "light" ? DataColorLight : DataColor} />
              )}
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A tiny screen: title text, a row of data-colour dots, and two cards.
function Mini({ palette, data }: { palette: AppPalette; data: DataPalette }) {
  return (
    <View style={[miniStyles.half, { backgroundColor: palette.bg }]}>
      <Text style={[miniStyles.aa, { color: palette.text }]}>Aa</Text>
      <View style={miniStyles.dots}>
        {[data.readinessHigh, data.load, data.sessions, data.weight].map((c) => (
          <View key={c} style={[miniStyles.dot, { backgroundColor: c }]} />
        ))}
      </View>
      <View style={miniStyles.cards}>
        <View style={[miniStyles.card, { backgroundColor: palette.surface }]} />
        <View style={[miniStyles.card, { backgroundColor: palette.surface }]} />
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  half: { flex: 1, padding: 8, gap: 5 },
  aa: { fontSize: 15, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  cards: { flexDirection: "row", gap: 4 },
  card: { flex: 1, height: 12, borderRadius: 3 },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 10 },
    option: { flex: 1, alignItems: "center", gap: 8 },
    preview: {
      width: "100%",
      height: 96,
      borderRadius: AppRadius.inner + 2,
      borderWidth: 2,
      borderColor: c.hairline,
      overflow: "hidden",
    },
    previewSelected: { borderColor: c.text },
    label: { fontSize: 14, color: c.textSecondary, fontWeight: "500" },
    labelSelected: { color: c.text, fontWeight: "600" },
  })
);

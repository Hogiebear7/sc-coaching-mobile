import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { anyMicrosKnown, topKnownMicros, type MicroTotalView } from "@/lib/micronutrients";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Vitamins and minerals on the Nutrition tab: the few nutrients that have data today, each with its amount, and a way into the full list. Only foods that list a nutrient count towards
// it, so a nutrient is marked "at least" when some of today's foods don't list it. A day with no data says why instead of showing zeros.
export function MicronutrientsCard({ date, totals }: { date: string; totals: MicroTotalView[] | null | undefined }) {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useAppTheme();
  if (!totals || totals.length === 0) return null;

  const open = () => router.push({ pathname: "/nutrients", params: { date } } as never);
  const known = anyMicrosKnown(totals);

  if (!known) {
    return (
      <Card tier="quiet">
        <View style={styles.pad}>
          <Text style={styles.title}>Vitamins &amp; minerals</Text>
          <Text style={styles.muted}>Shown for foods that list them, mostly packaged foods you scan. Foods the AI estimates or you type in by hand don&apos;t include them.</Text>
        </View>
      </Card>
    );
  }

  const top = topKnownMicros(totals, 4);
  return (
    <Card>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Vitamins and minerals. See all" style={styles.pad}>
        <View style={styles.head}>
          <Text style={styles.title}>Vitamins &amp; minerals</Text>
          <View style={styles.seeAll}>
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.accentLink} />
          </View>
        </View>
        <View style={styles.row}>
          {top.map((m) => (
            <View key={m.key} style={styles.cell} accessible accessibilityLabel={`${m.label}, ${m.display}`}>
              <Text style={styles.label} numberOfLines={1}>{m.label}</Text>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {m.atLeast ? "≥ " : ""}
                {m.display.replace("at least ", "")}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.muted}>≥ means some foods you logged don&apos;t list this, so the real amount is higher.</Text>
      </Pressable>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pad: { padding: 16, gap: 12 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: c.text, fontSize: 17, fontWeight: "700" },
    seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: { color: c.accentLink, fontSize: 14, fontWeight: "600" },
    row: { flexDirection: "row", gap: 8 },
    cell: { flex: 1, gap: 3 },
    label: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    value: { color: c.text, fontSize: 15, fontWeight: "700" },
    muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
  }),
);

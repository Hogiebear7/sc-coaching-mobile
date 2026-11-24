import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { extraRows, noExtrasKnown, type ExtraTotals } from "@/lib/nutrient-extras";
import { makeStyles } from "@/lib/theme";

// The day's fibre, sugars, sodium and saturated fat under the macros. Only foods that list a nutrient count towards it, so when some entries do not, the value is
// marked "at least" instead of pretending they were zero. A day with only hand-typed foods says so rather than showing four zeros.
export function ExtrasCard({ totals }: { totals: ExtraTotals | null | undefined }) {
  const styles = useStyles();
  const rows = extraRows(totals);
  if (!rows || !totals) return null;

  if (noExtrasKnown(totals)) {
    return (
      <Card tier="quiet">
        <View style={styles.pad}>
          <Text style={styles.title}>More nutrients</Text>
          <Text style={styles.muted}>Fibre, sugars, sodium and saturated fat show here for foods that list them. Foods you type in by hand don&apos;t.</Text>
        </View>
      </Card>
    );
  }

  const anyPartial = rows.some((r) => r.atLeast);
  return (
    <Card>
      <View style={styles.pad}>
        <Text style={styles.title}>More nutrients</Text>
        <View style={styles.row}>
          {rows.map((r) => (
            <View key={r.key} style={styles.cell} accessible accessibilityLabel={`${r.label}, ${r.atLeast ? "at least " : ""}${r.value}`}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {r.atLeast ? "≥ " : ""}
                {r.value}
              </Text>
              {r.note ? <Text style={styles.note}>{r.note}</Text> : null}
            </View>
          ))}
        </View>
        {anyPartial ? <Text style={styles.muted}>≥ means some foods you logged don&apos;t list this, so the real amount is higher.</Text> : null}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pad: { padding: 16, gap: 12 },
    title: { color: c.text, fontSize: 17, fontWeight: "700" },
    row: { flexDirection: "row", gap: 8 },
    cell: { flex: 1, gap: 3 },
    label: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    value: { color: c.text, fontSize: 16, fontWeight: "700" },
    note: { color: c.textMuted, fontSize: 11, lineHeight: 15 },
    muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
  }),
);

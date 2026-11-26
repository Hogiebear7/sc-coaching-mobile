import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { useNutritionDiary } from "@/lib/queries/nutrition-diary";
import { anyMicrosKnown, contributors, formatAmount, groupMicros, type MicroTotalView } from "@/lib/micronutrients";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { todayDateString } from "@/lib/workout-formatters";

// Vitamins, minerals and omega-3 for one day: every tracked nutrient with the amount from the foods that list it, how many foods that is out of how many you logged (so a low
// number is never mistaken for "you ate none"), and, on tap, which foods contributed. Targets and reference ranges are not shown yet: they need a vetted source first.
export default function NutrientsScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayDateString();
  const { data, isLoading, isError } = useNutritionDiary(date);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = groupMicros(data?.micros);
  const entries = data?.entries ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vitamins &amp; minerals</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Couldn&apos;t load this day. Go back and try again.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Only foods that list a nutrient count towards it, so the amounts below are a minimum. Packaged foods you scan usually list them; foods the AI estimates or you type in don&apos;t.
          </Text>

          {!anyMicrosKnown(data.micros) ? (
            <Card tier="quiet">
              <View style={styles.pad}>
                <Text style={styles.cardTitle}>No vitamin or mineral data for this day</Text>
                <Text style={styles.muted}>Log a packaged food by scanning its barcode and any vitamins and minerals on its label will show here.</Text>
              </View>
            </Card>
          ) : null}

          {groups.map((g) => (
            <View key={g.group} style={styles.group}>
              <Text style={styles.groupTitle}>{g.label}</Text>
              <Card>
                {g.items.map((m, i) => (
                  <NutrientRow key={m.key} m={m} divider={i > 0} open={openKey === m.key} onToggle={() => setOpenKey(openKey === m.key ? null : m.key)} entries={entries} />
                ))}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NutrientRow({ m, divider, open, onToggle, entries }: { m: MicroTotalView; divider: boolean; open: boolean; onToggle: () => void; entries: { id: string; name: string; micros?: Partial<Record<string, number>> | null }[] }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const has = m.listedBy > 0;
  const who = open && has ? contributors(entries, m.key) : [];
  return (
    <View style={divider ? styles.divider : undefined}>
      <Pressable onPress={onToggle} disabled={!has} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${m.label}, ${m.display}. ${m.coverage}`} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{m.label}</Text>
          <Text style={styles.coverage}>{m.coverage}</Text>
        </View>
        <Text style={[styles.rowValue, !has && styles.noData]}>{has ? `${m.atLeast ? "≥ " : ""}${formatAmount(m.total, m.unit)}` : "No data"}</Text>
        {has ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} /> : <View style={{ width: 16 }} />}
      </Pressable>
      {open && has ? (
        <View style={styles.who}>
          <Text style={styles.whoTitle}>Foods that contributed</Text>
          {who.map((w) => (
            <View key={w.name} style={styles.whoRow}>
              <Text style={styles.whoName} numberOfLines={1}>{w.name}</Text>
              <Text style={styles.whoValue}>{formatAmount(w.value, m.unit)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: c.text, flexShrink: 1, textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
    intro: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    pad: { padding: 16, gap: 8 },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
    muted: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    group: { gap: 8 },
    groupTitle: { color: c.text, fontSize: 17, fontWeight: "700" },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    rowLabel: { color: c.text, fontSize: 15, fontWeight: "600" },
    coverage: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    rowValue: { color: c.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
    noData: { color: c.textMuted, fontWeight: "500" },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    who: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
    whoTitle: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    whoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    whoName: { color: c.text, fontSize: 14, flexShrink: 1 },
    whoValue: { color: c.textSecondary, fontSize: 14, fontVariant: ["tabular-nums"] },
  }),
);

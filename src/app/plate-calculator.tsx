import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import {
  BAR_PRESETS_KG,
  BAR_PRESETS_LB,
  calculatePlateLoad,
  KG_PLATES,
  LB_PLATES,
} from "@/lib/plate-calculator";

// Standard gym-floor plate color convention — genuinely helps at-a-glance
// recognition, not decorative. Falls back to a neutral grey for odd sizes.
const PLATE_COLORS: Record<number, string> = {
  25: "#e6484f",
  45: "#e6484f",
  20: "#3f8fe0",
  35: "#3f8fe0",
  15: "#e9c93f",
  10: "#5fbf6f",
  5: "#d8dce0",
  2.5: "#2b2f36",
  1.25: "#9aa2ad",
  0.5: "#9aa2ad",
};

function formatPlate(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export default function PlateCalculatorScreen() {
  const router = useRouter();
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [target, setTarget] = useState("100");
  const [barWeight, setBarWeight] = useState(String(BAR_PRESETS_KG[0].value));
  // Tracked separately from barWeight so two presets sharing the same
  // number (e.g. Safety Squat 20kg and Olympic 20kg) don't both light up —
  // only the preset actually tapped highlights. Cleared on manual entry.
  const [selectedBarLabel, setSelectedBarLabel] = useState<string | null>(BAR_PRESETS_KG[0].label);

  const barPresets = unit === "kg" ? BAR_PRESETS_KG : BAR_PRESETS_LB;
  const plates = unit === "kg" ? KG_PLATES : LB_PLATES;

  function switchUnit(next: "kg" | "lb") {
    if (next === unit) return;
    tapFeedback();
    setUnit(next);
    const firstPreset = (next === "kg" ? BAR_PRESETS_KG : BAR_PRESETS_LB)[0];
    setBarWeight(String(firstPreset.value));
    setSelectedBarLabel(firstPreset.label);
  }

  const result = useMemo(() => {
    const t = parseFloat(target);
    const b = parseFloat(barWeight);
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(b) || b < 0) return null;
    return calculatePlateLoad(t, b, plates);
  }, [target, barWeight, plates]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Plate Calculator</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.unitRow}>
          <Pressable onPress={() => switchUnit("kg")} style={[styles.unitChip, unit === "kg" && styles.unitChipActive]}>
            <Text style={[styles.unitChipText, unit === "kg" && styles.unitChipTextActive]}>kg</Text>
          </Pressable>
          <Pressable onPress={() => switchUnit("lb")} style={[styles.unitChip, unit === "lb" && styles.unitChipActive]}>
            <Text style={[styles.unitChipText, unit === "lb" && styles.unitChipTextActive]}>lb</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Target weight ({unit})</Text>
        <TextInput
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="e.g. 100"
          placeholderTextColor={Color.textFaint}
          style={styles.bigInput}
        />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Bar</Text>
        <View style={styles.barRow}>
          {barPresets.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => {
                tapFeedback();
                setBarWeight(String(p.value));
                setSelectedBarLabel(p.label);
              }}
              style={[styles.barChip, selectedBarLabel === p.label && styles.barChipActive]}
            >
              <Text style={[styles.barChipText, selectedBarLabel === p.label && styles.barChipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={barWeight}
          onChangeText={(v) => {
            setBarWeight(v);
            setSelectedBarLabel(null);
          }}
          keyboardType="decimal-pad"
          placeholder="Custom bar weight"
          placeholderTextColor={Color.textFaint}
          style={[styles.smallInput, { marginTop: Spacing.sm }]}
        />

        {result ? (
          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>PER SIDE</Text>
            {result.perSide.length === 0 ? (
              <Text style={styles.noPlatesText}>Just the bar — no plates needed.</Text>
            ) : (
              <>
                <View style={styles.stackWrap}>
                  {result.perSide.map((p) => (
                    <View key={p.plate} style={styles.stackRow}>
                      {Array.from({ length: p.count }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.plateBar,
                            {
                              backgroundColor: PLATE_COLORS[p.plate] ?? Color.surface3,
                              width: Math.min(140, 50 + (p.plate / (plates[0] || 1)) * 90),
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
                <View style={styles.plateListWrap}>
                  {result.perSide.map((p) => (
                    <View key={p.plate} style={styles.plateListRow}>
                      <View style={[styles.swatch, { backgroundColor: PLATE_COLORS[p.plate] ?? Color.surface3 }]} />
                      <Text style={styles.plateListText}>
                        {formatPlate(p.plate)} {unit} × {p.count}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {result.achievableTotal} {unit}
              </Text>
            </View>
            {result.shortfall !== 0 ? (
              <Text style={styles.shortfallText}>
                {result.shortfall > 0 ? `${result.shortfall} ${unit} short of target` : `${Math.abs(result.shortfall)} ${unit} over target`}
                {" — not exactly reachable with standard plates."}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Text style={styles.emptyText}>Enter a target weight to see the plate breakdown.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  unitRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.lg },
  unitChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface1 },
  unitChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  unitChipText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  unitChipTextActive: { color: Color.gold },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: Spacing.xs },
  bigInput: {
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 32,
    fontWeight: "700",
    color: Color.gold,
  },
  smallInput: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    color: Color.textPrimary,
  },
  barRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  barChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  barChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  barChipText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  barChipTextActive: { color: Color.gold },
  resultCard: { padding: Spacing.lg, marginTop: Spacing.xl },
  resultLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.md },
  noPlatesText: { fontSize: 13, color: Color.textMuted },
  stackWrap: { width: "100%", alignItems: "center", gap: 3, marginBottom: Spacing.md },
  stackRow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 3 },
  plateBar: { height: 16, borderRadius: 3 },
  plateListWrap: { gap: 6 },
  plateListRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  plateListText: { fontSize: 13, color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  totalDivider: { height: 1, backgroundColor: Color.borderSubtle, marginVertical: Spacing.md },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalLabel: { fontSize: 13, color: Color.textMuted },
  totalValue: { fontSize: 24, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
  shortfallText: { fontSize: 11, color: Color.warning, marginTop: Spacing.sm },
  emptyText: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.xl, textAlign: "center" },
});

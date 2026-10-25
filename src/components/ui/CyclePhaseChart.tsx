import { StyleSheet, Text, View } from "react-native";

import { LiveColor as Color, Radius, Spacing } from "@/constants/theme";
import { phaseSegments, type PhaseName } from "@/lib/queries/cycle";
import { makeLegacyStyles } from "@/lib/theme";

// Ported from the web app's components/member/CyclePhaseChart.tsx — same
// segmented timeline (each phase's width proportional to its day count,
// current phase full-opacity, the rest dimmed) plus a "Today" marker and a
// legend row. Fixed semantic colors per phase, same as web, so it reads
// consistently regardless of palette.
const phaseColor = (): Record<Exclude<PhaseName, "Unknown">, string> => ({
  Menstrual: Color.danger,
  Follicular: Color.accentData,
  Ovulatory: Color.brand,
  Luteal: Color.warning,
});

export function CyclePhaseChart({
  cycleDay,
  cycleLength,
  periodLengthDays,
  currentPhase,
}: {
  cycleDay: number;
  cycleLength: number;
  periodLengthDays: number | null;
  currentPhase: Exclude<PhaseName, "Unknown">;
}) {
  const styles = useStyles();
  const segments = phaseSegments(cycleLength, periodLengthDays);
  const markerPct = Math.min(100, Math.max(0, ((cycleDay - 0.5) / cycleLength) * 100));

  return (
    <View>
      <View style={styles.markerRow}>
        <View style={[styles.markerWrap, { left: `${markerPct}%` }]}>
          <Text style={styles.markerText}>Today</Text>
          <View style={styles.markerTriangle} />
        </View>
      </View>

      <View style={styles.bar}>
        {segments.map((seg) => (
          <View
            key={seg.phase}
            style={{
              flexGrow: seg.dayCount,
              flexBasis: 0,
              backgroundColor: phaseColor()[seg.phase],
              opacity: seg.phase === currentPhase ? 1 : 0.35,
              height: "100%",
            }}
          />
        ))}
      </View>

      <View style={styles.legendRow}>
        {segments.map((seg) => (
          <View key={seg.phase} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: phaseColor()[seg.phase], opacity: seg.phase === currentPhase ? 1 : 0.4 }]} />
            <Text style={[styles.legendText, seg.phase === currentPhase && styles.legendTextActive]}>{seg.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    markerRow: { position: "relative", height: 18 },
    markerWrap: { position: "absolute", top: 0, alignItems: "center", transform: [{ translateX: -12 }] },
    markerText: { fontSize: 12, fontWeight: "700", color: Color.textPrimary, textTransform: "uppercase", letterSpacing: 0.4 },
    markerTriangle: {
      marginTop: 2,
      width: 0,
      height: 0,
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderTopWidth: 5,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: Color.textPrimary,
    },
    bar: { flexDirection: "row", height: 12, borderRadius: Radius.pill, overflow: "hidden" },
    legendRow: { flexDirection: "row", flexWrap: "wrap", columnGap: Spacing.md, rowGap: 6, marginTop: Spacing.sm },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 14, color: Color.textMuted },
    legendTextActive: { fontWeight: "700", color: Color.textPrimary },
  })
);

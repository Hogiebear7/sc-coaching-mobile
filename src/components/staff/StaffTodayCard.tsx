import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useStaffToday, type StaffMonthFigure } from "@/lib/queries/staff";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The staff Today card (admin revamp slice S4): this month's figures against the same days last month, and the At-risk list (gym members with
// no class or logged session in 14 days), each one tap from their page. The same numbers as the website's staff Overview. Hidden for roles the
// server does not show it to (coaches) and while it loads, so it never holds up the class list below it.

const AT_RISK_SHOWN = 5;

function formatValue(f: StaffMonthFigure): string {
  if (f.value === null) return "—";
  return f.unit === "percent" ? `${Math.round(f.value * 100)}%` : f.value.toLocaleString("en-IE");
}

function trend(f: StaffMonthFigure): { text: string; good: boolean | null } | null {
  if (f.value === null || f.previous === null) return null;
  const diff = f.value - f.previous;
  if (diff === 0) return { text: "same as last month", good: null };
  const amount = f.unit === "percent" ? `${Math.abs(Math.round(diff * 100))} pts` : Math.abs(diff).toLocaleString("en-IE");
  const good = f.better === "none" ? null : (diff > 0) === (f.better === "up");
  return { text: `${diff > 0 ? "▲" : "▼"} ${amount} vs last month`, good };
}

export function StaffTodayCard() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data } = useStaffToday();
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;
  const atRisk = showAll ? data.atRisk : data.atRisk.slice(0, AT_RISK_SHOWN);

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.title}>{data.monthLabel} so far</Text>
        <View style={styles.grid}>
          {data.figures.map((f) => {
            const t = trend(f);
            return (
              <View key={f.label} style={styles.figure} accessible accessibilityLabel={`${f.label}: ${formatValue(f)}${t ? `, ${t.text}` : ""}`}>
                <Text style={styles.figureLabel} numberOfLines={2}>
                  {f.label}
                </Text>
                <Text style={styles.figureValue}>{formatValue(f)}</Text>
                {t ? (
                  <Text style={[styles.figureTrend, { color: t.good === null ? Color.textMuted : t.good ? Color.success : Color.danger }]}>{t.text}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>At risk</Text>
          <Text style={styles.count}>{data.atRisk.length}</Text>
        </View>
        <Text style={styles.sub}>Gym members with no class or logged session in 14 days.</Text>
        {data.atRisk.length === 0 ? (
          <Text style={styles.empty}>Nobody right now.</Text>
        ) : (
          atRisk.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => {
                tapFeedback();
                router.push({ pathname: "/staff-member", params: { userId: m.userId } });
              }}
              style={styles.member}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}, ${m.daysSince === null ? "no class or session yet" : `last seen ${m.daysSince} days ago`}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberMeta}>
                  {m.plan ? `${m.plan} · ` : ""}
                  {m.daysSince === null ? "No class or session yet" : `Last seen ${m.daysSince} days ago`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
            </Pressable>
          ))
        )}
        {data.atRisk.length > AT_RISK_SHOWN ? (
          <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.more}>{showAll ? "Show fewer" : `Show all ${data.atRisk.length}`}</Text>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md, marginBottom: Spacing.lg },
    card: { padding: Spacing.lg, gap: Spacing.sm },
    title: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    count: { fontSize: 16, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
    sub: { fontSize: 13, color: Color.textMuted },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    figure: { width: "48%", flexGrow: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Color.surface2, gap: 2 },
    figureLabel: { fontSize: 12, color: Color.textMuted },
    figureValue: { fontSize: 22, fontWeight: "700", color: Color.textPrimary, fontVariant: ["tabular-nums"] },
    figureTrend: { fontSize: 11, fontVariant: ["tabular-nums"] },
    empty: { fontSize: 14, color: Color.textSecondary, paddingVertical: Spacing.sm },
    member: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, minHeight: 44 },
    memberName: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    memberMeta: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
    more: { fontSize: 13, fontWeight: "600", color: Color.gold, paddingTop: Spacing.xs },
  })
);

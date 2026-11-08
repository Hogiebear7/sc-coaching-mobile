import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { figure, headline, Radius, Spacing } from "@/constants/theme";
import {
  formatDueDate,
  PREGNANCY_TOTAL_DAYS,
  pregnancyDay,
  sinceBirthLabel,
  toGoLabel,
  TRIMESTER_SEGMENTS,
  type PregnancyDay,
} from "@/lib/pregnancy-view";
import type { PregnancyData } from "@/lib/queries/pregnancy";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The pregnancy guide's look. Everything here is private information shown only where the member opens it (their profile and the
// Cycle tracking screen): nothing on Home, and the numbers come from the server's estimate (lib/pregnancy-view.ts does the day/week maths).

const TRIMESTER_NAMES = ["1st", "2nd", "3rd"] as const;

/** A 40-week bar split at the trimester boundaries, filled up to today. The segments fill one by one so the stage reads at a glance. */
export function PregnancyProgress({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const styles = useStyles();
  return (
    <View>
      <View style={styles.barRow} accessible accessibilityRole="progressbar" accessibilityLabel={`${Math.round(progress * 100)} percent of the pregnancy`}>
        {TRIMESTER_SEGMENTS.map((w, i) => {
          const start = TRIMESTER_SEGMENTS.slice(0, i).reduce((a, b) => a + b, 0);
          const fill = Math.min(1, Math.max(0, (progress - start) / w));
          return (
            <View key={i} style={[styles.barSegment, { flex: w }]}>
              <View style={[styles.barFill, { width: `${fill * 100}%` }]} />
            </View>
          );
        })}
      </View>
      {compact ? null : (
        <View style={styles.barLabels}>
          {TRIMESTER_SEGMENTS.map((w, i) => (
            <Text key={i} style={[styles.barLabel, { flex: w }]}>
              {TRIMESTER_NAMES[i]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function headlineFor(pregnancy: PregnancyData, today: string): { big: string; sub: string | null; day: PregnancyDay | null } {
  const e = pregnancy.estimate;
  if (e.trimester === "postpartum") {
    return { big: "After the birth", sub: sinceBirthLabel(pregnancy.birthDate ?? null, today), day: null };
  }
  const day = pregnancyDay(e.dueDate, today);
  if (day) return { big: `Week ${Math.min(40, day.weeks + 1)}`, sub: `Day ${day.day + 1} of ${PREGNANCY_TOTAL_DAYS} · ${toGoLabel(day)}`, day };
  if (e.weeksPregnant !== null) return { big: `Week ${e.weeksPregnant}`, sub: null, day: null };
  return { big: "Pregnant", sub: null, day: null };
}

/** The top card of the Cycle tracking screen while pregnant or after a birth. */
export function PregnancyHero({ pregnancy, today }: { pregnancy: PregnancyData; today: string }) {
  const styles = useStyles();
  const { big, sub, day } = headlineFor(pregnancy, today);
  const e = pregnancy.estimate;
  const due = formatDueDate(e.dueDate);
  return (
    <Card tier="hero" style={styles.hero}>
      <Text style={styles.eyebrow}>{(e.content?.label ?? "Pregnancy").toUpperCase()}</Text>
      <Text style={styles.heroFigure}>{big}</Text>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
      {day ? (
        <View style={{ marginTop: Spacing.md }}>
          <PregnancyProgress progress={day.progress} />
        </View>
      ) : null}
      {day && due ? <Text style={styles.heroDue}>Estimated due date {due}</Text> : null}
      {e.trimester === "postpartum" && pregnancy.breastfeeding === true ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>Breastfeeding</Text>
        </View>
      ) : null}
    </Card>
  );
}

function GuideBullets({ items }: { items: string[] }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** The tips for this stage, one tappable section each so the screen is not a wall of bullets. Eating and training open first. */
export function PregnancyGuide({ pregnancy }: { pregnancy: PregnancyData }) {
  const styles = useStyles();
  const content = pregnancy.estimate.content;
  if (!content) return null;
  const training = pregnancy.training;
  const sections: { key: string; title: string; icon: keyof typeof Ionicons.glyphMap; open: boolean; body: ReactNode }[] = [];
  if (content.nutritionDo.length > 0) sections.push({ key: "eat", title: "Eat and take", icon: "nutrition-outline", open: true, body: <GuideBullets items={content.nutritionDo} /> });
  if (content.nutritionAvoid.length > 0) sections.push({ key: "avoid", title: "Avoid", icon: "ban-outline", open: false, body: <GuideBullets items={content.nutritionAvoid} /> });
  if (training) {
    sections.push({
      key: "train",
      title: "Training",
      icon: "barbell-outline",
      open: true,
      body: (
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.sectionLead}>{training.headline}</Text>
          <Text style={styles.sectionText}>{training.effort}</Text>
          <GuideBullets items={training.points} />
        </View>
      ),
    });
  } else {
    if (content.trainingDo.length > 0) sections.push({ key: "train-do", title: "Training: generally fine", icon: "barbell-outline", open: true, body: <GuideBullets items={content.trainingDo} /> });
    if (content.trainingAvoid.length > 0) sections.push({ key: "train-avoid", title: "Training: avoid", icon: "alert-circle-outline", open: false, body: <GuideBullets items={content.trainingAvoid} /> });
  }
  if (content.recoveryDo.length > 0) sections.push({ key: "recover", title: "Rest and recovery", icon: "moon-outline", open: false, body: <GuideBullets items={content.recoveryDo} /> });

  return (
    <Card style={styles.guide}>
      <Text style={styles.guideTitle}>This stage</Text>
      <Text style={styles.sectionText}>{content.summary}</Text>
      {sections.map((s) => (
        <View key={s.key} style={styles.guideSection}>
          <Collapsible title={s.title} defaultExpanded={s.open}>
            {s.body}
          </Collapsible>
        </View>
      ))}
      <Text style={styles.disclaimer}>{pregnancy.estimate.disclaimer}</Text>
    </Card>
  );
}

/** The profile's summary of the same thing, in place of the cycle-phase chart. Opens the Cycle tracking screen. */
export function PregnancySummaryRow({ pregnancy, today, onPress }: { pregnancy: PregnancyData; today: string; onPress: () => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const { big, day } = headlineFor(pregnancy, today);
  const label = pregnancy.estimate.content?.label ?? "Pregnancy";
  return (
    <Pressable
      onPress={onPress}
      style={styles.summary}
      accessibilityRole="button"
      accessibilityLabel={`Pregnancy guide. ${big}, ${label}. Opens your guide.`}
    >
      <View style={styles.summaryTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryFigure}>{big}</Text>
          <Text style={styles.summaryLabel}>{label}{day ? ` · ${toGoLabel(day)}` : ""}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
      </View>
      {day ? (
        <View style={{ marginTop: Spacing.sm }}>
          <PregnancyProgress progress={day.progress} compact />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    barRow: { flexDirection: "row", gap: 4 },
    barSegment: { height: 8, borderRadius: 4, backgroundColor: Color.surface3, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: Color.brand },
    barLabels: { flexDirection: "row", gap: 4, marginTop: 6 },
    barLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, color: Color.textFaint, textAlign: "center" },

    hero: { padding: Spacing.lg },
    eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: Color.textMuted },
    heroFigure: { ...headline(44), color: Color.textPrimary, marginTop: 4 },
    heroSub: { fontSize: 14, color: Color.textSecondary, marginTop: 2 },
    heroDue: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.sm },
    chip: { alignSelf: "flex-start", marginTop: Spacing.md, borderRadius: Radius.pill, backgroundColor: Color.brandWeak, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    chipText: { fontSize: 13, fontWeight: "600", color: Color.brand },

    guide: { padding: Spacing.lg, marginTop: Spacing.md },
    guideTitle: { ...headline(22), color: Color.textPrimary, marginBottom: 4 },
    guideSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle, marginTop: Spacing.sm },
    sectionLead: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
    sectionText: { fontSize: 14, color: Color.textSecondary, lineHeight: 20 },
    bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Color.brand, marginTop: 8 },
    bulletText: { flex: 1, fontSize: 14, color: Color.textSecondary, lineHeight: 20 },
    disclaimer: { fontSize: 12, color: Color.textFaint, marginTop: Spacing.md, lineHeight: 17 },

    summary: { marginTop: Spacing.sm, borderRadius: Radius.md, backgroundColor: Color.surface1, padding: Spacing.md },
    summaryTop: { flexDirection: "row", alignItems: "center" },
    summaryFigure: { ...figure(30, "700"), color: Color.textPrimary },
    summaryLabel: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
  })
);

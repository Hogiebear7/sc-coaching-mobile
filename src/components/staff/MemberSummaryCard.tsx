import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import {
  checkInStats,
  classStats,
  memberStateLabel,
  memberStateTone,
  nutritionStats,
  trainingStats,
  upcomingClassesLine,
  weightStats,
  type Stat,
  type StateTone,
} from "@/lib/staff-summary-format";
import { useStaffMemberSummary, type HealthNote, type MemberState, type MemberSummary, type SummaryFlag } from "@/lib/queries/staff-community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The pill that says at a glance how a member is doing. Colour is never the only signal: the words say it too.
export function MemberStatePill({ state }: { state: MemberState }) {
  const styles = useStyles();
  const tone: StateTone = memberStateTone(state);
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]} accessibilityRole="text">
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{memberStateLabel(state)}</Text>
    </View>
  );
}

// Plain-English flags, most important first. A "caution" is shown in the danger colour and bold, a "note" in normal text.
export function MemberFlagList({ flags }: { flags: readonly SummaryFlag[] }) {
  const styles = useStyles();
  if (flags.length === 0) return null;
  return (
    <View style={styles.flags}>
      {flags.map((f) => (
        <View key={`${f.code}-${f.text}`} style={[styles.flag, f.severity === "caution" && styles.flagCaution]}>
          <Text style={[styles.flagText, f.severity === "caution" && styles.flagTextCaution]}>{f.text}</Text>
        </View>
      ))}
    </View>
  );
}

// The member's own "injured or sick?" note from their daily check-in, with its date. Shown to coaches only (the server enforces that).
export function HealthNoteCallout({ note }: { note: HealthNote }) {
  const styles = useStyles();
  return (
    <View style={[styles.flag, note.mentionsIllnessOrInjury && styles.flagCaution]}>
      <Text style={[styles.flagText, note.mentionsIllnessOrInjury && styles.flagTextCaution]}>
        Health note ({note.date}): {note.note}
      </Text>
    </View>
  );
}

function StatGrid({ stats }: { stats: Stat[] }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          <Text style={styles.statLabel}>{s.label}</Text>
          <Text style={styles.statValue}>{s.value}</Text>
          {s.hint ? <Text style={styles.statHint}>{s.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// The full picture of a member from what they log: training, check-ins, food and water, weight and classes. A blank means "not logged", not "fine".
export function MemberSummaryCard({ summary }: { summary: MemberSummary }) {
  const styles = useStyles();
  const upcoming = upcomingClassesLine(summary.classes.upcoming);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Member summary</Text>
          <Text style={styles.sub}>From what they log. Updated {summary.asOf}.</Text>
        </View>
        <MemberStatePill state={summary.state} />
      </View>

      <MemberFlagList flags={summary.flags} />

      <Section title="Training">
        <StatGrid stats={trainingStats(summary.training)} />
        {summary.training.recent.length > 0 ? (
          <View style={styles.recent}>
            {summary.training.recent.map((s) => (
              <Text key={`${s.date}-${s.title}`} style={styles.recentLine}>
                {s.date} · {s.title}
                {s.rpe !== null ? ` · RPE ${s.rpe}` : ""}
                {s.durationMins ? ` · ${s.durationMins} min` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </Section>

      <Section title="Check-ins">
        <StatGrid stats={checkInStats(summary.checkIns)} />
        {summary.checkIns.healthNote ? <HealthNoteCallout note={summary.checkIns.healthNote} /> : null}
      </Section>

      <Section title="Food and water (last 3 full days)">
        <StatGrid stats={nutritionStats(summary.nutrition)} />
      </Section>

      <Section title="Weight">
        <StatGrid stats={weightStats(summary.weight)} />
      </Section>

      <Section title="Classes">
        <StatGrid stats={classStats(summary.classes)} />
        {upcoming ? <Text style={styles.recentLine}>{upcoming}</Text> : null}
      </Section>
    </Card>
  );
}

// Loads and shows the summary for one member, with its own loading, error and "walled" states so a slow or refused request never blanks the profile.
export function MemberSummarySection({ userId }: { userId: string | undefined }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const summary = useStaffMemberSummary(userId);
  const data = summary.data;

  if (summary.isLoading) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={Color.gold} />
      </Card>
    );
  }
  if (summary.isError) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Member summary</Text>
        <Text style={styles.sub}>Couldn&apos;t load the summary. {summary.error.message}</Text>
        <Button title="Try again" variant="secondary" onPress={() => summary.refetch()} style={{ marginTop: Spacing.sm }} />
      </Card>
    );
  }
  if (!data) return null;
  if (data.walled) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Member summary</Text>
        <Text style={styles.sub}>{data.message}</Text>
      </Card>
    );
  }
  return <MemberSummaryCard summary={data} />;
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    card: { padding: Spacing.lg },
    head: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginBottom: Spacing.sm },
    title: { fontSize: 17, fontWeight: "700", color: Color.textPrimary },
    sub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
    pillText: { fontSize: 12, fontWeight: "700" },
    pill_good: { borderColor: Color.success, backgroundColor: Color.surface2 },
    pillText_good: { color: Color.success },
    pill_warn: { borderColor: Color.gold, backgroundColor: Color.surface2 },
    pillText_warn: { color: Color.gold },
    pill_bad: { borderColor: Color.danger, backgroundColor: Color.surface2 },
    pillText_bad: { color: Color.danger },
    pill_quiet: { borderColor: Color.borderSubtle, backgroundColor: Color.surface2 },
    pillText_quiet: { color: Color.textMuted },
    flags: { gap: Spacing.xs, marginBottom: Spacing.sm },
    flag: { borderRadius: 12, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface2, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, marginTop: Spacing.xs },
    flagCaution: { borderColor: Color.danger },
    flagText: { fontSize: 14, lineHeight: 20, color: Color.textPrimary },
    flagTextCaution: { color: Color.danger, fontWeight: "600" },
    section: { marginTop: Spacing.lg },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: Spacing.md },
    stat: { width: "50%", paddingRight: Spacing.sm },
    statLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: Color.textFaint, textTransform: "uppercase" },
    statValue: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, marginTop: 2 },
    statHint: { fontSize: 12, color: Color.textMuted, marginTop: 1 },
    recent: { marginTop: Spacing.sm, gap: 2 },
    recentLine: { fontSize: 12, color: Color.textMuted, lineHeight: 18, marginTop: 2 },
  })
);

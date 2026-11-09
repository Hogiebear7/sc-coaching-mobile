import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { HealthNoteCallout, MemberFlagList, MemberStatePill } from "@/components/staff/MemberSummaryCard";
import { Spacing } from "@/constants/theme";
import { useStaffMemberBrief } from "@/lib/queries/staff-community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// The compact "how is this member doing" brief a coach opens from a class roster, before taking the class: an overall state, the flags (illness or injury
// first), and a few plain lines. Fetched only when opened, so a roster of 12 doesn't make 12 requests. For a member without a gym Membership the server
// answers "walled" and this says so rather than showing anything.
export function ClassMemberBrief({ userId }: { userId: string }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [open, setOpen] = useState(false);
  const brief = useStaffMemberBrief(userId, open);
  const data = brief.data;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleText}>{open ? "Hide brief" : "How are they doing?"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel} accessibilityLabel="Member brief">
          {brief.isLoading ? <ActivityIndicator color={Color.gold} /> : null}
          {brief.isError ? <Text style={styles.error}>{brief.error.message || "Couldn't load the brief. Try again."}</Text> : null}
          {data?.walled ? <Text style={styles.muted}>{data.message}</Text> : null}
          {data && !data.walled ? (
            <View style={{ gap: Spacing.xs }}>
              <MemberStatePill state={data.state} />
              {data.healthNote ? <HealthNoteCallout note={data.healthNote} /> : null}
              <MemberFlagList flags={data.flags.filter((f) => f.code !== "health_note")} />
              {data.lines.map((line) => (
                <Text key={line} style={styles.line}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    wrap: { paddingLeft: 28, paddingBottom: Spacing.xs },
    toggle: { minHeight: 36, justifyContent: "center", alignSelf: "flex-start" },
    toggleText: { fontSize: 13, fontWeight: "600", color: Color.gold },
    panel: { marginTop: 2, borderRadius: 12, backgroundColor: Color.surface2, padding: Spacing.sm },
    error: { fontSize: 13, color: Color.danger },
    muted: { fontSize: 13, color: Color.textMuted },
    line: { fontSize: 13, color: Color.textSecondary, lineHeight: 19 },
  })
);

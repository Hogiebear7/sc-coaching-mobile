import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/app/primitives";
import { Card } from "@/components/ui/Card";
import { AppRadius } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { useGrantAppAccess, useRevokeAppAccess, useSetMemberAiPaused, useStaffMemberAiStatus } from "@/lib/queries/staff-access";
import { makeStyles, useAppTheme } from "@/lib/theme";

const eur = (n: number | null | undefined) => (n == null ? "—" : `€${n.toFixed(2)}`);
const ymd = /^\d{4}-\d{2}-\d{2}$/;

function planLine(plan: { source: string; currentPeriodEnd: string | null; trial: boolean } | null): string {
  if (!plan) return "Free (no App Subscription)";
  const until = plan.currentPeriodEnd ? ` until ${new Date(plan.currentPeriodEnd).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "";
  if (plan.source === "staff_grant") return `Complimentary${until || ", no end date"}`;
  const store = plan.source === "google_play" ? "Google Play" : plan.source === "app_store" ? "App Store" : "store";
  return `${plan.trial ? "Free trial" : "Paid"} through ${store}${until}`;
}

// Staff view of one member's App Subscription and AI use (members.view), with the controls for staff who manage access (admins: grant or
// withdraw complimentary access with an optional end date and a note, and pause AI). Never touches store billing.
export function StaffAccessCard({ userId }: { userId: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "admin_manager";
  const { data, error } = useStaffMemberAiStatus(userId);
  const grant = useGrantAppAccess(userId);
  const revoke = useRevokeAppAccess(userId);
  const pause = useSetMemberAiPaused(userId);
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (error) {
    // A coach without access to this member's data, or an older server: the card simply isn't shown.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
  }
  if (!data) return null;
  const a = data.allowance;
  const complimentary = a.plan?.source === "staff_grant";
  const busy = grant.isPending || revoke.isPending || pause.isPending;
  const run = async (fn: () => Promise<{ message: string }>) => {
    setMessage(null);
    try {
      setMessage((await fn()).message);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "That didn't work. Please try again.");
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>App Subscription</Text>
      <Text style={styles.value}>{planLine(a.plan)}</Text>

      <Text style={[styles.label, { marginTop: 14 }]}>AI this month</Text>
      <Text style={styles.value}>
        {eur(a.spentEur)}
        {a.budgetEur != null ? ` of ${eur(a.budgetEur)}` : ""} · today {eur(a.spentTodayEur)}
        {a.dailyCapEur != null ? ` of ${eur(a.dailyCapEur)}` : ""}
      </Text>
      <Text style={styles.hint}>{data.totalCalls} AI requests in this period. Members never see these figures.</Text>
      {a.paused ? <Text style={[styles.hint, { color: colors.danger }]}>AI is paused for this member.</Text> : null}

      {canManage ? (
        <View style={{ marginTop: 16 }}>
          {!complimentary && !a.plan ? (
            <>
              <Text style={styles.label}>Give the App Subscription free</Text>
              <TextInput
                value={endsOn}
                onChangeText={setEndsOn}
                placeholder="End date, YYYY-MM-DD (optional)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                accessibilityLabel="End date"
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note, e.g. Gym member (optional)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={200}
                accessibilityLabel="Note"
              />
              <PillButton
                title={busy ? "Saving…" : "Give free access"}
                onPress={() => {
                  if (busy) return;
                  if (endsOn.trim() && !ymd.test(endsOn.trim())) return setMessage("Write the end date as YYYY-MM-DD, or leave it empty.");
                  run(() => grant.mutateAsync({ endsOn: endsOn.trim() || null, note: note.trim() || null }));
                }}
                style={{ marginTop: 10 }}
              />
            </>
          ) : complimentary ? (
            <PillButton title={busy ? "Saving…" : "Withdraw free access"} variant="secondary" onPress={() => !busy && run(() => revoke.mutateAsync())} />
          ) : (
            <Text style={styles.hint}>This member pays through the store, so only they can change or cancel it there.</Text>
          )}
          <PillButton
            title={a.paused ? "Resume AI" : "Pause AI for this member"}
            variant="secondary"
            onPress={() => !busy && run(() => pause.mutateAsync(!a.paused))}
            style={{ marginTop: 10 }}
          />
        </View>
      ) : null}
      {message ? <Text style={styles.hint}>{message}</Text> : null}
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { marginBottom: 12 },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 4 },
    value: { fontSize: 16, color: c.text },
    hint: { fontSize: 13, lineHeight: 18, color: c.textMuted, marginTop: 6 },
    input: { minHeight: 44, borderRadius: AppRadius.inner, backgroundColor: c.control, color: c.text, paddingHorizontal: 12, fontSize: 16, marginTop: 8 },
  })
);

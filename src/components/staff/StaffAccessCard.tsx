import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/app/primitives";
import { Card } from "@/components/ui/Card";
import { AppRadius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  useEndGymMembership,
  useGrantAppAccess,
  useGrantGymMembership,
  useRevokeAppAccess,
  useSetMemberAiPaused,
  useStaffMemberAiStatus,
} from "@/lib/queries/staff-access";
import { makeStyles, useAppTheme } from "@/lib/theme";

const eur = (n: number | null | undefined) => (n == null ? "—" : `€${n.toFixed(2)}`);
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function planLine(plan: { source: string; currentPeriodEnd: string | null; trial: boolean } | null): string {
  if (!plan) return "Free (no App Subscription)";
  const until = plan.currentPeriodEnd ? ` until ${shortDate(plan.currentPeriodEnd)}` : "";
  if (plan.source === "staff_grant") return `Complimentary${until || ", no end date"}`;
  const store = plan.source === "google_play" ? "Google Play" : plan.source === "app_store" ? "App Store" : "store";
  return `${plan.trial ? "Free trial" : "Paid"} through ${store}${until}`;
}

// Staff view of one member's access (members.view): the gym Membership, the App Subscription and AI use. Staff who manage access (the server's
// canManage, members.grantTier) also get the controls the website's "Membership & access" panel has: grant a gym Membership on a chosen package
// with an optional end date, or end it; give or withdraw complimentary app access with an optional end date and a note; pause AI. Store billing
// is never touched: a paid store subscription can only be changed by the member.
export function StaffAccessCard({ userId }: { userId: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { data, error } = useStaffMemberAiStatus(userId);
  const grant = useGrantAppAccess(userId);
  const revoke = useRevokeAppAccess(userId);
  const pause = useSetMemberAiPaused(userId);
  const grantGym = useGrantGymMembership(userId);
  const endGym = useEndGymMembership(userId);
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [gymPackageId, setGymPackageId] = useState<string | null>(null);
  const [gymEndsOn, setGymEndsOn] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (error) {
    // A coach without access to this member's data, or an older server: the card simply isn't shown.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
  }
  if (!data) return null;
  const a = data.allowance;
  // The server decides (members.grantTier). An older server doesn't say, so fall back to the roles that had it then.
  const canManage = data.canManage ?? (user?.role === "admin" || user?.role === "admin_manager");
  const gym = data.gymMembership ?? null;
  const packages = data.gymPackages ?? [];
  const chosenPackage = gymPackageId ?? packages[0]?.id ?? null;
  const complimentary = a.plan?.source === "staff_grant";
  const busy = grant.isPending || revoke.isPending || pause.isPending || grantGym.isPending || endGym.isPending;
  const run = async (fn: () => Promise<{ message: string }>) => {
    setMessage(null);
    try {
      setMessage((await fn()).message);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "That didn't work. Please try again.");
    }
  };
  const aiLine =
    a.budgetEur == null || a.budgetEur === 0
      ? `${eur(a.spentEur)} used${a.kind === "free" ? " (Free has no AI allowance)" : ""}`
      : `${eur(a.spentEur)} of ${eur(a.budgetEur)} · today ${eur(a.spentTodayEur)}${a.dailyCapEur != null ? ` of ${eur(a.dailyCapEur)}` : ""}`;

  return (
    <Card style={styles.card}>
      {canManage && gym ? (
        <View style={styles.section}>
          <Text style={styles.label}>Gym membership</Text>
          {gym.active ? (
            <>
              <Text style={styles.value}>
                {gym.planName ?? "Active"}
                {gym.currentPeriodEnd ? ` · until ${shortDate(gym.currentPeriodEnd)}` : ""}
              </Text>
              <PillButton
                title={endGym.isPending ? "Saving…" : "End gym Membership"}
                variant="secondary"
                onPress={() => !busy && run(() => endGym.mutateAsync())}
                style={{ marginTop: 10 }}
              />
            </>
          ) : packages.length === 0 ? (
            <Text style={styles.hint}>None. No gym packages exist yet: add one in Memberships & Pricing on the website.</Text>
          ) : (
            <>
              <Text style={styles.value}>None</Text>
              <Text style={[styles.hint, { marginTop: 8 }]}>Package</Text>
              {packages.map((p) => {
                const selected = p.id === chosenPackage;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setGymPackageId(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.option, selected && { borderColor: colors.brand }]}
                  >
                    <Text style={styles.optionTitle}>{p.name}</Text>
                    <Text style={styles.optionHint}>{p.allowance}</Text>
                  </Pressable>
                );
              })}
              <TextInput
                value={gymEndsOn}
                onChangeText={setGymEndsOn}
                placeholder="End date, YYYY-MM-DD (optional)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                accessibilityLabel="Gym Membership end date"
              />
              <PillButton
                title={grantGym.isPending ? "Saving…" : "Grant gym Membership"}
                onPress={() => {
                  if (busy || !chosenPackage) return;
                  if (gymEndsOn.trim() && !ymd.test(gymEndsOn.trim())) return setMessage("Write the end date as YYYY-MM-DD, or leave it empty.");
                  run(async () => {
                    const r = await grantGym.mutateAsync({ packageId: chosenPackage, endsOn: gymEndsOn.trim() || null });
                    setGymEndsOn("");
                    return r;
                  });
                }}
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </View>
      ) : null}

      <Text style={styles.label}>App Subscription</Text>
      <Text style={styles.value}>{planLine(a.plan)}</Text>

      <Text style={[styles.label, { marginTop: 14 }]}>AI this month</Text>
      <Text style={styles.value}>{aiLine}</Text>
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
                title={grant.isPending ? "Saving…" : "Give free access"}
                onPress={() => {
                  if (busy) return;
                  if (endsOn.trim() && !ymd.test(endsOn.trim())) return setMessage("Write the end date as YYYY-MM-DD, or leave it empty.");
                  run(() => grant.mutateAsync({ endsOn: endsOn.trim() || null, note: note.trim() || null }));
                }}
                style={{ marginTop: 10 }}
              />
            </>
          ) : complimentary ? (
            <PillButton title={revoke.isPending ? "Saving…" : "Withdraw free access"} variant="secondary" onPress={() => !busy && run(() => revoke.mutateAsync())} />
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
    card: { padding: Spacing.md, marginBottom: Spacing.md },
    section: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.control },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 4 },
    value: { fontSize: 16, color: c.text },
    hint: { fontSize: 13, lineHeight: 18, color: c.textMuted, marginTop: 6 },
    input: { minHeight: 44, borderRadius: AppRadius.inner, backgroundColor: c.control, color: c.text, paddingHorizontal: 12, fontSize: 16, marginTop: 8 },
    option: { minHeight: 44, borderRadius: AppRadius.inner, backgroundColor: c.control, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, justifyContent: "center" },
    optionTitle: { fontSize: 15, color: c.text },
    optionHint: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  })
);

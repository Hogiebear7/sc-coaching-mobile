import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { API_BASE_URL } from "@/constants/config";
import { Color, FontSize, Radius, Spacing } from "@/constants/theme";
import { useBillingController, useBillingSnapshot } from "@/lib/billing/billing-context";
import { AI_ALLOWANCE_NOTE, autoRenewDisclosure, describePlanEnd, DIGITAL_PLAN_FEATURES, manageSubscriptionLabel, RESTORE_LABEL, SEPARATE_FROM_MEMBERSHIP, trialHeadline } from "@/lib/billing/copy";
import type { StorePlan } from "@/lib/billing/types";
import { OUT_OF_DATE_SERVER_MESSAGE } from "@/lib/profile-access";
import { useProfile } from "@/lib/queries/profile";
import { CAN_SELL_DIGITAL_PLAN } from "@/lib/upsell-config";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// The App Subscription paywall. Everything it shows about money is the STORE's own string (price, period, renewal terms); the server only supplies product
// identifiers, and the server alone decides whether access is granted. Required next to a subscription price by Apple 3.1.2 and Google Play: what it is, its
// price and period, that it auto-renews, how to cancel, Terms of Use, Privacy Policy, and Restore purchases.
export default function SubscribeScreen() {
  const router = useRouter();
  const controller = useBillingController();
  const snapshot = useBillingSnapshot(controller);
  const { data: profile } = useProfile();
  const serverTooOld = !!profile && !profile.accessSupported;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!controller || serverTooOld) return;
    void controller.load();
    return () => controller.leave();
  }, [controller, serverTooOld]);

  // The member's own pick, or the first (shortest) plan until they pick one. Derived, not copied into state.
  const selectedId = selected ?? snapshot.plans[0]?.billingOptionId ?? null;
  const selectedPlan: StorePlan | undefined = snapshot.plans.find((p) => p.billingOptionId === selectedId);
  const platform = controller?.platform ?? "ios";
  const busy = snapshot.phase === "purchasing" || snapshot.phase === "verifying";
  const digitalPlan = profile?.digitalPlan ?? null;
  const hasDigital = !!profile?.memberAccess.digital;
  const manageable = digitalPlan && digitalPlan.source !== "staff_grant";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>App Subscription</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {serverTooOld ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Subscriptions are switched off</Text>
            <Text style={styles.body}>{OUT_OF_DATE_SERVER_MESSAGE}</Text>
          </Card>
        ) : !CAN_SELL_DIGITAL_PLAN || !controller ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Not available in this version</Text>
            <Text style={styles.body}>The App Subscription can&apos;t be bought from this version of the app.</Text>
          </Card>
        ) : hasDigital ? (
          <Card style={styles.card} accent>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={22} color={Color.success} />
              <Text style={styles.cardTitle}>You have the App Subscription</Text>
            </View>
            {digitalPlan ? <Text style={styles.body}>{describePlanEnd(digitalPlan, formatDate)}</Text> : <Text style={styles.body}>Included at no charge.</Text>}
            {manageable ? (
              <Button title={manageSubscriptionLabel(platform)} variant="secondary" onPress={() => void controller.manage()} style={styles.gap} />
            ) : null}
            <Text style={styles.small}>{SEPARATE_FROM_MEMBERSHIP}</Text>
          </Card>
        ) : snapshot.phase === "success" ? (
          <Card style={styles.card} accent>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={22} color={Color.success} />
              <Text style={styles.cardTitle}>You&apos;re subscribed</Text>
            </View>
            <Text style={styles.body}>Thank you. The AI coach, programme generation, food search and the rest are now unlocked on your account.</Text>
            <Button title="Done" onPress={() => router.back()} style={styles.gap} />
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Everything digital, in one subscription</Text>
              {DIGITAL_PLAN_FEATURES.map((line) => (
                <View key={line} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={Color.gold} />
                  <Text style={styles.body}>{line}</Text>
                </View>
              ))}
              <Text style={styles.small}>{AI_ALLOWANCE_NOTE}</Text>
            </Card>

            {snapshot.phase === "idle" || snapshot.phase === "loading" ? (
              <View style={styles.centerFill}>
                <ActivityIndicator color={Color.gold} />
              </View>
            ) : snapshot.phase === "unavailable" ? (
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>Subscriptions aren&apos;t available right now</Text>
                <Text style={styles.body}>{snapshot.message}</Text>
                {snapshot.retryable ? <Button title="Try again" variant="secondary" onPress={() => void controller.load()} style={styles.gap} /> : null}
              </Card>
            ) : (
              <>
                <View style={styles.plans}>
                  {snapshot.plans.map((plan) => {
                    const active = plan.billingOptionId === selectedId;
                    return (
                      <Pressable
                        key={plan.billingOptionId}
                        onPress={() => setSelected(plan.billingOptionId)}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[styles.planRow, active && styles.planRowActive]}
                      >
                        <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? Color.gold : Color.textFaint} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planTitle}>{plan.title}</Text>
                          {plan.trial ? (
                            <Text style={styles.planTrial}>{trialHeadline(plan.trial.label, plan.displayPrice, plan.periodLabel)}</Text>
                          ) : (
                            <Text style={styles.planPeriod}>{plan.periodLabel}</Text>
                          )}
                        </View>
                        {plan.trial ? (
                          <View style={styles.trialChip}>
                            <Text style={styles.trialChipText}>{plan.trial.label} free</Text>
                          </View>
                        ) : (
                          <Text style={styles.planPrice}>{plan.displayPrice}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {snapshot.message ? (
                  <Text style={[styles.message, snapshot.phase === "failed" && styles.messageError]} accessibilityLiveRegion="polite">
                    {snapshot.message}
                  </Text>
                ) : null}

                {selectedPlan ? (
                  <Button
                    title={
                      selectedPlan.trial
                        ? `Start ${selectedPlan.trial.label} free trial`
                        : `Subscribe — ${selectedPlan.displayPrice} ${selectedPlan.periodLabel}`
                    }
                    onPress={() => void controller.buy(selectedPlan)}
                    loading={busy}
                    disabled={busy || snapshot.phase === "pending"}
                  />
                ) : null}

                {selectedPlan?.trial ? (
                  <Text style={styles.message}>{trialHeadline(selectedPlan.trial.label, selectedPlan.displayPrice, selectedPlan.periodLabel)}. Cancel any time before the trial ends and you won&apos;t be charged.</Text>
                ) : null}
                <Text style={styles.small}>{autoRenewDisclosure(platform, { trial: !!selectedPlan?.trial })}</Text>
              </>
            )}
          </>
        )}

        {CAN_SELL_DIGITAL_PLAN && controller && !serverTooOld ? (
          <View style={styles.footer}>
            <Button title={RESTORE_LABEL} variant="secondary" onPress={() => void controller.restore()} disabled={busy} />
            {snapshot.restoreMessage ? (
              <Text style={styles.message} accessibilityLiveRegion="polite">
                {snapshot.restoreMessage}
              </Text>
            ) : null}
            {!hasDigital ? <Text style={styles.small}>{SEPARATE_FROM_MEMBERSHIP}</Text> : null}
            <View style={styles.links}>
              <Pressable onPress={() => void Linking.openURL(`${API_BASE_URL}/terms`)} hitSlop={8} accessibilityRole="link">
                <Text style={styles.link}>Terms of Use</Text>
              </Pressable>
              <Text style={styles.small}>·</Text>
              <Pressable onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)} hitSlop={8} accessibilityRole="link">
                <Text style={styles.link}>Privacy Policy</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: "700", color: Color.textPrimary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  body: { fontSize: FontSize.base, color: Color.textSecondary, flexShrink: 1 },
  small: { fontSize: FontSize.xs, color: Color.textMuted, lineHeight: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  gap: { marginTop: Spacing.sm },
  centerFill: { alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  plans: { gap: Spacing.sm },
  planRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface1 },
  planRowActive: { borderColor: Color.goldBorder, backgroundColor: Color.goldWeak },
  planTitle: { fontSize: FontSize.base, fontWeight: "600", color: Color.textPrimary },
  planPeriod: { fontSize: FontSize.sm, color: Color.textMuted },
  planPrice: { fontSize: FontSize.md, fontWeight: "700", color: Color.textPrimary },
  planTrial: { fontSize: FontSize.sm, color: Color.gold },
  trialChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Color.goldWeak, borderWidth: 1, borderColor: Color.goldBorder },
  trialChipText: { fontSize: FontSize.xs, fontWeight: "700", color: Color.gold },
  message: { fontSize: FontSize.sm, color: Color.textSecondary },
  messageError: { color: Color.warning },
  footer: { gap: Spacing.sm, marginTop: Spacing.md },
  links: { flexDirection: "row", gap: Spacing.sm, justifyContent: "center", marginTop: Spacing.xs },
  link: { fontSize: FontSize.sm, color: Color.gold, textDecorationLine: "underline" },
});

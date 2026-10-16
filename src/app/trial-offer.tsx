import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, FontSize, Spacing } from "@/constants/theme";
import { useBillingController, useBillingSnapshot } from "@/lib/billing/billing-context";
import { autoRenewDisclosure } from "@/lib/billing/copy";
import { trialOfferView } from "@/lib/billing/trial-offer";
import { useProfile } from "@/lib/queries/profile";
import { DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";

// Shown ONCE, right after a new account is created, only when the STORE says this member is eligible for a free trial. It never buys anything and never
// blocks anything: "Not now" returns to the app in the Free tier, and the same offer stays available in Settings > App Subscription for as long as the store
// says the member is eligible. There is no deadline, countdown or repeat. The trial starts only when the member confirms in the store's own sheet on the
// subscription screen and the server accepts the store's confirmation. If the store has not said the member is eligible, this screen shows nothing and leaves.
export default function TrialOfferScreen() {
  const router = useRouter();
  const controller = useBillingController();
  const snapshot = useBillingSnapshot(controller);
  const { data: profile } = useProfile();
  const view = trialOfferView(snapshot);
  const left = useRef(false);

  useEffect(() => {
    if (!controller) return;
    void controller.load();
    return () => controller.leave();
  }, [controller]);

  // No trial to promise (no billing, unknown eligibility, already used, or already subscribed): leave quietly.
  const nothingToOffer = !controller || view.kind === "skip" || !!profile?.memberAccess.digital;
  useEffect(() => {
    if (nothingToOffer && !left.current) {
      left.current = true;
      router.back();
    }
  }, [nothingToOffer, router]);

  const platform = controller?.platform ?? "ios";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {view.kind === "offer" && !nothingToOffer ? (
          <Card style={styles.card} accent>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles-outline" size={24} color={Color.gold} />
            </View>
            <Text style={styles.title}>{view.headline}</Text>
            <Text style={styles.body}>AI coach and nutrition coach, programme generation, food photo scans and more. Your Free tier stays as it is either way.</Text>
            {view.plans.map((plan) => (
              <View key={plan.billingOptionId} style={styles.planLine}>
                <Ionicons name="checkmark" size={16} color={Color.gold} />
                <Text style={styles.body}>
                  {plan.title}: {plan.line}
                </Text>
              </View>
            ))}
            <Button title="See plans and start free trial" onPress={() => router.replace(DIGITAL_PLAN_ROUTE as never)} style={styles.primary} />
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.notNow} accessibilityRole="button">
              <Text style={styles.notNowText}>Not now</Text>
            </Pressable>
            <Text style={styles.small}>{autoRenewDisclosure(platform, { trial: true })}</Text>
            <Text style={styles.small}>You can start the trial later from Settings, under App Subscription, as long as the store shows you are eligible.</Text>
          </Card>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={Color.gold} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: Spacing.lg },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  iconWrap: { marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontWeight: "700", color: Color.textPrimary },
  body: { fontSize: FontSize.base, color: Color.textSecondary, flexShrink: 1 },
  planLine: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  primary: { marginTop: Spacing.md },
  notNow: { alignSelf: "center", paddingVertical: Spacing.sm },
  notNowText: { fontSize: FontSize.base, color: Color.textMuted, fontWeight: "600" },
  small: { fontSize: FontSize.xs, color: Color.textMuted, lineHeight: 16 },
  center: { alignItems: "center", justifyContent: "center", padding: Spacing.xl },
});

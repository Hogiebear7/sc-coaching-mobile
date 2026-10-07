import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Spacing } from "@/constants/theme";
import { APP_SUBSCRIPTION_BASE_PLANS } from "@/lib/billing";
import { describeOutcome } from "@/lib/billing/outcome-copy";
import { useAppSubscriptionPurchase } from "@/lib/billing/use-app-subscription-purchase";

// The Android App Subscription purchase card. Renders nothing unless the billing module is present in this build and a
// product id is configured, so it has no effect on a build that does not include Google Play Billing. Prices are shown
// by Google Play's own purchase sheet, never hardcoded here. Gym Membership is NOT sold here: that stays on the web.
export function AppSubscriptionCard() {
  const { available, busy, outcome, purchase, restore, dismiss } = useAppSubscriptionPurchase();
  if (!available) return null;

  const message = outcome ? describeOutcome(outcome) : null;
  const toneColor = message?.tone === "success" ? Color.gold : message?.tone === "error" ? Color.danger : message?.tone === "warning" ? Color.warning : Color.textMuted;

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>APP SUBSCRIPTION</Text>
      <Text style={styles.title}>Unlock the full app</Text>
      <Text style={styles.body}>AI coaching, workout generation, food tools and more. Billed by Google Play. Cancel any time in Google Play.</Text>

      {APP_SUBSCRIPTION_BASE_PLANS.map((plan) => (
        <Button key={plan.id} title={`Subscribe: ${plan.label}`} onPress={() => purchase(plan.id)} loading={busy} variant={plan.id === "monthly" ? "primary" : "secondary"} style={styles.button} />
      ))}

      <Pressable onPress={restore} disabled={busy} hitSlop={8} style={styles.restore}>
        <Text style={styles.restoreText}>Restore purchase</Text>
      </Pressable>

      {message ? (
        <View style={[styles.message, { borderColor: toneColor }]}>
          <Text style={[styles.messageTitle, { color: toneColor }]}>{message.title}</Text>
          <Text style={styles.messageBody}>{message.body}</Text>
          <Pressable onPress={dismiss} hitSlop={8}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginTop: Spacing.md },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
  body: { fontSize: 13, color: Color.textMuted, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  button: { marginTop: Spacing.sm },
  restore: { alignSelf: "center", marginTop: Spacing.md },
  restoreText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
  message: { borderWidth: 1, borderRadius: 8, padding: Spacing.md, marginTop: Spacing.md },
  messageTitle: { fontSize: 14, fontWeight: "700" },
  messageBody: { fontSize: 12, color: Color.textMuted, lineHeight: 17, marginTop: 4 },
  dismiss: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.sm, textDecorationLine: "underline" },
});

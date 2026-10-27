import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/app/primitives";
import { AppRadius } from "@/constants/theme";
import { registerUpgradeHandler } from "@/lib/api-client";
import { makeStyles } from "@/lib/theme";
import { CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";

// Mounted once at the app root. When the server answers that a feature is part of the App Subscription (code "upgrade_required", or
// "ai_upgrade_required" for AI), api-client calls the handler registered here and this sheet explains it, with a way to the subscribe screen in
// a build that sells the plan. Several refusals at the same moment share one sheet. Nothing is bought from here.
export function UpgradeHost() {
  const styles = useStyles();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    registerUpgradeHandler((serverMessage) => setMessage((current) => current ?? serverMessage));
    return () => registerUpgradeHandler(null);
  }, []);

  const close = () => setMessage(null);

  return (
    <Modal visible={message !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{CAN_SELL_DIGITAL_PLAN ? "Part of the App Subscription" : "Not included in your plan"}</Text>
          <Text style={styles.body}>{message}</Text>
          {CAN_SELL_DIGITAL_PLAN ? (
            <>
              <PillButton
                title="See the App Subscription"
                onPress={() => {
                  close();
                  router.push(DIGITAL_PLAN_ROUTE as never);
                }}
                style={styles.primary}
              />
              <Pressable onPress={close} hitSlop={8} style={styles.later} accessibilityRole="button">
                <Text style={styles.laterText}>Not now</Text>
              </Pressable>
            </>
          ) : (
            <PillButton title="OK" onPress={close} style={styles.primary} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 20 },
    title: { fontSize: 18, fontWeight: "600", color: c.text },
    body: { fontSize: 15, lineHeight: 21, color: c.textMuted, marginTop: 8 },
    primary: { marginTop: 18 },
    later: { alignSelf: "center", marginTop: 14, paddingVertical: 6 },
    laterText: { fontSize: 15, color: c.textMuted },
  })
);

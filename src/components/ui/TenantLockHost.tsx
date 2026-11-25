import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Modal, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/app/primitives";
import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { AppRadius } from "@/constants/theme";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { setTenantStatus, useTenantStatus } from "@/lib/tenant-status";
import { makeStyles, useAppTheme } from "@/lib/theme";

// Mounted once at the app root. While the gym is locked for an unpaid platform subscription (see lib/tenant-status.ts) this covers the app with a plain, calm
// message. Members are told the gym is temporarily unavailable and that nothing has been lost. The gym's own staff are told why, and get a button to the gym's payment
// link. "Check again" asks the server straight away, so access returns the moment the gym has paid. Signing out is always possible.
export function TenantLockHost() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const status = useTenantStatus();
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [stillLocked, setStillLocked] = useState(false);
  const staff = user?.role === "coach" || user?.role === "admin" || user?.role === "admin_manager";

  async function checkAgain() {
    setChecking(true);
    setStillLocked(false);
    try {
      const me = await apiFetch<{ tenant?: unknown }>("/api/mobile/auth/me");
      setTenantStatus(me.tenant);
      setStillLocked(me.tenant !== undefined && (me.tenant as { state?: string } | null)?.state === "locked");
    } catch {
      setStillLocked(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Modal visible={status.state === "locked"} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <BlurBackdrop />
        <View style={styles.card} accessibilityViewIsModal>
          <Ionicons name="pause-circle-outline" size={44} color={colors.text} />
          <Text style={styles.title}>{staff ? "Access is paused" : "This gym is temporarily unavailable"}</Text>
          <Text style={styles.body}>
            {staff
              ? "Your gym's platform subscription is overdue. Nothing has been deleted: everything comes back as soon as the payment is made."
              : "Nothing has been lost. Your gym will be back soon. Please speak to your gym if you need anything in the meantime."}
          </Text>
          {staff && status.payUrl ? <PillButton title="Pay now" onPress={() => void Linking.openURL(status.payUrl as string)} /> : null}
          {staff && !status.payUrl ? <Text style={styles.small}>Contact S&C Performance Coaching to arrange payment.</Text> : null}
          <View style={{ height: 10 }} />
          <PillButton title={checking ? "Checking…" : "Check again"} onPress={() => void checkAgain()} />
          {stillLocked ? <Text style={styles.small}>Still paused.</Text> : null}
          <Text style={styles.link} onPress={() => void logout()} accessibilityRole="button">
            Sign out
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 420, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 24, alignItems: "center", gap: 12 },
    title: { fontSize: 22, fontWeight: "700", color: c.text, textAlign: "center" },
    body: { fontSize: 15, lineHeight: 22, color: c.textSecondary, textAlign: "center" },
    small: { fontSize: 14, color: c.textMuted, textAlign: "center" },
    link: { marginTop: 8, fontSize: 15, color: c.textSecondary, textDecorationLine: "underline", paddingVertical: 8 },
  })
);

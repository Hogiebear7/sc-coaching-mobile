import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppRadius } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { graceBannerText, useTenantStatus } from "@/lib/tenant-status";
import { makeStyles, useAppTheme } from "@/lib/theme";

// A calm banner for a gym's own staff while the gym's platform payment is overdue but access has not paused yet. Members never see it (the server only reports
// the grace period to staff accounts' apps, and this also checks the role). Put it at the top of a staff-facing screen.
export function TenantGraceBanner() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const status = useTenantStatus();
  const { user } = useAuth();
  const staff = user?.role === "coach" || user?.role === "admin" || user?.role === "admin_manager";
  if (status.state !== "grace" || !staff) return null;
  const pay = status.payUrl;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
      <Text style={styles.text}>{graceBannerText(status)}</Text>
      {pay ? (
        <Pressable onPress={() => void Linking.openURL(pay)} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Pay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    banner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: AppRadius.card, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16, marginBottom: 12 },
    text: { flex: 1, fontSize: 14, lineHeight: 19, color: c.textSecondary },
    link: { fontSize: 15, fontWeight: "700", color: c.text, textDecorationLine: "underline" },
  })
);

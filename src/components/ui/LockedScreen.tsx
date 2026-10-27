import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton } from "@/components/app/primitives";
import { AppRadius, AppSpace } from "@/constants/theme";
import { makeStyles, useAppTheme } from "@/lib/theme";
import { CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";

// A whole screen that is part of the App Subscription, opened by a member without it (from an old link, a notification, or a shortcut):
// the screen's own title, one short explanation of what it does, and the way to the subscribe screen in a build that sells the plan. Free
// members normally never reach these screens; their entry points show an upgrade card instead.
export function LockedScreen({ title, icon, body }: { title: string; icon: keyof typeof Ionicons.glyphMap; body: string }) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={22} color={colors.text} />
        </View>
        <Text style={styles.title}>{CAN_SELL_DIGITAL_PLAN ? "Part of the App Subscription" : "Not included in your plan"}</Text>
        <Text style={styles.body}>{body}</Text>
        {CAN_SELL_DIGITAL_PLAN ? (
          <PillButton title="See the App Subscription" onPress={() => router.push(DIGITAL_PLAN_ROUTE as never)} style={{ marginTop: 18 }} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: AppSpace.gutter, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: "600", color: c.text },
    card: { margin: AppSpace.gutter, backgroundColor: c.surface, borderRadius: AppRadius.card, padding: 20 },
    icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 18, fontWeight: "600", color: c.text, marginTop: 14 },
    body: { fontSize: 15, lineHeight: 21, color: c.textMuted, marginTop: 6 },
  })
);

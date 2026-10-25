import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColor, AppRadius } from "@/constants/theme";

type Action = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string };

// The four most frequent logging jobs as round buttons, the rest as rows.
const QUICK: Action[] = [
  { label: "Workout", icon: "barbell-outline", href: "/log-workout" },
  { label: "Check-in", icon: "heart-outline", href: "/(tabs)/recovery" },
  { label: "Meal", icon: "restaurant-outline", href: "/log-food" },
  { label: "Scan", icon: "barcode-outline", href: "/barcode-scan" },
];

const ROWS: Action[] = [
  { label: "Weigh-in", icon: "scale-outline", href: "/profile" },
  { label: "Add water", icon: "water-outline", href: "/(tabs)/nutrition" },
  { label: "Rest timer", icon: "timer-outline", href: "/rest-timer" },
  { label: "Message your coach", icon: "chatbubble-ellipses-outline", href: "/messages" },
];

// Bottom sheet opened by the centre "+" in the tab bar. Every action is a
// navigation to an existing screen; nothing is logged from the sheet itself.
export function QuickActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function go(href: string) {
    onClose();
    router.push(href as never);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={AppColor.text} />
          </Pressable>
          <Text style={styles.title}>Log</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.quickRow}>
          {QUICK.map((a) => (
            <Pressable key={a.label} onPress={() => go(a.href)} style={styles.quick} accessibilityRole="button" accessibilityLabel={a.label}>
              <View style={styles.quickIcon}>
                <Ionicons name={a.icon} size={24} color={AppColor.text} />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.list}>
          {ROWS.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => go(a.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name={a.icon} size={22} color={AppColor.text} />
              <Text style={styles.rowLabel}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={AppColor.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: AppColor.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: AppColor.hairline, marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: "600", color: AppColor.text },
  quickRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  quick: { alignItems: "center", width: 80 },
  quickIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: AppColor.control, alignItems: "center", justifyContent: "center" },
  quickLabel: { marginTop: 8, fontSize: 14, color: AppColor.text },
  list: { marginTop: 12, backgroundColor: AppColor.surfaceHi, borderRadius: AppRadius.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 58, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColor.hairline },
  rowLabel: { flex: 1, fontSize: 16, color: AppColor.text },
});

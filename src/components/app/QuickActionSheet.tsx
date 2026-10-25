import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppRadius } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeStyles, useAppTheme } from "@/lib/theme";

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
//
// Navigation waits until the sheet has finished closing: closing a Modal and
// pushing a route in the same sync burst is the competing-transitions
// pattern that crashed log-workout on Android.
export function QuickActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (visible || !pending) return;
    const t = setTimeout(() => {
      router.push(pending as never);
      setPending(null);
    }, 280);
    return () => clearTimeout(t);
  }, [visible, pending, router]);

  function go(href: string) {
    tapFeedback();
    setPending(href);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Log</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.quickRow}>
          {QUICK.map((a) => (
            <Pressable key={a.label} onPress={() => go(a.href)} style={styles.quick} accessibilityRole="button" accessibilityLabel={a.label}>
              <View style={styles.quickIcon}>
                <Ionicons name={a.icon} size={24} color={colors.text} />
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
              <Ionicons name={a.icon} size={22} color={colors.text} />
              <Text style={styles.rowLabel}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16 },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.hairline, marginTop: 10 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
    title: { fontSize: 20, fontWeight: "600", color: c.text },
    quickRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
    quick: { alignItems: "center", width: 80 },
    quickIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    quickLabel: { marginTop: 8, fontSize: 14, color: c.text },
    list: { marginTop: 12, backgroundColor: c.surfaceHi, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 58, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowLabel: { flex: 1, fontSize: 16, color: c.text },
  })
);

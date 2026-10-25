import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppRadius } from "@/constants/theme";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import type { ChoosableTab } from "@/lib/tab-config";
import { makeStyles, useAppTheme } from "@/lib/theme";

export const TAB_LABEL: Record<ChoosableTab, string> = { schedule: "Schedule", workouts: "Train", nutrition: "Nutrition" };
const TAB_ICON: Record<ChoosableTab, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  schedule: "calendar-outline",
  workouts: "barbell-outline",
  nutrition: "restaurant-outline",
};

// Long-press a middle tab to put a different one in its place.
export function TabSwapSheet({
  tab,
  options,
  onChoose,
  onSettings,
  onClose,
}: {
  tab: ChoosableTab | null;
  options: ChoosableTab[];
  onChoose: (into: ChoosableTab) => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={tab !== null} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Change the {tab ? TAB_LABEL[tab] : ""} tab</Text>
        <Text style={styles.sub}>Show this in its place:</Text>
        <View style={styles.list}>
          {options.map((o, i) => (
            <Pressable
              key={o}
              onPress={() => {
                selectionFeedback();
                onChoose(o);
              }}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name={TAB_ICON[o]} size={22} color={colors.text} />
              <Text style={styles.rowText}>{TAB_LABEL[o]}</Text>
              <Ionicons name="swap-horizontal" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            tapFeedback();
            onSettings();
          }}
          style={styles.settingsLink}
          accessibilityRole="button"
        >
          <Text style={styles.settingsText}>More options in Settings</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
    sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.hairline, marginBottom: 14 },
    title: { fontSize: 19, fontWeight: "600", color: c.text },
    sub: { fontSize: 15, color: c.textMuted, marginTop: 4, marginBottom: 12 },
    list: { backgroundColor: c.surfaceHi, borderRadius: AppRadius.card, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 16 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    rowText: { flex: 1, fontSize: 16, fontWeight: "500", color: c.text },
    settingsLink: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginTop: 8 },
    settingsText: { fontSize: 15, fontWeight: "500", color: c.textSecondary, textDecorationLine: "underline" },
  })
);

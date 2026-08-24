import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

// Small reusable "what is this?" explainer — tap an (i) icon on a stat or
// metric, get a short plain-language answer in a dismissible sheet. Generic
// by design so any screen can reuse it rather than hand-rolling its own
// modal for every stat that needs a one-off explanation.
export function InfoModal({
  visible,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Ionicons name="close" size={16} color={Color.textMuted} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,10,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "86%",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  bodyScroll: { flexShrink: 1 },
  body: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginTop: Spacing.sm },
  closeButton: { position: "absolute", top: Spacing.md, right: Spacing.md, padding: 4 },
});

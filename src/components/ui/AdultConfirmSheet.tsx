import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Radius, Spacing } from "@/constants/theme";
import { useConfirmAdult } from "@/lib/queries/community-groups";
import { makeLegacyStyles } from "@/lib/theme";

// Groups and the gym community are for adults only (Community plan, owner decision 2026-11-08: minimum age 18). The member confirms once; the server
// records it and refuses groups and the gym feed until then, so this sheet is how a refused member gets unblocked.
export function AdultConfirmSheet({
  visible,
  onClose,
  onConfirmed,
  what,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
  /** What the member is trying to open, in a few words: "groups" or "your gym's community". */
  what: string;
}) {
  const styles = useStyles();
  const confirm = useConfirmAdult();

  function submit() {
    confirm.mutate(undefined, {
      onSuccess: () => onConfirmed?.(),
      onError: (e) => Alert.alert("Couldn't confirm", e.message || "Try again in a moment."),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Are you 18 or over?</Text>
          <Text style={styles.body}>
            Using {what} is for members aged 18 or over. By continuing you confirm that you are.
          </Text>
          <Button title="I'm 18 or over" onPress={submit} loading={confirm.isPending} style={{ marginTop: Spacing.md }} />
          <Pressable onPress={onClose} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(4,10,20,0.72)", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    card: { width: "100%", maxWidth: 360, borderRadius: Radius.lg, backgroundColor: Color.surface1, padding: Spacing.lg },
    title: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    body: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
    secondary: { marginTop: Spacing.md, alignSelf: "center", minHeight: 40, justifyContent: "center" },
    secondaryText: { fontSize: 14, fontWeight: "500", color: Color.textFaint, textDecorationLine: "underline" },
  })
);

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { registerAiConsentHandler } from "@/lib/api-client";
import { useSetAiConsent } from "@/lib/queries/ai-consent";

// Mounted once at the app root. When the server refuses an AI request because the member hasn't allowed AI features, api-client calls the handler registered
// here: the member sees exactly what is shared and with whom, and chooses. "Allow" saves the consent and the original request is sent again; "Not now" leaves
// AI off and the request fails with a plain message. Several refusals at the same moment share one prompt.
export function AiConsentHost() {
  const [visible, setVisible] = useState(false);
  const pending = useRef<((granted: boolean) => void)[]>([]);
  const setConsent = useSetAiConsent();

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        pending.current.push(resolve);
        setVisible(true);
      }),
    []
  );

  useEffect(() => {
    registerAiConsentHandler(ask);
    return () => registerAiConsentHandler(null);
  }, [ask]);

  function settle(granted: boolean) {
    const waiting = pending.current;
    pending.current = [];
    setVisible(false);
    setConsent.reset();
    for (const resolve of waiting) resolve(granted);
  }

  function allow() {
    setConsent.mutate(true, { onSuccess: () => settle(true) });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => settle(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Allow AI features?</Text>
          <Text style={styles.body}>
            To answer, this feature sends what you type, any photos you add, and the training, recovery and nutrition data it needs to our AI provider
            (Anthropic). It is used only to write your answer.
          </Text>
          <Text style={styles.body}>
            You can say no and the rest of the app works as normal. You can turn AI features off again at any time in Settings. See our privacy policy for
            details.
          </Text>
          {setConsent.isError ? <Text style={styles.error}>Couldn&apos;t save your choice. Check your connection and try again.</Text> : null}
          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.ghost]} onPress={() => settle(false)} disabled={setConsent.isPending} accessibilityRole="button">
              <Text style={styles.ghostText}>Not now</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primary]} onPress={allow} disabled={setConsent.isPending} accessibilityRole="button">
              {setConsent.isPending ? <ActivityIndicator color={Color.bg0} size="small" /> : <Text style={styles.primaryText}>Allow</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: Spacing.lg },
  card: { backgroundColor: Color.surface1, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Color.borderSubtle },
  title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
  body: { fontSize: 13, color: Color.textSecondary, lineHeight: 19, marginBottom: Spacing.sm },
  error: { fontSize: 12, color: Color.danger, marginBottom: Spacing.sm },
  buttons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  button: { flex: 1, minHeight: 46, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  ghost: { borderWidth: 1, borderColor: Color.borderSubtle },
  ghostText: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  primary: { backgroundColor: Color.gold },
  primaryText: { fontSize: 14, fontWeight: "700", color: Color.bg0 },
});

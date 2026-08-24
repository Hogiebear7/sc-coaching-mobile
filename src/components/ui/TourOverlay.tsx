import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { TOUR_PROMPT } from "@/lib/tour-content";
import { useTour } from "@/lib/tour-context";

import { Button } from "./Button";

// Mounted once near the app root (see app/_layout.tsx); reads all its state
// from useTour() so no screen has to know the tour exists to participate —
// a screen just is or isn't one of the tab routes the context watches.
export function TourHost() {
  const { showPrompt, activePage, startTour, deferTour, dismissPage, skipTour } = useTour();

  return (
    <>
      <Modal visible={showPrompt} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.promptIcon}>
              <Ionicons name="compass-outline" size={22} color={Color.gold} />
            </View>
            <Text style={styles.title}>{TOUR_PROMPT.title}</Text>
            <Text style={styles.description}>{TOUR_PROMPT.description}</Text>
            <Button title="Take the tour" onPress={startTour} style={styles.primaryButton} />
            <Pressable
              onPress={() => {
                tapFeedback();
                deferTour();
              }}
              hitSlop={8}
              style={styles.laterButton}
            >
              <Text style={styles.laterText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!activePage} transparent animationType="fade" statusBarTranslucent>
        {activePage ? (
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <View style={styles.promptIcon}>
                <Ionicons name={activePage.icon} size={22} color={Color.gold} />
              </View>
              <Text style={styles.title}>{activePage.title}</Text>
              <Text style={styles.description}>{activePage.description}</Text>
              <View style={styles.tipList}>
                {activePage.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={styles.tipBullet} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
              <Button title="Got it" onPress={dismissPage} style={styles.primaryButton} />
              <Pressable
                onPress={() => {
                  tapFeedback();
                  skipTour();
                }}
                hitSlop={8}
                style={styles.laterButton}
              >
                <Text style={styles.laterText}>Skip tour</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </>
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
    maxWidth: 380,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.xl,
    alignItems: "center",
  },
  promptIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700", color: Color.textPrimary, textAlign: "center" },
  description: {
    fontSize: 13,
    color: Color.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 19,
  },
  tipList: { width: "100%", marginTop: Spacing.lg, gap: Spacing.sm },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  tipBullet: {
    width: 5,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Color.gold,
    marginTop: 6,
  },
  tipText: { flex: 1, fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  primaryButton: { width: "100%", marginTop: Spacing.xl },
  laterButton: { marginTop: Spacing.md, padding: Spacing.xs },
  laterText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
});

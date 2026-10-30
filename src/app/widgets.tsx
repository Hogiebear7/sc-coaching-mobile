import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ClassWidgetPreview, NutritionWidgetPreview, WaterWidgetPreview } from "@/components/widgets/WidgetPreviews";
import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import { successFeedback } from "@/lib/haptics";
import { useLogWater } from "@/lib/queries/nutrition-diary";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { useWidgetSnapshot } from "@/lib/widgets/use-widget-snapshot";

// Settings > Home screen widgets: the three widgets with the member's own numbers, and how to add them. The water preview's button really
// logs water, the same as the widget's will.

const STEPS = {
  ios: [
    "Touch and hold an empty part of your Home Screen until the apps jiggle.",
    "Tap Edit, then Add Widget, and search for S&C.",
    "Pick Water, Nutrition or Next class, choose a size, and tap Add Widget.",
  ],
  android: [
    "Touch and hold an empty part of your home screen.",
    "Tap Widgets and scroll to S&C Coaching.",
    "Touch and hold Water, Nutrition or Next class, and drag it where you want it.",
  ],
};

export default function WidgetsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const snapshot = useWidgetSnapshot();
  const logWater = useLogWater();
  const steps = Platform.OS === "android" ? STEPS.android : STEPS.ios;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Home screen widgets</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Your water, food and next class on your home screen, without opening the app. They update whenever the app does.</Text>

        <View style={styles.previews}>
          {snapshot.water ? (
            <WaterWidgetPreview
              data={snapshot.water}
              onAdd={() => {
                successFeedback();
                logWater.mutate({ date: snapshot.water!.date, deltaMl: snapshot.water!.amountMl });
              }}
            />
          ) : null}
          {snapshot.nutrition ? <NutritionWidgetPreview data={snapshot.nutrition} /> : null}
          {snapshot.classes ? <ClassWidgetPreview data={snapshot.classes} /> : null}
        </View>
        <Text style={styles.note}>
          The water button adds your usual amount ({snapshot.water?.amountMl ?? 250} ml). Change it in Settings under Water amount.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>How to add one</Text>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    intro: { fontSize: 15, lineHeight: 22, color: Color.textSecondary },
    previews: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" },
    note: { fontSize: 13, color: Color.textMuted, textAlign: "center" },
    card: { padding: Spacing.lg, gap: Spacing.md },
    cardTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
    step: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
    stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: Color.gold, color: Color.goldForeground, textAlign: "center", lineHeight: 22, fontSize: 12, fontWeight: "700", overflow: "hidden" },
    stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: Color.textSecondary },
  })
);

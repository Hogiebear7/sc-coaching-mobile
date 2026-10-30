import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { CLASS_LEAD_MINS, setLiveActivityPrefs, useLiveActivityPrefs, type LiveActivityPrefs } from "@/lib/widgets/live-activity";
import { useWidgetStyle } from "@/lib/widgets/widget-style";

import { AndroidLiveUpdate, IslandCompact, IslandExpanded, IslandMinimal, LockScreenActivity, type LiveKind } from "./LiveActivityPreviews";

// The Widgets screen's "Live on your lock screen" section: what the workout and class Live Activities (iPhone) / Live Updates (Android) look
// like, with a clock that really ticks, and a switch for each (Apple asks apps to make them easy to turn off in the app).

type Which = "workout" | "class";
type Phone = "iphone" | "android";

export function LiveActivitySection({ nextClassTitle }: { nextClassTitle: string | null }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const prefs = useLiveActivityPrefs();
  // The Lock Screen banner follows the widgets' Navy / Glass choice (the Dynamic Island is always black: Apple doesn't allow another background).
  const look = useWidgetStyle();
  const [which, setWhich] = useState<Which>("workout");
  const [phone, setPhone] = useState<Phone>(Platform.OS === "android" ? "android" : "iphone");
  const [showRest, setShowRest] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Sample times, fixed when the screen opens: a workout 12 minutes in, and a class 42 minutes away.
  const [base] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live: LiveKind = useMemo(
    () =>
      which === "workout"
        ? {
            kind: "workout",
            state: {
              title: "Upper body strength",
              startedAtMs: base - 12 * 60_000,
              accumulatedSecs: 0,
              setsDone: 14,
              currentExercise: "Bench press",
              restEndsAtMs: showRest ? base + 90_000 + Math.floor((nowMs - base) / 120_000) * 120_000 : null,
            },
          }
        : { kind: "class", state: { title: nextClassTitle ?? "Semi-Private PT", startsAtMs: base + 42 * 60_000, durationMins: 45 } },
    [which, base, showRest, nowMs, nextClassTitle]
  );

  function setPref(key: keyof LiveActivityPrefs, value: boolean) {
    tapFeedback();
    setLiveActivityPrefs({ ...prefs, [key]: value });
  }

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: Spacing.md }}>
      <Text style={styles.heading}>Live on your lock screen</Text>
      <Text style={styles.intro}>
        While you train, and in the hour before a class you&apos;ve booked, the app shows a live timer on your lock screen
        {phone === "iphone" ? " and in the Dynamic Island" : " and in the status bar"}. It ends on its own when the workout or class does.
      </Text>

      <View style={styles.chips}>
        {chip("Workout", which === "workout", () => setWhich("workout"))}
        {chip("Class", which === "class", () => setWhich("class"))}
        <View style={{ width: 12 }} />
        {chip("iPhone", phone === "iphone", () => setPhone("iphone"))}
        {chip("Android", phone === "android", () => setPhone("android"))}
      </View>
      {which === "workout" ? (
        <View style={styles.chips}>{chip(showRest ? "Resting" : "Show a rest", showRest, () => setShowRest((v) => !v))}</View>
      ) : null}

      <View style={styles.stage}>
        {phone === "iphone" ? (
          <>
            <Text style={styles.caption}>Dynamic Island</Text>
            <IslandCompact live={live} nowMs={nowMs} />
            <View style={styles.minimalRow}>
              <IslandMinimal live={live} nowMs={nowMs} />
              <Text style={styles.captionInline}>with another app&apos;s activity running</Text>
            </View>
            <Text style={styles.caption}>Touch and hold</Text>
            <IslandExpanded live={live} nowMs={nowMs} />
            <Text style={styles.caption}>Lock Screen{look === "glass" ? " (Glass, over your wallpaper)" : ""}</Text>
            {look === "glass" ? (
              <LinearGradient colors={["#3a6186", "#89253e", "#d98a4a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wallpaper}>
                <LockScreenActivity live={live} nowMs={nowMs} look="glass" />
              </LinearGradient>
            ) : (
              <LockScreenActivity live={live} nowMs={nowMs} />
            )}
            <Text style={styles.note}>The Dynamic Island is always black on every iPhone; the Lock Screen follows your Navy or Glass choice above.</Text>
          </>
        ) : (
          <>
            <Text style={styles.caption}>Status bar and notification shade</Text>
            <AndroidLiveUpdate live={live} nowMs={nowMs} />
          </>
        )}
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>During a workout</Text>
            <Text style={styles.rowSub}>Your workout time, sets and rest timer</Text>
          </View>
          <Switch
            value={prefs.workout}
            onValueChange={(v) => setPref("workout", v)}
            trackColor={{ false: Color.surface3, true: Color.success }}
            thumbColor="#ffffff"
            accessibilityLabel="Live timer during a workout"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Before a booked class</Text>
            <Text style={styles.rowSub}>A countdown from {CLASS_LEAD_MINS} minutes before it starts</Text>
          </View>
          <Switch
            value={prefs.classCountdown}
            onValueChange={(v) => setPref("classCountdown", v)}
            trackColor={{ false: Color.surface3, true: Color.success }}
            thumbColor="#ffffff"
            accessibilityLabel="Countdown before a booked class"
          />
        </View>
      </Card>
    </View>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    heading: { fontSize: 18, fontWeight: "700", color: Color.textPrimary },
    intro: { fontSize: 14, lineHeight: 20, color: Color.textSecondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, alignItems: "center" },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Color.borderSubtle, minHeight: 36, justifyContent: "center" },
    chipActive: { backgroundColor: Color.gold, borderColor: Color.gold },
    chipText: { fontSize: 13, fontWeight: "600", color: Color.textSecondary },
    chipTextActive: { color: Color.goldForeground },
    stage: { backgroundColor: "#1c2433", borderRadius: 24, padding: 16, gap: 10 },
    caption: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 4 },
    captionInline: { fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1 },
    wallpaper: { borderRadius: 26, padding: 10 },
    note: { fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 17 },
    minimalRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "center" },
    card: { padding: Spacing.lg, gap: Spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
    rowTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    rowSub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: Color.borderSubtle },
  })
);

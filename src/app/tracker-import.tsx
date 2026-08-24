import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { launchCameraAsync, launchImageLibraryAsync, useCameraPermissions } from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPermissionDenied } from "@/components/nutrition/CameraPermissionGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { tapFeedback } from "@/lib/haptics";
import { useTrackerImportScan, type TrackerStatsExtraction } from "@/lib/queries/tracker-import";

type Stage = "start" | "scanning" | "reviewing";

// One universal fallback for any fitness tracker/wearable app (Garmin,
// Whoop, Fitbit, Huawei Health, Samsung Health, Coros, Polar, Oura, or
// anything else) — a member photographs their tracker's own summary screen
// and this reads whatever it can, rather than needing a per-brand OAuth
// integration. Routes into the existing Log Workout / Recovery check-in
// screens via prefill params so it reuses their save logic rather than
// writing a second path to the same data.
export default function TrackerImportScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>("start");
  const [launching, setLaunching] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [stats, setStats] = useState<TrackerStatsExtraction | null>(null);
  const scan = useTrackerImportScan();

  async function runScan(pick: () => ReturnType<typeof launchCameraAsync>) {
    if (launching) return;
    tapFeedback();
    setScanError(null);
    setLaunching(true);

    let photoUri: string;
    try {
      const result = await pick();
      if (result.canceled || !result.assets?.[0]) {
        setLaunching(false);
        return;
      }
      photoUri = result.assets[0].uri;
    } catch (e) {
      setScanError(`Couldn't open that (${e instanceof Error ? e.message : String(e)}).`);
      setLaunching(false);
      return;
    }

    setLaunching(false);
    setStage("scanning");

    let imageBase64: string;
    try {
      const resized = await manipulateAsync(photoUri, [{ resize: { width: 1280 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64) throw new Error("Could not encode photo");
      imageBase64 = `data:image/jpeg;base64,${resized.base64}`;
    } catch (e) {
      setScanError(`Couldn't process that photo (${e instanceof Error ? e.message : String(e)}).`);
      setStage("start");
      return;
    }

    try {
      const res = await scan.mutateAsync(imageBase64);
      setStats(res.stats);
      setStage("reviewing");
    } catch (e) {
      setScanError(e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.");
      setStage("start");
    }
  }

  function updateStats(patch: Partial<TrackerStatsExtraction>) {
    setStats((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function useAsWorkout() {
    if (!stats) return;
    tapFeedback();
    router.replace({
      pathname: "/log-workout",
      params: {
        prefillRunTitle: stats.activityTitle ?? "Run",
        prefillRunDurationMins: stats.durationMins != null ? String(stats.durationMins) : "",
        prefillRunDistanceKm: stats.distanceKm != null ? String(stats.distanceKm) : "",
      },
    });
  }

  function useAsRecovery() {
    if (!stats?.sleepHours) return;
    tapFeedback();
    router.replace({
      pathname: "/(tabs)/recovery",
      params: { prefillSleepHours: String(stats.sleepHours) },
    });
  }

  const hasWorkoutData = !!(stats && (stats.durationMins != null || stats.distanceKm != null));
  const hasSleepData = !!stats?.sleepHours;
  const hasNothing = !!stats && !hasWorkoutData && !hasSleepData && !stats.calories && !stats.avgHeartRate && !stats.otherReadings;

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === "scanning") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="sparkles" size={26} color={Color.goldForeground} />
          </View>
          <Text style={styles.confirmTitle}>Photo captured</Text>
          <Text style={styles.confirmText}>Reading your tracker&apos;s stats…</Text>
          <ActivityIndicator color={Color.gold} size="small" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === "reviewing" && stats) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setStage("start")} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {hasNothing ? (
            <Text style={styles.subhead}>We couldn&apos;t make out any stats in that photo — try a clearer, well-lit shot of the summary screen.</Text>
          ) : (
            <Text style={styles.subhead}>Here&apos;s what we could read — check it over before using it.</Text>
          )}

          <Card style={styles.reviewCard}>
            <Text style={styles.sectionLabel}>ACTIVITY</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                value={stats.activityTitle ?? ""}
                onChangeText={(v) => updateStats({ activityTitle: v || null })}
                placeholder="e.g. Run"
                placeholderTextColor={Color.textFaint}
                style={styles.input}
              />
            </View>
            <View style={styles.gridRow}>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Duration (min)</Text>
                <TextInput
                  value={stats.durationMins != null ? String(stats.durationMins) : ""}
                  onChangeText={(v) => updateStats({ durationMins: v.trim() ? Number(v) || null : null })}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={Color.textFaint}
                  style={styles.input}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Distance (km)</Text>
                <TextInput
                  value={stats.distanceKm != null ? String(stats.distanceKm) : ""}
                  onChangeText={(v) => updateStats({ distanceKm: v.trim() ? Number(v) || null : null })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Color.textFaint}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Calories</Text>
                <TextInput
                  value={stats.calories != null ? String(stats.calories) : ""}
                  editable={false}
                  placeholder="—"
                  placeholderTextColor={Color.textFaint}
                  style={[styles.input, styles.inputReadOnly]}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Avg heart rate</Text>
                <TextInput
                  value={stats.avgHeartRate != null ? String(stats.avgHeartRate) : ""}
                  editable={false}
                  placeholder="—"
                  placeholderTextColor={Color.textFaint}
                  style={[styles.input, styles.inputReadOnly]}
                />
              </View>
            </View>
            <Button
              title="Add as a workout"
              onPress={useAsWorkout}
              disabled={!hasWorkoutData}
              variant="secondary"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>

          <Card style={styles.reviewCard}>
            <Text style={styles.sectionLabel}>SLEEP</Text>
            <View style={styles.numberField}>
              <Text style={styles.fieldLabel}>Sleep hours</Text>
              <TextInput
                value={stats.sleepHours != null ? String(stats.sleepHours) : ""}
                onChangeText={(v) => updateStats({ sleepHours: v.trim() ? Number(v) || null : null })}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={Color.textFaint}
                style={styles.input}
              />
            </View>
            <Button
              title="Use for today's recovery check-in"
              onPress={useAsRecovery}
              disabled={!hasSleepData}
              variant="secondary"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>

          {stats.otherReadings ? (
            <Card style={styles.noteCard}>
              <Text style={styles.noteLabel}>ALSO VISIBLE (NOT SAVED YET)</Text>
              <Text style={styles.noteText}>{stats.otherReadings}</Text>
            </Card>
          ) : null}

          <Pressable onPress={() => setStage("start")} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>Retake photo</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Import from Tracker</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.centerFill}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="watch-outline" size={26} color={Color.goldForeground} />
        </View>
        <Text style={styles.confirmTitle}>Photograph your tracker&apos;s summary</Text>
        <Text style={styles.confirmText}>
          Works with any brand — Garmin, Whoop, Fitbit, Huawei Health, Samsung Health, Coros, Polar, Oura, and more. We&apos;ll read whatever&apos;s on screen.
        </Text>

        {scanError ? <Text style={styles.scanErrorText}>{scanError} Try again.</Text> : null}

        {!permission.granted && !permission.canAskAgain ? (
          <CameraPermissionDenied
            canAskAgain={permission.canAskAgain}
            requestPermission={requestPermission}
            message="S&C Coaching needs camera access to read a photo of your tracker."
          />
        ) : (
          <Button
            title="Take Photo"
            onPress={() => runScan(() => launchCameraAsync({ quality: 0.9, mediaTypes: ["images"], exif: false }))}
            loading={launching}
            style={{ marginTop: Spacing.lg, alignSelf: "stretch" }}
          />
        )}
        <Pressable
          onPress={() => runScan(() => launchImageLibraryAsync({ quality: 0.9, mediaTypes: ["images"], exif: false }))}
          style={styles.manualLink}
        >
          <Text style={styles.manualLinkText}>Choose from photos instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  subhead: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  confirmIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md, textAlign: "center" },
  confirmText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  scanErrorText: { textAlign: "center", fontSize: 12, color: Color.danger, marginTop: Spacing.sm, paddingHorizontal: Spacing.xl },
  manualLink: { alignItems: "center", paddingVertical: Spacing.lg },
  manualLinkText: { fontSize: 13, color: Color.gold, fontWeight: "600" },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  reviewCard: { padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  fieldRow: { marginTop: 2 },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  numberField: { flex: 1, marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  input: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  inputReadOnly: { color: Color.textMuted },
  noteCard: { padding: Spacing.md, marginBottom: Spacing.md, backgroundColor: Color.goldWeak, borderColor: Color.goldBorder },
  noteLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.gold },
  noteText: { fontSize: 12, color: Color.textSecondary, marginTop: 4, lineHeight: 17 },
});

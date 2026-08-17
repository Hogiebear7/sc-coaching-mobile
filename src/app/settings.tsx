import { Ionicons } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image, type ImageStyle } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { isBatteryOptimizationRelevant, openBatteryOptimizationSettings } from "@/lib/battery-optimization";
import {
  useProfile,
  useRequestPasswordReset,
  useSetAvatar,
  useSetEmailNotifications,
  useSetPushNotifications,
  useSetReminderTimings,
  useSetRestTimerSeconds,
  useSetUnits,
  type MeasurementUnits,
} from "@/lib/queries/profile";

const REMINDER_PRESETS = [
  { label: "24 hours before", mins: 1440 },
  { label: "6 hours before", mins: 360 },
  { label: "3 hours before", mins: 180 },
  { label: "1 hour before", mins: 60 },
];

// Mirrors rest-timer.tsx's own PRESETS — the manual timer and this default
// should offer the same set of choices.
const REST_TIMER_PRESETS = [30, 60, 90, 120, 180, 300];

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Row({
  icon,
  title,
  sub,
  onPress,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={Color.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={Color.textFaint} /> : null)}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useProfile();
  const setPush = useSetPushNotifications();
  const setEmail = useSetEmailNotifications();
  const setUnits = useSetUnits();
  const setRestTimer = useSetRestTimerSeconds();
  const setAvatar = useSetAvatar();
  const setReminders = useSetReminderTimings();
  const requestReset = useRequestPasswordReset();

  const [resetSent, setResetSent] = useState(false);
  const [timings, setTimings] = useState<number[] | null>(null);
  const [customMins, setCustomMins] = useState("");
  const [remindersHydrated, setRemindersHydrated] = useState(false);
  const [remindersDirty, setRemindersDirty] = useState(false);
  const [remindersSaved, setRemindersSaved] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || remindersHydrated) return;
    setTimings(data.reminderTimingsMins);
    setRemindersHydrated(true);
  }, [data, remindersHydrated]);

  function togglePreset(mins: number) {
    setTimings((prev) => {
      const current = prev ?? [];
      return current.includes(mins) ? current.filter((m) => m !== mins) : [...current, mins];
    });
    setRemindersDirty(true);
    setRemindersSaved(false);
  }

  function addCustomMins() {
    const n = Number(customMins.trim());
    if (!Number.isInteger(n) || n <= 0) return;
    setTimings((prev) => {
      const current = prev ?? [];
      return current.includes(n) ? current : [...current, n];
    });
    setCustomMins("");
    setRemindersDirty(true);
    setRemindersSaved(false);
  }

  function removeTiming(mins: number) {
    setTimings((prev) => (prev ?? []).filter((m) => m !== mins));
    setRemindersDirty(true);
    setRemindersSaved(false);
  }

  function useDefaults() {
    setTimings(null);
    setRemindersDirty(true);
    setRemindersSaved(false);
  }

  async function handleSaveReminders() {
    await setReminders.mutateAsync(timings && timings.length > 0 ? timings : null);
    setRemindersDirty(false);
    setRemindersSaved(true);
  }

  async function handleResetPassword() {
    if (!data) return;
    try {
      await requestReset.mutateAsync(data.email);
      setResetSent(true);
    } catch {
      // Generic endpoint always returns success-shaped responses; nothing to surface.
    }
  }

  async function handlePickAvatar() {
    setAvatarError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError("Photo library access is needed to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      const resized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true }
      );
      if (!resized.base64) throw new Error("no-base64");
      await setAvatar.mutateAsync(`data:image/jpeg;base64,${resized.base64}`);
    } catch (e) {
      setAvatarError(e instanceof ApiError ? e.message : "Could not process that photo.");
    }
  }

  function handleRemoveAvatar() {
    Alert.alert("Remove photo?", "Your profile will show your initials instead.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatar.mutate(null) },
    ]);
  }

  const sortedTimings = [...(timings ?? [])].sort((a, b) => b - a);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading || !data ? (
        <View style={styles.centerFill} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <SectionLabel>APPEARANCE</SectionLabel>
          <Card style={styles.appearanceCard}>
            {data.avatarDataUrl ? (
              <Image source={{ uri: data.avatarDataUrl }} style={styles.avatar as ImageStyle} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(data.fullName || data.email).slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Profile photo</Text>
              <View style={styles.avatarActions}>
                <Pressable onPress={handlePickAvatar} disabled={setAvatar.isPending}>
                  <Text style={styles.linkText}>Change photo</Text>
                </Pressable>
                {data.avatarDataUrl ? (
                  <Pressable onPress={handleRemoveAvatar} disabled={setAvatar.isPending}>
                    <Text style={styles.linkTextDanger}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
              {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
            </View>
          </Card>

          <SectionLabel>ACCOUNT</SectionLabel>
          <Card style={styles.settingsCard}>
            <Row icon="person-outline" title={data.fullName} sub={data.email} />
            <View style={styles.divider} />
            <Row
              icon="key-outline"
              title="Reset password"
              sub={resetSent ? "Link sent — check your email." : "Emails you a link to set a new password."}
              onPress={resetSent ? undefined : handleResetPassword}
              right={
                resetSent ? (
                  <Ionicons name="checkmark-circle" size={18} color={Color.success} />
                ) : requestReset.isPending ? undefined : (
                  <Ionicons name="chevron-forward" size={16} color={Color.textFaint} />
                )
              }
            />
          </Card>

          <SectionLabel>MEMBERSHIP</SectionLabel>
          <Card style={styles.settingsCard}>
            <Row
              icon="card-outline"
              title="Manage membership"
              sub="Plan, billing, and payment method"
              onPress={() => router.push("/membership")}
            />
          </Card>

          <SectionLabel>PREFERENCES</SectionLabel>
          <Card style={styles.settingsCard}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="speedometer-outline" size={16} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Measurement units</Text>
              </View>
              <View style={styles.unitsToggle}>
                {(["metric", "imperial"] as MeasurementUnits[]).map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setUnits.mutate(u)}
                    style={[styles.unitsChip, data.preferredUnits === u && styles.unitsChipActive]}
                  >
                    <Text style={[styles.unitsChipText, data.preferredUnits === u && styles.unitsChipTextActive]}>
                      {u === "metric" ? "Metric" : "Imperial"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={[styles.row, { alignItems: "flex-start" }]}>
              <View style={styles.rowIcon}>
                <Ionicons name="timer-outline" size={16} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Rest timer</Text>
                <Text style={[styles.rowSub, { marginBottom: Spacing.sm }]}>
                  Starts automatically when you complete a set
                </Text>
                <View style={styles.chipRow}>
                  {REST_TIMER_PRESETS.map((secs) => (
                    <Pressable
                      key={secs}
                      onPress={() => setRestTimer.mutate(secs)}
                      style={[styles.chip, data.restTimerSeconds === secs && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, data.restTimerSeconds === secs && styles.chipTextActive]}>
                        {secs < 60 ? `${secs}s` : `${secs / 60}m`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Card>

          <SectionLabel>NOTIFICATIONS</SectionLabel>
          <Card style={styles.settingsCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Push notifications</Text>
                <Text style={styles.rowSub}>Class reminders, coach messages, and offers</Text>
              </View>
              <Switch
                value={data.pushNotificationsEnabled}
                onValueChange={(v) => setPush.mutate(v)}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Email notifications</Text>
                <Text style={styles.rowSub}>Booking confirmations and account updates</Text>
              </View>
              <Switch
                value={data.emailNotificationsEnabled}
                onValueChange={(v) => setEmail.mutate(v)}
                trackColor={{ false: Color.surface3, true: Color.gold }}
                thumbColor={Color.textPrimary}
              />
            </View>
            {isBatteryOptimizationRelevant() ? (
              <>
                <View style={styles.divider} />
                <Pressable style={styles.row} onPress={() => openBatteryOptimizationSettings()}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Notification reliability</Text>
                    <Text style={styles.rowSub}>
                      Allow this app to run without battery restrictions — otherwise Android can delay or drop rest
                      timer and other alerts while it&apos;s in the background.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
                </Pressable>
              </>
            ) : null}
          </Card>

          <Card style={[styles.settingsCard, { marginTop: Spacing.sm, padding: Spacing.md }]}>
            <Text style={styles.rowTitle}>Class reminders</Text>
            <Text style={[styles.rowSub, { marginBottom: Spacing.sm }]}>
              {timings === null ? "Using default timings." : "Get notified before your booked classes."}
            </Text>
            <View style={styles.chipRow}>
              {REMINDER_PRESETS.map((p) => (
                <Pressable
                  key={p.mins}
                  onPress={() => togglePreset(p.mins)}
                  style={[styles.chip, (timings ?? []).includes(p.mins) && styles.chipActive]}
                >
                  <Text style={[styles.chipText, (timings ?? []).includes(p.mins) && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {sortedTimings.some((m) => !REMINDER_PRESETS.some((p) => p.mins === m)) ? (
              <View style={[styles.chipRow, { marginTop: Spacing.xs }]}>
                {sortedTimings
                  .filter((m) => !REMINDER_PRESETS.some((p) => p.mins === m))
                  .map((m) => (
                    <Pressable key={m} onPress={() => removeTiming(m)} style={[styles.chip, styles.chipActive]}>
                      <Text style={[styles.chipText, styles.chipTextActive]}>{m} min ×</Text>
                    </Pressable>
                  ))}
              </View>
            ) : null}

            <View style={styles.customRow}>
              <TextInput
                value={customMins}
                onChangeText={setCustomMins}
                placeholder="Custom minutes before class"
                placeholderTextColor={Color.textFaint}
                keyboardType="number-pad"
                style={styles.customInput}
              />
              <Pressable onPress={addCustomMins} style={styles.addButton}>
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>

            <View style={styles.reminderActions}>
              <Pressable onPress={useDefaults}>
                <Text style={styles.linkText}>Use defaults</Text>
              </Pressable>
              {remindersDirty ? (
                <Button
                  title={setReminders.isPending ? "Saving…" : "Save"}
                  onPress={handleSaveReminders}
                  loading={setReminders.isPending}
                  style={styles.reminderSaveButton}
                />
              ) : remindersSaved ? (
                <Text style={styles.saved}>Saved.</Text>
              ) : null}
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingsCard: { padding: 0 },
  row: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  rowSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  divider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  appearanceCard: { padding: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: Radius.pill },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Color.goldWeak,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 20, fontWeight: "700", color: Color.gold },
  avatarActions: { flexDirection: "row", gap: Spacing.md, marginTop: 4 },
  linkText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  linkTextDanger: { fontSize: 12, fontWeight: "600", color: Color.danger },
  error: { fontSize: 11, color: Color.danger, marginTop: 4 },
  unitsToggle: { flexDirection: "row", gap: 6 },
  unitsChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  unitsChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  unitsChipText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
  unitsChipTextActive: { color: Color.gold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
  customRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface2,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Color.textPrimary,
  },
  addButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
  },
  addButtonText: { fontSize: 12, fontWeight: "600", color: Color.textSecondary },
  reminderActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  reminderSaveButton: { height: 36, paddingHorizontal: Spacing.lg },
  saved: { color: Color.success, fontSize: 12 },
});

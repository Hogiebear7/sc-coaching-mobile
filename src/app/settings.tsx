import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image, type ImageStyle } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { UpsellCard, UpsellRow } from "@/components/ui/Upsell";
import { Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { DEFAULT_CHECKIN_REMINDER, formatReminderTime, loadCheckinReminderPrefs, saveCheckinReminderPrefs, type CheckinReminderPrefs } from "@/lib/checkin-reminder";
import { useAuth } from "@/lib/auth-context";
import { isBatteryOptimizationRelevant, openBatteryOptimizationSettings } from "@/lib/battery-optimization";
import { hapticsEnabled, setHapticsEnabled, tapFeedback } from "@/lib/haptics";
import { hasAccess, tierFromAccess } from "@/lib/member-access";
import { useAiConsent, useSetAiConsent } from "@/lib/queries/ai-consent";
import { setTabChoice, useTabChoice } from "@/lib/tab-choice";
import { canChooseTabs, normaliseChoice, TAB_PAIR_OPTIONS } from "@/lib/tab-config";
import { LIGHT_MODE_AVAILABLE, makeLegacyStyles, useLegacyColors } from "@/lib/theme";
import { setWaterAmount, useWaterAmount, validWaterAmount, WATER_AMOUNT_MAX_ML, WATER_AMOUNT_MIN_ML, WATER_AMOUNT_PRESETS } from "@/lib/water-amount";
import { useTour } from "@/lib/tour-context";
import {
  useMemberAccess,
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
import { CAN_LINK_GYM_MEMBERSHIP, CAN_SELL_DIGITAL_PLAN, DIGITAL_PLAN_ROUTE } from "@/lib/upsell-config";

const REMINDER_PRESETS = [
  { label: "24 hours before", mins: 1440 },
  { label: "6 hours before", mins: 360 },
  { label: "3 hours before", mins: 180 },
  { label: "1 hour before", mins: 60 },
];

// Mirrors rest-timer.tsx's own PRESETS — the manual timer and this default
// should offer the same set of choices.
const REST_TIMER_PRESETS = [30, 60, 90, 120, 180, 300];

// Morning check-in reminder: one tap moves the time by 15 minutes.
const REMINDER_STEP_MINS = 15;
function shiftReminder(p: CheckinReminderPrefs, by: number): CheckinReminderPrefs {
  const total = (((p.hour * 60 + p.minute + by) % 1440) + 1440) % 1440;
  return { ...p, hour: Math.floor(total / 60), minute: total % 60 };
}

function SectionLabel({ children }: { children: string }) {
  const styles = useStyles();
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
  const styles = useStyles();
  const Color = useLegacyColors();
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

// Settings > Water amount: the member's usual drink, used by the first Hydration button and the water widget (lib/water-amount.ts).
function WaterAmountRow() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const amount = useWaterAmount();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function saveCustom() {
    const ml = validWaterAmount(custom);
    if (ml === null) {
      setError(`Enter a number of ml from ${WATER_AMOUNT_MIN_ML} to ${WATER_AMOUNT_MAX_ML}.`);
      return;
    }
    setWaterAmount(ml);
    setCustom("");
    setError(null);
    tapFeedback();
  }

  return (
    <View style={[styles.row, { flexDirection: "column", alignItems: "stretch" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <View style={styles.rowIcon}>
          <Ionicons name="water-outline" size={16} color={Color.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Water amount</Text>
          <Text style={styles.rowSub}>{amount} ml per tap on the Hydration card and the water widget</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm }}>
        {WATER_AMOUNT_PRESETS.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => {
              setWaterAmount(ml);
              setError(null);
              tapFeedback();
            }}
            style={[styles.chip, amount === ml && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: amount === ml }}
          >
            <Text style={[styles.chipText, amount === ml && styles.chipTextActive]}>{ml} ml</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm }}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder={WATER_AMOUNT_PRESETS.includes(amount) ? "Your own, in ml" : `${amount}`}
          placeholderTextColor={Color.textFaint}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={saveCustom}
          style={[styles.customInput, { flex: 1 }]}
          accessibilityLabel="Your own water amount in ml"
        />
        <Button title="Set" variant="secondary" onPress={saveCustom} disabled={!custom.trim()} />
      </View>
      {error ? <Text style={[styles.rowSub, { color: Color.danger }]}>{error}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { user } = useAuth();
  const { restartTour } = useTour();
  const [haptics, setHaptics] = useState(hapticsEnabled());
  const access = useMemberAccess();
  const aiConsent = useAiConsent();
  const setAiConsent = useSetAiConsent();
  const tier = tierFromAccess(access);
  const tabChoice = normaliseChoice(useTabChoice(), tier);
  const canUseNotifications = hasAccess(access, "notifications");
  const canUseGymProfiles = hasAccess(access, "gymProfiles");
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
  const [checkinReminder, setCheckinReminder] = useState<CheckinReminderPrefs>(DEFAULT_CHECKIN_REMINDER);

  useEffect(() => {
    void loadCheckinReminderPrefs().then(setCheckinReminder);
  }, []);

  function updateCheckinReminder(next: CheckinReminderPrefs) {
    setCheckinReminder(next);
    void saveCheckinReminderPrefs(next);
  }

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
  const remindersSummary =
    timings === null
      ? "Using default timings"
      : timings.length === 0
        ? "No reminders"
        : sortedTimings.map((m) => REMINDER_PRESETS.find((p) => p.mins === m)?.label ?? `${m} min before`).join(", ");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading || !data ? (
        <View style={styles.centerFill} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.identityRow}>
            {data.avatarDataUrl ? (
              <Image source={{ uri: data.avatarDataUrl }} style={styles.avatar as ImageStyle} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(data.fullName || data.email).slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.identityName}>{data.fullName}</Text>
              <Text style={styles.identityEmail}>{data.email}</Text>
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
          </View>

          <SectionLabel>Account</SectionLabel>
          <Card style={styles.settingsCard}>
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
            {user?.role === "member" ? (
              <Row
                icon="trash-outline"
                title="Delete account"
                sub="Permanently delete your account and data"
                onPress={() => router.push("/delete-account" as never)}
                right={<Ionicons name="chevron-forward" size={16} color={Color.textFaint} />}
              />
            ) : (
              <Row
                icon="trash-outline"
                title="Delete account"
                sub="Staff accounts are removed by the gym owner. Email info@sandccoaching.com."
              />
            )}
          </Card>

          <SectionLabel>Membership</SectionLabel>
          <Card style={styles.settingsCard}>
            <Row
              icon="card-outline"
              title="Gym membership"
              sub={CAN_LINK_GYM_MEMBERSHIP ? "Classes and coach messaging, billed by the gym" : "Your gym membership and status"}
              onPress={() => router.push("/membership")}
            />
            {CAN_SELL_DIGITAL_PLAN || access.digital ? (
              <Row
                icon="sparkles-outline"
                title="App Subscription"
                sub={access.digital ? "Your plan: manage or restore" : "AI coaching, calorie targets, programmes and more"}
                onPress={() => router.push(DIGITAL_PLAN_ROUTE as never)}
              />
            ) : null}
          </Card>

          <SectionLabel>AI features</SectionLabel>
          <Card style={styles.settingsCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Send my data to the AI provider</Text>
                <Text style={styles.rowSub}>
                  {aiConsent.data?.granted
                    ? "On. The AI coach, food photos, receipts, meal ideas, programme generation and workout reviews send your text, photos and the training, recovery and nutrition data they need to Anthropic to write your answer."
                    : "Off. Nothing is sent. Turn on to use the AI coach, food photos, receipts, meal ideas, programme generation and workout reviews."}{" "}
                  Turning it off stops AI requests straight away. See the privacy policy for how the provider handles data already sent.
                </Text>
              </View>
              <Switch
                value={aiConsent.data?.granted ?? false}
                onValueChange={(v) => setAiConsent.mutate(v)}
                disabled={aiConsent.isLoading || setAiConsent.isPending}
                trackColor={{ false: Color.surface3, true: Color.success }}
                thumbColor="#ffffff"
                accessibilityLabel="AI features"
              />
            </View>
            {setAiConsent.isError ? <Text style={styles.rowSub}>Couldn&apos;t save that. Check your connection and try again.</Text> : null}
          </Card>

          <SectionLabel>Community</SectionLabel>
          <Card style={styles.settingsCard}>
            <Row
              icon="people-outline"
              title="Community privacy"
              sub="Who can find you, leaderboards, and your display name"
              onPress={() => router.push("/community-privacy")}
            />
          </Card>

          <SectionLabel>Nutrition</SectionLabel>
          <Card style={styles.settingsCard}>
            <Row
              icon="flame-outline"
              title="Calorie targets"
              sub="Weekly pace, activity, and same-every-day or match-my-training"
              onPress={() => router.push("/nutrition-targets")}
            />
          </Card>

          {canChooseTabs(tier) ? (
            <>
              <SectionLabel>Tab bar</SectionLabel>
              <Card style={styles.settingsCard}>
                <Text style={styles.tabBarIntro}>Pick the two tabs either side of the + button. You can also long-press one of them to swap it.</Text>
                {TAB_PAIR_OPTIONS.map((opt) => {
                  const active = tabChoice[0] === opt.value[0] && tabChoice[1] === opt.value[1];
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => {
                        if (active) return;
                        tapFeedback();
                        setTabChoice(opt.value);
                      }}
                      style={styles.tabBarRow}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.rowTitle}>{opt.label}</Text>
                      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={22} color={active ? Color.textPrimary : Color.textFaint} />
                    </Pressable>
                  );
                })}
              </Card>
            </>
          ) : null}

          {canUseGymProfiles ? (
            <>
              <SectionLabel>Training</SectionLabel>
              <Card style={styles.settingsCard}>
                <Row
                  icon="barbell-outline"
                  title="Gym profiles"
                  sub="Equipment available — filters the exercise library"
                  onPress={() => router.push("/gym-profiles")}
                />
              </Card>
            </>
          ) : null}

          <SectionLabel>Preferences</SectionLabel>
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
            <View style={styles.divider} />
            <WaterAmountRow />
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="phone-portrait-outline" size={16} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Vibration</Text>
                <Text style={styles.rowSub}>A light tap when you press buttons, log sets and hit PBs</Text>
              </View>
              <Switch
                value={haptics}
                onValueChange={(v) => {
                  setHaptics(v);
                  setHapticsEnabled(v);
                  if (v) tapFeedback();
                }}
                trackColor={{ false: Color.surface3, true: Color.success }}
                thumbColor="#ffffff"
                accessibilityLabel="Vibration"
              />
            </View>
            {LIGHT_MODE_AVAILABLE ? (
              <>
                <View style={styles.divider} />
                <View style={[styles.row, { flexDirection: "column", alignItems: "stretch" }]}>
                  <Text style={[styles.rowTitle, { marginBottom: Spacing.sm }]}>Appearance</Text>
                  <ThemePicker />
                </View>
              </>
            ) : null}
          </Card>

          <Card style={styles.settingsCard}>
            <Row icon="apps-outline" title="Home screen widgets" sub="Water, nutrition and your next class" onPress={() => router.push("/widgets" as never)} />
          </Card>

          <SectionLabel>Notifications</SectionLabel>
          <Card style={styles.settingsCard}>
            {canUseNotifications ? (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Push notifications</Text>
                    <Text style={styles.rowSub}>Class reminders, coach messages, and offers</Text>
                  </View>
                  <Switch
                    value={data.pushNotificationsEnabled}
                    onValueChange={(v) => setPush.mutate(v)}
                    trackColor={{ false: Color.surface3, true: Color.success }}
                    thumbColor="#ffffff"
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
                    trackColor={{ false: Color.surface3, true: Color.success }}
                    thumbColor="#ffffff"
                  />
                </View>
              </>
            ) : (
              <>
                <UpsellRow icon="notifications-outline" title="Push notifications" />
                <View style={styles.divider} />
                <UpsellRow icon="mail-outline" title="Email notifications" />
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Morning check-in reminder</Text>
                <Text style={styles.rowSub}>
                  {checkinReminder.enabled ? `Every morning at ${formatReminderTime(checkinReminder)}, unless you've already checked in` : "Off"}
                </Text>
              </View>
              <Switch
                value={checkinReminder.enabled}
                onValueChange={(v) => updateCheckinReminder({ ...checkinReminder, enabled: v })}
                trackColor={{ false: Color.surface3, true: Color.success }}
                thumbColor="#ffffff"
                accessibilityLabel="Morning check-in reminder"
              />
            </View>
            {checkinReminder.enabled ? (
              <View style={[styles.row, { paddingTop: 0 }]}>
                <Pressable
                  onPress={() => updateCheckinReminder(shiftReminder(checkinReminder, -REMINDER_STEP_MINS))}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel="15 minutes earlier"
                  hitSlop={8}
                >
                  <Ionicons name="remove" size={16} color={Color.textPrimary} />
                </Pressable>
                <Text style={[styles.rowTitle, { flex: 1, textAlign: "center" }]}>{formatReminderTime(checkinReminder)}</Text>
                <Pressable
                  onPress={() => updateCheckinReminder(shiftReminder(checkinReminder, REMINDER_STEP_MINS))}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel="15 minutes later"
                  hitSlop={8}
                >
                  <Ionicons name="add" size={16} color={Color.textPrimary} />
                </Pressable>
              </View>
            ) : null}
            {isBatteryOptimizationRelevant() ? (
              <>
                <View style={styles.divider} />
                <Pressable style={styles.row} onPress={() => openBatteryOptimizationSettings()}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Notification reliability</Text>
                    <Text style={styles.rowSub}>
                      Prevents Android from delaying rest timer and other alerts in the background.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
                </Pressable>
              </>
            ) : null}
          </Card>

          {!canUseNotifications ? (
            <View style={{ marginTop: Spacing.sm }}>
              <UpsellCard icon="alarm-outline" title="Class reminders" body="Get notified before your booked classes" />
            </View>
          ) : (
          <Card style={[styles.settingsCard, { marginTop: Spacing.sm, padding: Spacing.md }]}>
            <Collapsible title="Class reminders" summary={remindersSummary}>
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
            </Collapsible>
          </Card>
          )}

          {user?.role === "member" ? (
            <>
              <SectionLabel>Help</SectionLabel>
              <Card style={styles.settingsCard} tier="quiet">
                <Row
                  icon="compass-outline"
                  title="Take app tour"
                  sub="Revisit the walkthrough for each tab"
                  onPress={restartTour}
                />
              </Card>
            </>
          ) : null}

          {/* Lets a build be identified from a screenshot alone — critical
              when diagnosing "is this actually the build I sent you" during
              a bug report, since Android will happily reinstall over an
              existing app without any visible confirmation of which
              version ended up on the device. Reads the actual installed
              native binary's version/build (nativeApplicationVersion /
              nativeBuildVersion), not a hand-maintained label — the label
              this used to read (app.json's extra.buildLabel) was last
              updated 2026-08-31 and silently went stale for every build
              since, which is exactly the failure this line exists to
              prevent. Both are null in Expo Go (no native binary), hence
              the "dev" fallback. */}
          <Text style={styles.buildInfo}>
            Version {Constants.nativeApplicationVersion ?? "dev"}
            {Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ""}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    centerFill: { flex: 1 },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    sectionLabel: {
      fontSize: 12,
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
    rowSub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    divider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    identityName: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
    identityEmail: { fontSize: 14, color: Color.textMuted, marginTop: 2 },
    avatar: { width: 60, height: 60, borderRadius: Radius.pill },
    avatarPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: Radius.pill,
      backgroundColor: Color.goldWeak,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { fontSize: 22, fontWeight: "700", color: Color.gold },
    avatarActions: { flexDirection: "row", gap: Spacing.md, marginTop: 6 },
    linkText: { fontSize: 14, fontWeight: "600", color: Color.gold },
    linkTextDanger: { fontSize: 14, fontWeight: "600", color: Color.danger },
    error: { fontSize: 13, color: Color.danger, marginTop: 4 },
    unitsToggle: { flexDirection: "row", gap: 6 },
    unitsChip: {
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    unitsChipActive: { borderColor: Color.gold, backgroundColor: Color.gold },
    unitsChipText: { fontSize: 14, fontWeight: "600", color: Color.textMuted },
    unitsChipTextActive: { color: Color.goldForeground },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
    chip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: Radius.pill, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    chipActive: { borderColor: Color.gold, backgroundColor: Color.gold },
    chipText: { fontSize: 13, fontWeight: "500", color: Color.textMuted },
    chipTextActive: { color: Color.goldForeground },
    customRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    customInput: {
      flex: 1,
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: Color.surface2,
      paddingHorizontal: Spacing.sm,
      fontSize: 13,
      color: Color.textPrimary,
    },
    addButton: {
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      justifyContent: "center", backgroundColor: Color.surface2 },
    addButtonText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    reminderActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Spacing.md,
    },
    reminderSaveButton: { height: 36, paddingHorizontal: Spacing.lg },
    saved: { color: Color.success, fontSize: 14 },
    buildInfo: { fontSize: 13, color: Color.textFaint, textAlign: "center", marginTop: Spacing.xl },
    tabBarIntro: { fontSize: 14, lineHeight: 20, color: Color.textMuted, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
    tabBarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: Spacing.md },
  })
);

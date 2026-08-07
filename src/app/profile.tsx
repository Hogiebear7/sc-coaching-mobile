import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError, useAuth } from "@/lib/auth-context";
import {
  useProfile,
  useSetEmailNotifications,
  useSetPushNotifications,
  useUpdateProfile,
  type Gender,
  type PrimaryGoal,
} from "@/lib/queries/profile";

const GENDERS: Gender[] = ["Male", "Female", "Other"];
const GOALS: PrimaryGoal[] = [
  "Weight Loss",
  "Build Muscle",
  "Maintenance",
  "Injury Recovery",
  "Sports Performance",
  "General Health",
  "Improve Fitness",
  "Improve Mobility",
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatWeightKg(kg: number): string {
  if (kg <= 0) return "0 kg";
  return `${Math.round(kg).toLocaleString()} kg`;
}

function formatDistanceKm(km: number): string {
  if (km <= 0) return "0 km";
  return `${km.toFixed(1)} km`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();
  const setPush = useSetPushNotifications();
  const setEmail = useSetEmailNotifications();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [sportPlayed, setSportPlayed] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setFullName(data.fullName);
    setPhone(data.phone);
    setDateOfBirth(data.dateOfBirth ?? "");
    setGender(data.gender);
    setPrimaryGoal(data.primaryGoal);
    setSportPlayed(data.sportPlayed ?? "");
    setAdditionalInfo(data.additionalInfo ?? "");
    setHydrated(true);
  }, [data, hydrated]);

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!fullName.trim() || !phone.trim() || !dateOfBirth.trim()) {
      setError("Please fill in every required field.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      setError("Date of birth must be in YYYY-MM-DD format.");
      return;
    }
    if (!gender) {
      setError("Select a gender.");
      return;
    }
    if (!primaryGoal) {
      setError("Select a primary goal.");
      return;
    }
    if (primaryGoal === "Sports Performance" && !sportPlayed.trim()) {
      setError("Sport played is required for a sports performance goal.");
      return;
    }

    try {
      await update.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth.trim(),
        gender,
        primaryGoal,
        sportPlayed: sportPlayed.trim() || undefined,
        additionalInfo: additionalInfo.trim() || undefined,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>Couldn&apos;t load your profile.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.email}>{data.email}</Text>

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{data.allTimeStats.classesCompleted}</Text>
                <Text style={styles.statLabel}>classes</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{formatWeightKg(data.allTimeStats.totalWeightKg)}</Text>
                <Text style={styles.statLabel}>lifted</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{formatDistanceKm(data.allTimeStats.totalDistanceKm)}</Text>
                <Text style={styles.statLabel}>run</Text>
              </Card>
            </View>

            <Text style={styles.sectionLabel}>YOUR DETAILS</Text>
            <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+353 83 123 4567" />
            <TextField
              label="Date of birth"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>Primary goal</Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => (
                <Chip key={g} label={g} active={primaryGoal === g} onPress={() => setPrimaryGoal(g)} />
              ))}
            </View>

            {primaryGoal === "Sports Performance" ? (
              <TextField
                label="Sport played"
                value={sportPlayed}
                onChangeText={setSportPlayed}
                placeholder="e.g. GAA, Rugby"
                style={{ marginTop: Spacing.md }}
              />
            ) : null}

            <TextField
              label="Anything else your coach should know?"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              placeholder="Injuries, preferences, context…"
              multiline
              style={styles.multiline}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {saved && !error ? <Text style={styles.saved}>Saved.</Text> : null}

            <Button title="Save changes" onPress={handleSave} loading={update.isPending} style={{ marginTop: Spacing.sm }} />

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>NOTIFICATIONS</Text>
            <Card style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Push notifications</Text>
                  <Text style={styles.settingSub}>Class reminders, coach messages, and offers</Text>
                </View>
                <Switch
                  value={data.pushNotificationsEnabled}
                  onValueChange={(v) => setPush.mutate(v)}
                  trackColor={{ false: Color.surface3, true: Color.gold }}
                  thumbColor={Color.textPrimary}
                />
              </View>
              <View style={[styles.settingRow, styles.settingRowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Email notifications</Text>
                  <Text style={styles.settingSub}>Booking confirmations and account updates</Text>
                </View>
                <Switch
                  value={data.emailNotificationsEnabled}
                  onValueChange={(v) => setEmail.mutate(v)}
                  trackColor={{ false: Color.surface3, true: Color.gold }}
                  thumbColor={Color.textPrimary}
                />
              </View>
            </Card>

            <Card style={styles.noteCard}>
              <Text style={styles.noteText}>
                Dietary preferences, allergies, and body-weight logging are managed from the web app for now —
                coming to mobile soon.
              </Text>
            </Card>

            <Button title="Log out" onPress={logout} variant="secondary" style={{ marginTop: Spacing.xl }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  email: { fontSize: 13, color: Color.textMuted, marginBottom: Spacing.md },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: { flex: 1, padding: Spacing.md, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, color: Color.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  sectionLabelSpaced: { marginTop: Spacing.xl },
  label: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  labelSpaced: { marginTop: Spacing.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  chipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  chipText: { fontSize: 12, fontWeight: "500", color: Color.textMuted },
  chipTextActive: { color: Color.gold },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: "top" },
  error: { color: Color.danger, fontSize: 13, marginTop: Spacing.sm },
  saved: { color: Color.success, fontSize: 13, marginTop: Spacing.sm },
  settingsCard: { padding: 0 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm },
  settingRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  settingTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  settingSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  noteCard: { padding: Spacing.md, marginTop: Spacing.lg },
  noteText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
});

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
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError, useAuth } from "@/lib/auth-context";
import { ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES } from "@/lib/dietary-options";
import {
  useProfile,
  useUpdateProfile,
  type DietaryPreference,
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
  const { user, logout, viewMode, setViewMode } = useAuth();
  const isStaffRole = !!user && user.role !== "member";
  const { data, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [sportPlayed, setSportPlayed] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContact2Name, setEmergencyContact2Name] = useState("");
  const [emergencyContact2Phone, setEmergencyContact2Phone] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>("standard");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [intolerancesOrMedical, setIntolerancesOrMedical] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");
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
    setEmergencyContactName(data.emergencyContactName ?? "");
    setEmergencyContactPhone(data.emergencyContactPhone ?? "");
    setEmergencyContact2Name(data.emergencyContact2Name ?? "");
    setEmergencyContact2Phone(data.emergencyContact2Phone ?? "");
    setDietaryPreference(data.dietaryPreference);
    setAllergies(data.allergies);
    setIntolerancesOrMedical(data.intolerancesOrMedical);
    setDietaryNotes(data.dietaryNotes ?? "");
    setHydrated(true);
  }, [data, hydrated]);

  function toggleListValue(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // A coach can deliberately switch into the member tab group (viewMode
  // "member", provisioned a ProfileRecord first — see (staff)/index.tsx),
  // in which case this screen should render normally. Otherwise the route
  // is still reachable directly (URL, stale bookmark, deep link) with no
  // group-level guard, so bounce rather than show a member settings form
  // to a staff account that hasn't opted in.
  const blockedStaffRole = isStaffRole && viewMode === "coach";
  useEffect(() => {
    if (blockedStaffRole) router.replace("/(staff)");
  }, [blockedStaffRole, router]);

  if (blockedStaffRole) return null;

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!fullName.trim() || !phone.trim() || !dateOfBirth.trim()) {
      setError("Please fill in every required field.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      setError("Enter a valid date of birth.");
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
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        emergencyContact2Name: emergencyContact2Name.trim() || undefined,
        emergencyContact2Phone: emergencyContact2Phone.trim() || undefined,
        dietaryPreference,
        allergies,
        intolerancesOrMedical,
        dietaryNotes: dietaryNotes.trim() || undefined,
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
            <DateField
              label="Date of birth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              maxDate={new Date().toISOString().slice(0, 10)}
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

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>IN CASE OF EMERGENCY</Text>
            <TextField
              label="Emergency contact name"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="e.g. Jane Smith"
            />
            <TextField
              label="Emergency contact phone"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              keyboardType="phone-pad"
              placeholder="+353 83 123 4567"
            />
            <TextField
              label="Second emergency contact name — optional"
              value={emergencyContact2Name}
              onChangeText={setEmergencyContact2Name}
              placeholder="e.g. John Smith"
            />
            {emergencyContact2Name.trim() ? (
              <TextField
                label="Second emergency contact phone"
                value={emergencyContact2Phone}
                onChangeText={setEmergencyContact2Phone}
                keyboardType="phone-pad"
                placeholder="+353 83 123 4567"
              />
            ) : null}

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>DIETARY REQUIREMENTS</Text>
            <Card style={styles.dietaryCard}>
              <Text style={styles.dietaryHint}>
                Optional — powers your nutrition suggestions. Change these any time.
              </Text>

              <Text style={styles.label}>Dietary preference</Text>
              <View style={styles.chipRow}>
                {DIETARY_PREFERENCES.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={dietaryPreference === opt.value}
                    onPress={() => setDietaryPreference(opt.value)}
                  />
                ))}
              </View>

              <Text style={[styles.label, styles.labelSpaced]}>Allergies</Text>
              <View style={styles.chipRow}>
                {ALLERGENS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={allergies.includes(opt.value)}
                    onPress={() => toggleListValue(allergies, setAllergies, opt.value)}
                  />
                ))}
              </View>

              <Text style={[styles.label, styles.labelSpaced]}>Intolerances / medical</Text>
              <View style={styles.chipRow}>
                {INTOLERANCES.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={intolerancesOrMedical.includes(opt.value)}
                    onPress={() => toggleListValue(intolerancesOrMedical, setIntolerancesOrMedical, opt.value)}
                  />
                ))}
              </View>

              <TextField
                label="Additional notes — diet or medical — optional"
                value={dietaryNotes}
                onChangeText={setDietaryNotes}
                placeholder="Anything else about your diet, or any other medical issues we should know about"
                multiline
                style={[styles.multiline, { marginTop: Spacing.md }]}
              />
            </Card>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {saved && !error ? <Text style={styles.saved}>Saved.</Text> : null}

            <Button title="Save changes" onPress={handleSave} loading={update.isPending} style={{ marginTop: Spacing.sm }} />

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>MORE</Text>
            <Pressable onPress={() => router.push("/settings")} style={styles.cycleRow}>
              <View style={styles.cycleRowIcon}>
                <Ionicons name="settings-outline" size={18} color={Color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Settings</Text>
                <Text style={styles.settingSub}>Account, membership, notifications, and appearance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
            </Pressable>

            {data.cycleTrackingEligible ? (
              <Pressable onPress={() => router.push("/cycle-tracking")} style={[styles.cycleRow, { marginTop: Spacing.sm }]}>
                <View style={styles.cycleRowIcon}>
                  <Ionicons name="moon-outline" size={18} color={Color.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Cycle Tracking</Text>
                  <Text style={styles.settingSub}>Private cycle info, phase estimate, and coach sharing</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
              </Pressable>
            ) : null}

            {isStaffRole ? (
              <Button
                title="Switch to coach view"
                onPress={() => setViewMode("coach")}
                variant="secondary"
                style={{ marginTop: Spacing.xl }}
              />
            ) : null}
            <Button title="Log out" onPress={logout} variant="secondary" style={{ marginTop: isStaffRole ? Spacing.sm : Spacing.xl }} />
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
  cycleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  cycleRowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  settingSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  dietaryCard: { padding: Spacing.md },
  dietaryHint: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md },
});

import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageStyle } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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

import { BodyFatCard } from "@/components/ui/BodyFatCard";
import { BodyWeightCard } from "@/components/ui/BodyWeightCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { CyclePhaseChart } from "@/components/ui/CyclePhaseChart";
import { DateField } from "@/components/ui/DateField";
import { GoalTimelineCard } from "@/components/ui/GoalTimelineCard";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError, useAuth } from "@/lib/auth-context";
import { useCycleData } from "@/lib/queries/cycle";
import { COUNTRIES } from "@/lib/country-options";
import { ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES, optionLabel } from "@/lib/dietary-options";
import {
  useProfile,
  useRequestEmailChange,
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

function Chip({
  label,
  active,
  onPress,
  variant = "primary",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  const activeStyle = variant === "secondary" ? styles.chipActiveSecondary : styles.chipActive;
  const activeTextStyle = variant === "secondary" ? styles.chipTextActiveSecondary : styles.chipTextActive;
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && activeStyle]}>
      <Text style={[styles.chipText, active && activeTextStyle]}>{label}</Text>
    </Pressable>
  );
}

function truncateSummary(value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "Not set";
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

function CollapsibleSection({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.collapsibleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{title}</Text>
          {!open ? <Text style={styles.collapsibleSummary}>{summary}</Text> : null}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Color.textFaint} />
      </Pressable>
      {open ? <View style={{ marginTop: Spacing.sm }}>{children}</View> : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
  const { data: cycleData } = useCycleData(!!data?.cycleTrackingEligible);
  const requestEmailChange = useRequestEmailChange();

  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailChangeMessage, setEmailChangeMessage] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);

  async function handleRequestEmailChange() {
    setEmailChangeError(null);
    try {
      const res = await requestEmailChange.mutateAsync(newEmailInput.trim());
      setEmailChangeMessage(res.message);
      setNewEmailInput("");
      setIsChangingEmail(false);
    } catch (e) {
      setEmailChangeError(e instanceof ApiError ? e.message : "Could not send confirmation email. Try again.");
    }
  }

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [secondaryGoal, setSecondaryGoal] = useState<PrimaryGoal | null>(null);
  const [sportPlayed, setSportPlayed] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [country, setCountry] = useState("");
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [emergencyExpanded, setEmergencyExpanded] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setFullName(data.fullName);
    setPhone(data.phone);
    setDateOfBirth(data.dateOfBirth ?? "");
    setGender(data.gender);
    setPrimaryGoal(data.primaryGoal);
    setSecondaryGoal(data.secondaryGoal ?? null);
    setSportPlayed(data.sportPlayed ?? "");
    setHeightCm(data.heightCm !== null ? String(data.heightCm) : "");
    setCountry(data.country ?? "");
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
        // Always sent (even "") so clearing it back to "not set" actually
        // clears a previously-set value — same reasoning as country below.
        secondaryGoal: secondaryGoal ?? "",
        sportPlayed: sportPlayed.trim() || undefined,
        heightCm: heightCm.trim() || undefined,
        // Always sent (even "") so picking "Not set" actually clears a
        // previously-set country — unlike the optional-omit fields above,
        // this app always renders the picker, so there's no "older client
        // that's never heard of this field" case to protect with omission.
        country,
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
                {emailChangeMessage ? (
                  <Text style={styles.savedInline}>{emailChangeMessage}</Text>
                ) : !isChangingEmail ? (
                  <Pressable onPress={() => setIsChangingEmail(true)} hitSlop={6}>
                    <Text style={styles.changeEmailLink}>Change email</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {!emailChangeMessage && isChangingEmail ? (
              <View style={styles.changeEmailForm}>
                <TextField
                  label="New email address"
                  value={newEmailInput}
                  onChangeText={setNewEmailInput}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailChangeError ? <Text style={styles.errorInline}>{emailChangeError}</Text> : null}
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
                  <Button
                    title={requestEmailChange.isPending ? "Sending…" : "Send confirmation link"}
                    onPress={handleRequestEmailChange}
                    loading={requestEmailChange.isPending}
                    variant="secondary"
                  />
                  <Pressable
                    onPress={() => {
                      setIsChangingEmail(false);
                      setEmailChangeError(null);
                      setNewEmailInput("");
                    }}
                    style={{ justifyContent: "center", paddingHorizontal: Spacing.sm }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

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

            <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
            <Card style={styles.detailsCard}>
              {!detailsExpanded ? (
                <>
                  <SummaryRow label="Phone" value={phone || "Not set"} />
                  <SummaryRow label="Date of birth" value={dateOfBirth || "Not set"} />
                  <SummaryRow label="Height" value={heightCm ? `${heightCm} cm` : "Not set"} />
                  <SummaryRow label="Country" value={country ? optionLabel(COUNTRIES, country) : "Not set"} />
                  <SummaryRow label="Gender" value={gender ?? "Not set"} />
                  <Pressable onPress={() => setDetailsExpanded(true)} style={styles.editRow}>
                    <Ionicons name="create-outline" size={14} color={Color.gold} />
                    <Text style={styles.editRowText}>Edit details</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
                  <TextField
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+353 83 123 4567"
                    style={{ marginTop: Spacing.md }}
                  />
                  <DateField
                    label="Date of birth"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    maxDate={new Date().toISOString().slice(0, 10)}
                  />
                  <TextField
                    label="Height (cm) — optional"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 178"
                    style={{ marginTop: Spacing.md }}
                  />

                  <Text style={[styles.label, styles.labelSpaced]}>
                    Country — optional, improves food search results
                  </Text>
                  <CountryPicker value={country} onChange={setCountry} />

                  <Text style={[styles.label, styles.labelSpaced]}>Gender</Text>
                  <View style={styles.chipRow}>
                    {GENDERS.map((g) => (
                      <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />
                    ))}
                  </View>

                  <Pressable onPress={() => setDetailsExpanded(false)} style={styles.doneRow}>
                    <Text style={styles.doneRowText}>Done editing</Text>
                  </Pressable>
                </>
              )}
            </Card>

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>COACHING GOALS</Text>
            <Card style={styles.detailsCard}>
              <Text style={styles.label}>Primary goal</Text>
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

              <View style={styles.labelSpaced}>
                <CollapsibleSection title="Secondary goal (optional)" summary={secondaryGoal ?? "Not set"}>
                  <View style={styles.chipRow}>
                    {GOALS.map((g) => (
                      <Chip
                        key={g}
                        label={g}
                        active={secondaryGoal === g}
                        onPress={() => setSecondaryGoal(secondaryGoal === g ? null : g)}
                        variant="secondary"
                      />
                    ))}
                  </View>
                </CollapsibleSection>
              </View>

              <View style={styles.labelSpaced}>
                <CollapsibleSection title="Notes for your coach (optional)" summary={truncateSummary(additionalInfo, 40)}>
                  <TextField
                    label="Anything else your coach should know?"
                    value={additionalInfo}
                    onChangeText={setAdditionalInfo}
                    placeholder="Injuries, preferences, context…"
                    multiline
                    style={styles.multiline}
                  />
                </CollapsibleSection>
              </View>
            </Card>

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>DIETARY REQUIREMENTS</Text>
            <Card style={styles.dietaryCard}>
              <Text style={styles.dietaryHint}>
                Optional — powers your nutrition suggestions. Change these any time.
              </Text>

              <CollapsibleSection
                title="Dietary preference"
                summary={optionLabel(DIETARY_PREFERENCES, dietaryPreference)}
              >
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
              </CollapsibleSection>

              <View style={styles.labelSpaced}>
                <CollapsibleSection
                  title="Allergies"
                  summary={allergies.length ? allergies.map((v) => optionLabel(ALLERGENS, v)).join(", ") : "None selected"}
                >
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
                </CollapsibleSection>
              </View>

              <View style={styles.labelSpaced}>
                <CollapsibleSection
                  title="Intolerances / medical"
                  summary={
                    intolerancesOrMedical.length
                      ? intolerancesOrMedical.map((v) => optionLabel(INTOLERANCES, v)).join(", ")
                      : "None selected"
                  }
                >
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
                </CollapsibleSection>
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

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>EMERGENCY CONTACT</Text>
            <Card style={styles.detailsCard}>
              {!emergencyExpanded ? (
                <>
                  <SummaryRow
                    label="Primary contact"
                    value={
                      emergencyContactName
                        ? `${emergencyContactName}${emergencyContactPhone ? " · " + emergencyContactPhone : ""}`
                        : "Not set"
                    }
                  />
                  {emergencyContact2Name ? (
                    <SummaryRow
                      label="Second contact"
                      value={`${emergencyContact2Name}${emergencyContact2Phone ? " · " + emergencyContact2Phone : ""}`}
                    />
                  ) : null}
                  <Pressable onPress={() => setEmergencyExpanded(true)} style={styles.editRow}>
                    <Ionicons name="create-outline" size={14} color={Color.gold} />
                    <Text style={styles.editRowText}>
                      {emergencyContactName ? "Edit emergency contact" : "Add emergency contact"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
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
                    style={{ marginTop: Spacing.md }}
                  />
                  <TextField
                    label="Second emergency contact name — optional"
                    value={emergencyContact2Name}
                    onChangeText={setEmergencyContact2Name}
                    placeholder="e.g. John Smith"
                    style={{ marginTop: Spacing.md }}
                  />
                  {emergencyContact2Name.trim() ? (
                    <TextField
                      label="Second emergency contact phone"
                      value={emergencyContact2Phone}
                      onChangeText={setEmergencyContact2Phone}
                      keyboardType="phone-pad"
                      placeholder="+353 83 123 4567"
                      style={{ marginTop: Spacing.md }}
                    />
                  ) : null}

                  <Pressable onPress={() => setEmergencyExpanded(false)} style={styles.doneRow}>
                    <Text style={styles.doneRowText}>Done editing</Text>
                  </Pressable>
                </>
              )}
            </Card>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {saved && !error ? <Text style={styles.saved}>Saved.</Text> : null}

            <Button title="Save changes" onPress={handleSave} loading={update.isPending} style={{ marginTop: Spacing.md }} />

            {/* Closes off the editable form before the quieter reference
                section below, rather than letting Body Metrics run straight
                on from Save with only a section-label's worth of spacing. */}
            <View style={styles.closingDivider} />

            <Text style={styles.sectionLabel}>BODY METRICS</Text>
            <Text style={styles.label}>Body weight</Text>
            <BodyWeightCard />

            <Text style={[styles.label, styles.labelSpaced]}>Body fat %</Text>
            <BodyFatCard />

            <Text style={[styles.label, styles.labelSpaced]}>Goal timeline</Text>
            <GoalTimelineCard />

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>ACCOUNT</Text>
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
              <>
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

                {cycleData?.enabled &&
                cycleData.phaseEstimate.phase !== "Unknown" &&
                cycleData.phaseEstimate.cycleDay !== null &&
                cycleData.phaseEstimate.cycleLength !== null ? (
                  <Pressable onPress={() => router.push("/cycle-tracking")} style={styles.phasePreview}>
                    <Text style={styles.phasePreviewLabel}>
                      Estimated phase: {cycleData.phaseEstimate.phaseLabel} — day {cycleData.phaseEstimate.cycleDay} of{" "}
                      {cycleData.phaseEstimate.cycleLength}
                    </Text>
                    <CyclePhaseChart
                      cycleDay={cycleData.phaseEstimate.cycleDay}
                      cycleLength={cycleData.phaseEstimate.cycleLength}
                      periodLengthDays={cycleData.settings?.periodLengthDays ?? null}
                      currentPhase={cycleData.phaseEstimate.phase}
                    />
                  </Pressable>
                ) : null}
              </>
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: Radius.pill },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    backgroundColor: Color.goldWeak,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "700", color: Color.gold },
  identityName: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  identityEmail: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  changeEmailForm: { marginTop: -Spacing.sm, marginBottom: Spacing.lg },
  changeEmailLink: { fontSize: 12, fontWeight: "600", color: Color.gold, marginTop: 4 },
  cancelText: { fontSize: 13, color: Color.textMuted },
  errorInline: { color: Color.danger, fontSize: 12, marginTop: 6 },
  savedInline: { color: Color.success, fontSize: 12, marginTop: 2 },
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
  // Same light-blue "secondary selection" language as the secondary
  // muscle-group picker in workout-generator.tsx — reused here so Secondary
  // goal reads as a distinct, lower-emphasis choice from Primary's gold.
  chipActiveSecondary: { borderColor: Color.accentData, backgroundColor: "rgba(85,196,254,0.12)" },
  chipTextActiveSecondary: { color: Color.accentData },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: "top" },
  error: { color: Color.danger, fontSize: 13, marginTop: Spacing.sm },
  saved: { color: Color.success, fontSize: 13, marginTop: Spacing.sm },
  closingDivider: { height: 1, backgroundColor: Color.borderSubtle, marginTop: Spacing.xl, marginBottom: Spacing.lg },
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
  phasePreview: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  phasePreviewLabel: { fontSize: 12, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
  dietaryCard: { padding: Spacing.md },
  dietaryHint: { fontSize: 12, color: Color.textMuted, marginBottom: Spacing.md },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  collapsibleSummary: { fontSize: 12, color: Color.textMuted, marginTop: 2 },
  detailsCard: { padding: Spacing.md },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    gap: Spacing.md,
  },
  summaryLabel: { fontSize: 12, color: Color.textMuted },
  summaryValue: { fontSize: 13, fontWeight: "500", color: Color.textPrimary, flexShrink: 1, textAlign: "right" },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  editRowText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  doneRow: { alignItems: "center", marginTop: Spacing.md, paddingVertical: 6 },
  doneRowText: { fontSize: 12, fontWeight: "600", color: Color.textMuted },
});

import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField, formatDateDisplay } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { API_BASE_URL } from "@/constants/config";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError, useAuth, type AuthUser } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES, optionLabel } from "@/lib/dietary-options";
import { setToken as persistToken } from "@/lib/token-store";

// Mirrors the web signup wizard (app/(auth)/signup/page.tsx in the main
// repo) field-for-field, including dietary requirements and cycle tracking
// — the only deliberate gap is the theme/palette picker, since mobile has
// one fixed navy/gold design rather than the web's cosmetic presets.
const GENDERS = ["Male", "Female", "Other"] as const;
const GOALS = [
  "Weight Loss",
  "Build Muscle",
  "Maintenance",
  "Injury Recovery",
  "Sports Performance",
  "General Health",
  "Improve Fitness",
  "Improve Mobility",
] as const;
const REGULARITY_OPTIONS = ["Regular", "Irregular", "Unsure"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const CYCLE_TRACKING_BENEFIT_COPY =
  "Track patterns, symptoms, and phases to support training, recovery, and coach guidance.";
const ADDITIONAL_INFO_PLACEHOLDER = "Any other info, injuries, preferences, or context we should know";
const DIETARY_NOTES_PLACEHOLDER = "Anything else about your diet, or any other medical issues we should know about";
const PASSWORD_REQUIREMENTS_HINT =
  "Must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.";

type Gender = (typeof GENDERS)[number];
type PrimaryGoal = (typeof GOALS)[number];
type Regularity = (typeof REGULARITY_OPTIONS)[number];

interface FormValues {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | null;
  primaryGoal: PrimaryGoal | null;
  sportPlayed: string;
  currentWeightKg: string;
  additionalInfo: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContact2Name: string;
  emergencyContact2Phone: string;
  dietaryPreference: string;
  allergies: string[];
  intolerancesOrMedical: string[];
  dietaryNotes: string;
  cycleTrackingEnabled: boolean;
  menopauseSupportEnabled: boolean;
  lastPeriodStartDate: string;
  averageCycleLengthDays: string;
  periodLengthDays: string;
  regularity: Regularity | null;
  privateNotes: string;
  shareCurrentPhaseWithCoach: boolean;
  shareExactDatesWithCoach: boolean;
  shareNotesWithCoach: boolean;
}

const INITIAL_VALUES: FormValues = {
  email: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  phone: "",
  dateOfBirth: "",
  gender: null,
  primaryGoal: null,
  sportPlayed: "",
  currentWeightKg: "",
  additionalInfo: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContact2Name: "",
  emergencyContact2Phone: "",
  dietaryPreference: "standard",
  allergies: [],
  intolerancesOrMedical: [],
  dietaryNotes: "",
  cycleTrackingEnabled: false,
  menopauseSupportEnabled: false,
  lastPeriodStartDate: "",
  averageCycleLengthDays: "",
  periodLengthDays: "",
  regularity: null,
  privateNotes: "",
  shareCurrentPhaseWithCoach: false,
  shareExactDatesWithCoach: false,
  shareNotesWithCoach: false,
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

interface SignupResponse {
  success: true;
  token: string;
  user: AuthUser;
}

function getPasswordStrengthError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character.";
  return null;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CheckboxRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={20}
        color={checked ? Color.gold : Color.textFaint}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        <Text style={styles.checkboxDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

export default function SignupScreen() {
  const { setSession } = useAuth();
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    const email = values.email.trim();
    if (!EMAIL_RE.test(email)) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    let cancelled = false;
    const timer = setTimeout(() => {
      apiFetch<{ available?: boolean }>(`/api/auth/check-email?email=${encodeURIComponent(email)}`, {
        skipAuth: true,
      })
        .then((data) => {
          if (!cancelled) setEmailStatus(data.available === false ? "taken" : "available");
        })
        .catch(() => {
          if (!cancelled) setEmailStatus("idle");
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values.email]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const sportVisible = values.primaryGoal === "Sports Performance";
  const cycleEligible = values.gender === "Female";
  const cycleFieldsVisible = cycleEligible && values.cycleTrackingEnabled;

  const stepTitles = useMemo(() => {
    const titles = ["Account", "Basic profile", "Goals & context"];
    if (cycleEligible) titles.push("Cycle tracking");
    titles.push("Review");
    return titles;
  }, [cycleEligible]);

  const totalSteps = stepTitles.length;
  const isAccountStep = step === 0;
  const isBasicProfileStep = step === 1;
  const isGoalsStep = step === 2;
  const isCycleStep = cycleEligible && step === 3;
  const isReviewStep = cycleEligible ? step === 4 : step === 3;

  useEffect(() => {
    if (step > totalSteps - 1) setStep(totalSteps - 1);
  }, [step, totalSteps]);

  function validateStep(currentStep: number): boolean {
    const next: FormErrors = {};

    if (currentStep === 0) {
      if (!values.email.trim()) next.email = "Email is required.";
      else if (!EMAIL_RE.test(values.email.trim())) next.email = "Enter a valid email address.";
      else if (emailStatus === "taken") next.email = "This email already has an account.";

      if (!values.password.trim()) next.password = "Password is required.";
      else {
        const err = getPasswordStrengthError(values.password);
        if (err) next.password = err;
      }

      if (!values.confirmPassword.trim()) next.confirmPassword = "Please confirm your password.";
      else if (values.password !== values.confirmPassword) next.confirmPassword = "Passwords do not match.";
    }

    if (currentStep === 1) {
      if (!values.fullName.trim()) next.fullName = "Full name is required.";
      if (!values.phone.trim()) next.phone = "Phone number is required.";

      const dob = values.dateOfBirth.trim();
      const todayISO = new Date().toISOString().slice(0, 10);
      if (!dob) next.dateOfBirth = "Date of birth is required.";
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(dob).getTime()) || dob >= todayISO) {
        next.dateOfBirth = "Enter a valid date of birth.";
      }

      if (!values.gender) next.gender = "Please select a gender.";

      if (!values.emergencyContactName.trim()) next.emergencyContactName = "Emergency contact name is required.";
      if (!values.emergencyContactPhone.trim()) next.emergencyContactPhone = "Emergency contact phone number is required.";
      if (values.emergencyContact2Name.trim() && !values.emergencyContact2Phone.trim()) {
        next.emergencyContact2Phone = "Enter a phone number for the second contact, or clear their name.";
      }
    }

    if (currentStep === 2) {
      if (!values.primaryGoal) next.primaryGoal = "Please select a primary goal.";
      if (sportVisible && !values.sportPlayed.trim()) next.sportPlayed = "Please enter the sport played.";
    }

    if (cycleEligible && currentStep === 3 && values.cycleTrackingEnabled) {
      if (!values.lastPeriodStartDate.trim()) next.lastPeriodStartDate = "Please enter the last period start date.";
      if (!values.averageCycleLengthDays.trim()) next.averageCycleLengthDays = "Please enter the average cycle length.";
      if (!values.periodLengthDays.trim()) next.periodLengthDays = "Please enter the period length.";
      if (!values.regularity) next.regularity = "Please select cycle regularity.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleSubmit() {
    if (!validateStep(step)) return;
    if (!agreedToTerms || !agreedToPrivacy) {
      setFormError("Please agree to the Terms and Conditions and Privacy Policy to continue.");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<SignupResponse>("/api/mobile/auth/signup", {
        method: "POST",
        skipAuth: true,
        body: {
          email: values.email.trim(),
          password: values.password,
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          dateOfBirth: values.dateOfBirth.trim(),
          gender: values.gender,
          primaryGoal: values.primaryGoal,
          sportPlayed: values.sportPlayed.trim() || undefined,
          currentWeightKg: values.currentWeightKg.trim() || undefined,
          additionalInfo: values.additionalInfo.trim() || undefined,
          emergencyContactName: values.emergencyContactName.trim(),
          emergencyContactPhone: values.emergencyContactPhone.trim(),
          emergencyContact2Name: values.emergencyContact2Name.trim() || undefined,
          emergencyContact2Phone: values.emergencyContact2Phone.trim() || undefined,
          dietaryPreference: values.dietaryPreference,
          allergies: values.allergies,
          intolerancesOrMedical: values.intolerancesOrMedical,
          dietaryNotes: values.dietaryNotes.trim() || undefined,
          cycleTrackingEnabled: values.cycleTrackingEnabled,
          menopauseSupportEnabled: values.menopauseSupportEnabled,
          lastPeriodStartDate: values.lastPeriodStartDate.trim() || undefined,
          averageCycleLengthDays: values.averageCycleLengthDays.trim() || undefined,
          periodLengthDays: values.periodLengthDays.trim() || undefined,
          regularity: values.regularity ?? undefined,
          privateNotes: values.privateNotes.trim() || undefined,
          shareCurrentPhaseWithCoach: values.shareCurrentPhaseWithCoach,
          shareExactDatesWithCoach: values.shareExactDatesWithCoach,
          shareNotesWithCoach: values.shareNotesWithCoach,
        },
      });
      await persistToken(res.token);
      await setSession(res.token, res.user);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleListValue(key: "allergies" | "intolerancesOrMedical", value: string) {
    const list = values[key];
    update(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BrandMark height={28} style={styles.logo} />
          <Text style={styles.eyebrow}>CREATE YOUR ACCOUNT</Text>
          <Text style={styles.title}>Join the floor</Text>
          <Text style={styles.stepIndicator}>
            Step {step + 1} of {totalSteps} · {stepTitles[step]}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
          </View>

          <View style={styles.form}>
            {isAccountStep ? (
              <>
                <TextField
                  label="Email"
                  value={values.email}
                  onChangeText={(v) => update("email", v)}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  error={emailStatus === "taken" ? undefined : errors.email}
                />
                {emailStatus === "taken" ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnText}>This email already has an account.</Text>
                    <Link href="/(auth)/login" style={styles.warnLink}>
                      Log in instead
                    </Link>
                  </View>
                ) : null}

                <TextField
                  label="Password"
                  value={values.password}
                  onChangeText={(v) => update("password", v)}
                  secureTextEntry
                  placeholder="Create a password"
                  error={errors.password}
                />
                <Text style={styles.hint}>{PASSWORD_REQUIREMENTS_HINT}</Text>

                <TextField
                  label="Confirm password"
                  value={values.confirmPassword}
                  onChangeText={(v) => update("confirmPassword", v)}
                  secureTextEntry
                  placeholder="Re-enter your password"
                  error={errors.confirmPassword}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : null}

            {isBasicProfileStep ? (
              <>
                <TextField
                  label="Full name"
                  value={values.fullName}
                  onChangeText={(v) => update("fullName", v)}
                  placeholder="Your full name"
                  error={errors.fullName}
                />
                <TextField
                  label="Phone"
                  value={values.phone}
                  onChangeText={(v) => update("phone", v)}
                  keyboardType="phone-pad"
                  placeholder="+353 83 123 4567"
                  error={errors.phone}
                />
                <DateField
                  label="Date of birth"
                  value={values.dateOfBirth}
                  onChange={(v) => update("dateOfBirth", v)}
                  maxDate={TODAY_ISO}
                  error={errors.dateOfBirth}
                />

                <Text style={styles.label}>Gender</Text>
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <Chip key={g} label={g} active={values.gender === g} onPress={() => update("gender", g)} />
                  ))}
                </View>
                {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}

                <Text style={[styles.label, { marginTop: Spacing.lg }]}>In case of emergency</Text>
                <Text style={styles.hint}>Who should we contact if something happens to you during a session?</Text>

                <TextField
                  label="Emergency contact name"
                  value={values.emergencyContactName}
                  onChangeText={(v) => update("emergencyContactName", v)}
                  placeholder="e.g. Jane Smith"
                  error={errors.emergencyContactName}
                  style={{ marginTop: Spacing.sm }}
                />
                <TextField
                  label="Emergency contact phone"
                  value={values.emergencyContactPhone}
                  onChangeText={(v) => update("emergencyContactPhone", v)}
                  keyboardType="phone-pad"
                  placeholder="+353 83 123 4567"
                  error={errors.emergencyContactPhone}
                />
                <TextField
                  label="Second emergency contact name — optional"
                  value={values.emergencyContact2Name}
                  onChangeText={(v) => update("emergencyContact2Name", v)}
                  placeholder="e.g. John Smith"
                  error={errors.emergencyContact2Name}
                />
                {values.emergencyContact2Name.trim() ? (
                  <TextField
                    label="Second emergency contact phone"
                    value={values.emergencyContact2Phone}
                    onChangeText={(v) => update("emergencyContact2Phone", v)}
                    keyboardType="phone-pad"
                    placeholder="+353 83 123 4567"
                    error={errors.emergencyContact2Phone}
                  />
                ) : null}
              </>
            ) : null}

            {isGoalsStep ? (
              <>
                <Text style={styles.label}>Primary goal</Text>
                <View style={styles.chipRow}>
                  {GOALS.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      active={values.primaryGoal === g}
                      onPress={() => update("primaryGoal", g)}
                    />
                  ))}
                </View>
                {errors.primaryGoal ? <Text style={styles.error}>{errors.primaryGoal}</Text> : null}

                {sportVisible ? (
                  <TextField
                    label="Sport played"
                    value={values.sportPlayed}
                    onChangeText={(v) => update("sportPlayed", v)}
                    placeholder="e.g. GAA, Rugby"
                    error={errors.sportPlayed}
                    style={{ marginTop: Spacing.md }}
                  />
                ) : null}

                <TextField
                  label="Current weight (kg) — optional"
                  value={values.currentWeightKg}
                  onChangeText={(v) => update("currentWeightKg", v)}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 72"
                  style={{ marginTop: Spacing.md }}
                />

                <TextField
                  label="Additional information — optional"
                  value={values.additionalInfo}
                  onChangeText={(v) => update("additionalInfo", v)}
                  placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                  multiline
                  style={styles.multiline}
                />

                <Card style={styles.dietaryCard}>
                  <Text style={styles.dietaryTitle}>Dietary requirements</Text>
                  <Text style={styles.dietaryHint}>
                    Optional — powers your nutrition suggestions. You can change these any time.
                  </Text>

                  <Text style={styles.label}>Dietary preference</Text>
                  <View style={styles.chipRow}>
                    {DIETARY_PREFERENCES.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        active={values.dietaryPreference === opt.value}
                        onPress={() => update("dietaryPreference", opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Allergies</Text>
                  <Text style={styles.chipHint}>We&apos;ll never suggest foods containing these.</Text>
                  <View style={styles.chipRow}>
                    {ALLERGENS.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        active={values.allergies.includes(opt.value)}
                        onPress={() => toggleListValue("allergies", opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Intolerances / medical</Text>
                  <Text style={styles.chipHint}>Also excluded from food suggestions.</Text>
                  <View style={styles.chipRow}>
                    {INTOLERANCES.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        active={values.intolerancesOrMedical.includes(opt.value)}
                        onPress={() => toggleListValue("intolerancesOrMedical", opt.value)}
                      />
                    ))}
                  </View>

                  <TextField
                    label="Additional notes — diet or medical — optional"
                    value={values.dietaryNotes}
                    onChangeText={(v) => update("dietaryNotes", v)}
                    placeholder={DIETARY_NOTES_PLACEHOLDER}
                    multiline
                    style={[styles.multiline, { marginTop: Spacing.md }]}
                  />
                </Card>
              </>
            ) : null}

            {isCycleStep ? (
              <>
                <Text style={styles.introText}>
                  Both options below are independent — enable either, both, or neither. All information is
                  private to you unless you choose to share it.
                </Text>

                <CheckboxRow
                  label="Enable cycle tracking"
                  description={CYCLE_TRACKING_BENEFIT_COPY}
                  checked={values.cycleTrackingEnabled}
                  onToggle={() => update("cycleTrackingEnabled", !values.cycleTrackingEnabled)}
                />
                <CheckboxRow
                  label="Receive menopause support information"
                  description="Educational content on strength training, nutrition, and recovery relevant to perimenopause and post-menopause. Visible only to you."
                  checked={values.menopauseSupportEnabled}
                  onToggle={() => update("menopauseSupportEnabled", !values.menopauseSupportEnabled)}
                />

                {cycleFieldsVisible ? (
                  <Card style={styles.dietaryCard}>
                    <DateField
                      label="Last period start date"
                      value={values.lastPeriodStartDate}
                      onChange={(v) => update("lastPeriodStartDate", v)}
                      maxDate={TODAY_ISO}
                      error={errors.lastPeriodStartDate}
                    />
                    <TextField
                      label="Average cycle length (days)"
                      value={values.averageCycleLengthDays}
                      onChangeText={(v) => update("averageCycleLengthDays", v)}
                      keyboardType="number-pad"
                      placeholder="e.g. 28"
                      error={errors.averageCycleLengthDays}
                    />
                    <TextField
                      label="Period length (days)"
                      value={values.periodLengthDays}
                      onChangeText={(v) => update("periodLengthDays", v)}
                      keyboardType="number-pad"
                      placeholder="e.g. 5"
                      error={errors.periodLengthDays}
                    />

                    <Text style={styles.label}>Regularity</Text>
                    <View style={styles.chipRow}>
                      {REGULARITY_OPTIONS.map((opt) => (
                        <Chip
                          key={opt}
                          label={opt}
                          active={values.regularity === opt}
                          onPress={() => update("regularity", opt)}
                        />
                      ))}
                    </View>
                    {errors.regularity ? <Text style={styles.error}>{errors.regularity}</Text> : null}

                    <TextField
                      label="Private notes"
                      value={values.privateNotes}
                      onChangeText={(v) => update("privateNotes", v)}
                      placeholder="Symptoms, preferences, or other private notes"
                      multiline
                      style={[styles.multiline, { marginTop: Spacing.md }]}
                    />

                    <Text style={[styles.label, styles.labelSpaced]}>Coach sharing preferences</Text>
                    <View style={styles.shareWrap}>
                      <CheckboxRow
                        label="Share current phase with coach"
                        description="Your coach will see an estimated cycle day, not exact dates."
                        checked={values.shareCurrentPhaseWithCoach}
                        onToggle={() => update("shareCurrentPhaseWithCoach", !values.shareCurrentPhaseWithCoach)}
                      />
                      <CheckboxRow
                        label="Share exact dates with coach"
                        description="Your coach will see the date you entered for your last period start."
                        checked={values.shareExactDatesWithCoach}
                        onToggle={() => update("shareExactDatesWithCoach", !values.shareExactDatesWithCoach)}
                      />
                      <CheckboxRow
                        label="Share notes with coach"
                        description="Your coach will see the private notes you entered above."
                        checked={values.shareNotesWithCoach}
                        onToggle={() => update("shareNotesWithCoach", !values.shareNotesWithCoach)}
                      />
                    </View>
                  </Card>
                ) : null}
              </>
            ) : null}

            {isReviewStep ? (
              <>
                {formError ? <Text style={[styles.error, { marginBottom: Spacing.md }]}>{formError}</Text> : null}

                <Card style={styles.reviewCard}>
                  <Text style={styles.reviewCardTitle}>ACCOUNT</Text>
                  <ReviewRow label="Email" value={values.email || "—"} />
                </Card>

                <Card style={styles.reviewCard}>
                  <Text style={styles.reviewCardTitle}>PROFILE</Text>
                  <ReviewRow label="Full name" value={values.fullName || "—"} />
                  <ReviewRow label="Phone" value={values.phone || "—"} />
                  <ReviewRow
                    label="Date of birth"
                    value={values.dateOfBirth ? formatDateDisplay(values.dateOfBirth) : "—"}
                  />
                  <ReviewRow label="Gender" value={values.gender ?? "—"} />
                  <ReviewRow label="Primary goal" value={values.primaryGoal ?? "—"} />
                  <ReviewRow label="Sport played" value={sportVisible ? values.sportPlayed || "—" : "Not applicable"} />
                  <ReviewRow label="Current weight" value={values.currentWeightKg || "—"} />
                  <ReviewRow label="Additional info" value={values.additionalInfo || "—"} />
                  <ReviewRow
                    label="Emergency contact"
                    value={`${values.emergencyContactName || "—"} — ${values.emergencyContactPhone || "—"}`}
                  />
                  <ReviewRow
                    label="Second emergency contact"
                    value={
                      values.emergencyContact2Name.trim()
                        ? `${values.emergencyContact2Name} — ${values.emergencyContact2Phone || "—"}`
                        : "—"
                    }
                  />
                  <ReviewRow
                    label="Dietary preference"
                    value={optionLabel(DIETARY_PREFERENCES, values.dietaryPreference)}
                  />
                  <ReviewRow
                    label="Allergies"
                    value={values.allergies.length ? values.allergies.map((v) => optionLabel(ALLERGENS, v)).join(", ") : "—"}
                  />
                  <ReviewRow
                    label="Intolerances / medical"
                    value={
                      values.intolerancesOrMedical.length
                        ? values.intolerancesOrMedical.map((v) => optionLabel(INTOLERANCES, v)).join(", ")
                        : "—"
                    }
                  />
                  <ReviewRow label="Dietary notes" value={values.dietaryNotes || "—"} />
                </Card>

                {cycleEligible ? (
                  <Card style={styles.reviewCard}>
                    <Text style={styles.reviewCardTitle}>CYCLE TRACKING</Text>
                    <ReviewRow label="Cycle tracking" value={values.cycleTrackingEnabled ? "Yes" : "No"} />
                    <ReviewRow label="Menopause support" value={values.menopauseSupportEnabled ? "Yes" : "No"} />
                    {cycleFieldsVisible ? (
                      <>
                        <ReviewRow
                          label="Last period start"
                          value={values.lastPeriodStartDate ? formatDateDisplay(values.lastPeriodStartDate) : "—"}
                        />
                        <ReviewRow label="Average cycle length" value={values.averageCycleLengthDays || "—"} />
                        <ReviewRow label="Period length" value={values.periodLengthDays || "—"} />
                        <ReviewRow label="Regularity" value={values.regularity ?? "—"} />
                        <ReviewRow label="Share current phase" value={values.shareCurrentPhaseWithCoach ? "Yes" : "No"} />
                        <ReviewRow label="Share exact dates" value={values.shareExactDatesWithCoach ? "Yes" : "No"} />
                        <ReviewRow label="Share notes" value={values.shareNotesWithCoach ? "Yes" : "No"} />
                      </>
                    ) : null}
                  </Card>
                ) : null}

                <Card style={styles.reviewCard}>
                  <CheckboxRow
                    label="I agree to the Terms and Conditions"
                    description="Tap to open the Terms and Conditions in your browser."
                    checked={agreedToTerms}
                    onToggle={() => {
                      setAgreedToTerms((v) => !v);
                    }}
                  />
                  <Pressable onPress={() => Linking.openURL(`${API_BASE_URL}/terms`)}>
                    <Text style={styles.legalLink}>Read Terms and Conditions</Text>
                  </Pressable>

                  <CheckboxRow
                    label="I agree to the Privacy Policy"
                    description="Tap to open the Privacy Policy in your browser."
                    checked={agreedToPrivacy}
                    onToggle={() => {
                      setAgreedToPrivacy((v) => !v);
                    }}
                  />
                  <Pressable onPress={() => Linking.openURL(`${API_BASE_URL}/privacy`)}>
                    <Text style={styles.legalLink}>Read Privacy Policy</Text>
                  </Pressable>
                </Card>
              </>
            ) : null}

            <View style={styles.footerRow}>
              {step > 0 ? (
                <Button title="Back" onPress={goBack} variant="secondary" style={styles.footerButton} />
              ) : (
                <View style={styles.footerButton} />
              )}

              {step < totalSteps - 1 ? (
                <Button title="Next" onPress={goNext} style={styles.footerButton} />
              ) : (
                <Button
                  title="Create account"
                  onPress={handleSubmit}
                  loading={submitting}
                  style={styles.footerButton}
                />
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  logo: {
    marginBottom: Spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Color.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Color.textPrimary,
    fontStyle: "italic",
  },
  stepIndicator: {
    fontSize: 12,
    color: Color.textMuted,
    marginTop: Spacing.sm,
  },
  progressTrack: {
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Color.surface2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
    backgroundColor: Color.gold,
  },
  form: {},
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: Color.textSecondary,
    marginBottom: 6,
  },
  labelSpaced: {
    marginTop: Spacing.md,
  },
  chipHint: {
    fontSize: 11,
    color: Color.textFaint,
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  chipActive: {
    borderColor: Color.gold,
    backgroundColor: Color.goldWeak,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Color.textMuted,
  },
  chipTextActive: {
    color: Color.gold,
  },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: "top" },
  hint: {
    fontSize: 11,
    color: Color.textFaint,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    lineHeight: 15,
  },
  introText: {
    fontSize: 13,
    color: Color.textMuted,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  dietaryCard: {
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  dietaryTitle: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
  dietaryHint: { fontSize: 11, color: Color.textMuted, marginTop: 2, marginBottom: Spacing.md, lineHeight: 15 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkboxLabel: { fontSize: 13, fontWeight: "500", color: Color.textPrimary },
  checkboxDescription: { fontSize: 11, color: Color.textMuted, marginTop: 2, lineHeight: 15 },
  shareWrap: { marginTop: Spacing.xs },
  legalLink: {
    fontSize: 12,
    color: Color.gold,
    fontWeight: "600",
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    marginLeft: 28,
  },
  reviewCard: { padding: Spacing.md, marginBottom: Spacing.md },
  reviewCardTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  reviewRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  reviewLabel: { fontSize: 11, color: Color.textMuted },
  reviewValue: { fontSize: 13, color: Color.textPrimary, fontWeight: "500", marginTop: 2 },
  warnBox: {
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.warningWeak,
    backgroundColor: Color.warningWeak,
    padding: Spacing.sm,
  },
  warnText: { fontSize: 12, color: Color.warning },
  warnLink: { fontSize: 12, color: Color.warning, fontWeight: "700", marginTop: 4 },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  footerButton: { flex: 1 },
  error: {
    color: Color.danger,
    fontSize: 12,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Color.textMuted,
    fontSize: 14,
  },
  link: {
    color: Color.gold,
    fontSize: 14,
    fontWeight: "600",
  },
});

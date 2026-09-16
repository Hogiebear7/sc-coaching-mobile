import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Color, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { dismissEmergencyContactReminder } from "@/lib/emergency-contact-reminder";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";

// Reached from _layout.tsx's post-upgrade gate: a member who has just
// reached Membership tier (staff grant or self-serve Stripe checkout, either
// path) but has never given an emergency contact, since Free/App
// Subscription signups never collect one (see gym-app's
// app/api/auth/signup/route.ts and the matching mobile route). Membership
// members are seen in person, so this is the one point that's a genuine
// safety gap rather than just an onboarding nicety — "Remind me later" keeps
// it skippable here, but booking a class hard-requires it (see log-food.tsx
// sibling gate in gym-app's app/api/bookings/create/route.ts).
export default function CompleteMembershipScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [name2, setName2] = useState("");
  const [phone2, setPhone2] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.emergencyContactName ?? "");
    setPhone(profile.emergencyContactPhone ?? "");
    setName2(profile.emergencyContact2Name ?? "");
    setPhone2(profile.emergencyContact2Phone ?? "");
  }, [profile]);

  function skip() {
    dismissEmergencyContactReminder();
    router.replace("/(tabs)");
  }

  async function save() {
    if (!profile) return;
    setError(null);

    if (!name.trim()) {
      setError("Emergency contact name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Emergency contact phone number is required.");
      return;
    }
    if (name2.trim() && !phone2.trim()) {
      setError("Enter a phone number for the second contact, or clear their name.");
      return;
    }

    try {
      await update.mutateAsync({
        fullName: profile.fullName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth ?? "",
        gender: profile.gender,
        primaryGoal: profile.primaryGoal,
        secondaryGoal: profile.secondaryGoal ?? "",
        sportPlayed: profile.sportPlayed ?? undefined,
        heightCm: profile.heightCm ? String(profile.heightCm) : undefined,
        country: profile.country ?? "",
        additionalInfo: profile.additionalInfo ?? undefined,
        emergencyContactName: name.trim(),
        emergencyContactPhone: phone.trim(),
        emergencyContact2Name: name2.trim() || undefined,
        emergencyContact2Phone: phone2.trim() || undefined,
        dietaryPreference: profile.dietaryPreference,
        allergies: profile.allergies,
        intolerancesOrMedical: profile.intolerancesOrMedical,
        dietaryNotes: profile.dietaryNotes ?? undefined,
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <BrandMark height={28} style={styles.logo} />
        <Text style={styles.eyebrow}>MEMBERSHIP</Text>
        <Text style={styles.title}>Add an emergency contact</Text>
        <Text style={styles.hint}>
          Now that you&apos;re training in person, who should we contact if something happens to you
          during a session?
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextField
          label="Emergency contact name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Jane Smith"
          style={{ marginTop: Spacing.lg }}
        />
        <TextField
          label="Emergency contact phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+353 83 123 4567"
        />
        <TextField
          label="Second emergency contact name — optional"
          value={name2}
          onChangeText={setName2}
          placeholder="e.g. John Smith"
        />
        {name2.trim() ? (
          <TextField
            label="Second emergency contact phone"
            value={phone2}
            onChangeText={setPhone2}
            keyboardType="phone-pad"
            placeholder="+353 83 123 4567"
          />
        ) : null}

        <Button title="Save" onPress={save} loading={update.isPending} style={styles.saveButton} />
        <Button title="Remind me later" onPress={skip} variant="secondary" style={styles.laterButton} />
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  logo: { marginBottom: Spacing.md },
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
  hint: {
    fontSize: 13,
    color: Color.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 19,
  },
  error: {
    color: Color.danger,
    fontSize: 12,
    marginTop: Spacing.md,
  },
  saveButton: { marginTop: Spacing.xl },
  laterButton: { marginTop: Spacing.sm },
});

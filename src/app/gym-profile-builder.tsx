import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EquipmentPicker } from "@/components/ui/EquipmentPicker";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { tapFeedback } from "@/lib/haptics";
import {
  useCreateGymProfile,
  useDeleteGymProfile,
  useEquipmentCatalog,
  useGymProfiles,
  useUpdateGymProfile,
} from "@/lib/queries/gym-profiles";

const ICON_OPTIONS = ["🏠", "🏋️", "🧳", "🎒", "🩹", "💪", "🏟️", "🏃", "⚡", "🔥"];

export default function GymProfileBuilderScreen() {
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const { data: catalog, isLoading: catalogLoading } = useEquipmentCatalog();
  const { data: profilesData, isLoading: profilesLoading } = useGymProfiles();
  const createProfile = useCreateGymProfile();
  const updateProfile = useUpdateGymProfile();
  const deleteProfile = useDeleteGymProfile();

  const existing = profileId ? profilesData?.profiles.find((p) => p.id === profileId) : undefined;
  const isEditing = !!profileId;
  const stillLoadingExisting = isEditing && profilesLoading;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [equipmentSlugs, setEquipmentSlugs] = useState<string[]>([]);
  const [presetSlug, setPresetSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || stillLoadingExisting) return;
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setEquipmentSlugs(existing.equipmentSlugs);
      setPresetSlug(existing.presetSlug);
    }
    setHydrated(true);
  }, [existing, stillLoadingExisting, hydrated]);

  function applyPreset(preset: NonNullable<typeof catalog>["presets"][number]) {
    tapFeedback();
    setName(preset.name);
    setIcon(preset.icon);
    setEquipmentSlugs(preset.equipmentSlugs);
    setPresetSlug(preset.slug);
  }

  function toggleEquipment(slug: string) {
    setEquipmentSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Give this gym profile a name.");
      return;
    }
    try {
      if (isEditing && existing) {
        await updateProfile.mutateAsync({ id: existing.id, name: name.trim(), icon, equipmentSlugs });
      } else {
        await createProfile.mutateAsync({ name: name.trim(), icon, equipmentSlugs, presetSlug });
      }
      tapFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this gym profile. Please try again.");
    }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert("Delete gym profile?", `"${existing.name}" will be removed. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProfile.mutateAsync(existing.id);
          tapFeedback();
          router.back();
        },
      },
    ]);
  }

  const saving = createProfile.isPending || updateProfile.isPending;

  if (catalogLoading || !hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Gym Profile" : "New Gym Profile"}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!isEditing && catalog ? (
            <>
              <Text style={styles.fieldLabel}>Start from a preset (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {catalog.presets.map((preset) => (
                  <Pressable
                    key={preset.slug}
                    onPress={() => applyPreset(preset)}
                    style={[styles.presetCard, presetSlug === preset.slug && styles.presetCardActive]}
                  >
                    <Text style={styles.presetIcon}>{preset.icon}</Text>
                    <Text style={styles.presetName}>{preset.name}</Text>
                    <Text style={styles.presetMeta}>{preset.equipmentSlugs.length} items</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <TextField label="Profile name" value={name} onChangeText={setName} placeholder="e.g. Home Gym" />

          <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Icon</Text>
          <View style={styles.iconRow}>
            {ICON_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setIcon(opt)}
                style={[styles.iconChip, icon === opt && styles.iconChipActive]}
              >
                <Text style={styles.iconChipText}>{opt}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.equipmentHeaderRow}>
            <Text style={styles.fieldLabel}>Equipment ({equipmentSlugs.length} selected)</Text>
          </View>

          <EquipmentPicker catalog={catalog} selectedSlugs={equipmentSlugs} onToggle={toggleEquipment} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? "Save changes" : "Create gym profile"} onPress={handleSave} loading={saving} style={{ marginTop: Spacing.lg }} />

          {isEditing ? (
            <Pressable onPress={handleDelete} style={styles.secondaryRow}>
              <Text style={styles.deleteText}>Delete gym profile</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: Color.textSecondary, marginBottom: 4 },
  presetRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  presetCard: {
    width: 108,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.sm,
    alignItems: "center",
  },
  presetCardActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  presetIcon: { fontSize: 22 },
  presetName: { fontSize: 12, fontWeight: "600", color: Color.textPrimary, marginTop: 4, textAlign: "center" },
  presetMeta: { fontSize: 10, color: Color.textFaint, marginTop: 2 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  iconChip: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, alignItems: "center", justifyContent: "center" },
  iconChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  iconChipText: { fontSize: 18 },
  equipmentHeaderRow: { marginTop: Spacing.md },
  error: { fontSize: 12, color: Color.danger, marginTop: Spacing.md },
  secondaryRow: { alignItems: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm },
  deleteText: { fontSize: 13, color: Color.danger, fontWeight: "600" },
});

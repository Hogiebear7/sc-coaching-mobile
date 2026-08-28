import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { COUNTRIES, type CountryOption } from "@/lib/country-options";

// A tap-to-open, searchable, scrollable picker — the ~200-country list
// doesn't fit as a flat chip row the way the app's other short option lists
// do (see DietaryRequirementsFields), so this gets its own modal rather than
// reusing the chip pattern.
export function CountryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = COUNTRIES.find((c) => c.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  function select(country: CountryOption | null) {
    onChange(country?.value ?? "");
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={selected ? styles.fieldValue : styles.fieldPlaceholder}>{selected ? selected.label : "Not set"}</Text>
        <Ionicons name="chevron-down" size={16} color={Color.textFaint} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Country</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={Color.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={Color.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries…"
              placeholderTextColor={Color.textFaint}
              style={styles.searchInput}
              autoCapitalize="none"
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.value}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable onPress={() => select(null)} style={styles.row}>
                <Text style={styles.rowText}>Not set</Text>
                {!selected ? <Ionicons name="checkmark" size={18} color={Color.gold} /> : null}
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => select(item)} style={styles.row}>
                <Text style={styles.rowText}>{item.label}</Text>
                {item.value === value ? <Ionicons name="checkmark" size={18} color={Color.gold} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No countries match &quot;{query}&quot;.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
  },
  fieldValue: { fontSize: 14, color: Color.textPrimary },
  fieldPlaceholder: { fontSize: 14, color: Color.textFaint },
  modalSafe: { flex: 1, backgroundColor: Color.bg0 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, fontSize: 14, color: Color.textPrimary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  rowText: { fontSize: 14, color: Color.textPrimary },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl },
});

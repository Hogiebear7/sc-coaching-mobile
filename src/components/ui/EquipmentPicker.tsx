import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import type { EquipmentCatalogData, EquipmentItem } from "@/lib/queries/gym-profiles";

// Search + category-grouped chip picker over the equipment catalog — shared
// between gym-profile-builder.tsx (saved profiles) and the workout
// generator's "edit equipment for this workout" override (a one-off,
// unsaved tweak). Selection state lives with the caller; this component is
// just the picker UI.
export function EquipmentPicker({
  catalog,
  selectedSlugs,
  onToggle,
}: {
  catalog: EquipmentCatalogData | undefined;
  selectedSlugs: string[];
  onToggle: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const filteredEquipment = useMemo((): EquipmentItem[] => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return catalog.equipment;
    return catalog.equipment.filter(
      (e) => e.label.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [catalog, query]);

  const equipmentByCategory = useMemo(() => {
    const map = new Map<string, EquipmentItem[]>();
    for (const e of filteredEquipment) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [filteredEquipment]);

  const isSearching = query.trim() !== "";

  function toggleCategory(slug: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <View>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Color.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search equipment…"
          placeholderTextColor={Color.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {catalog?.categories.map((cat) => {
        const items = equipmentByCategory.get(cat.slug) ?? [];
        if (items.length === 0) return null;
        const open = isSearching || openCategories.has(cat.slug);
        const selectedCount = items.filter((e) => selectedSlugs.includes(e.slug)).length;

        return (
          <Card key={cat.slug} style={styles.categoryCard}>
            <Pressable onPress={() => toggleCategory(cat.slug)} disabled={isSearching} style={styles.categoryHeader}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <View style={styles.categoryHeaderRight}>
                <Text style={styles.categoryCount}>{selectedCount > 0 ? `${selectedCount}/${items.length}` : items.length}</Text>
                {!isSearching ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Color.textFaint} /> : null}
              </View>
            </Pressable>

            {open ? (
              <View style={styles.equipmentChipWrap}>
                {items.map((item) => {
                  const selected = selectedSlugs.includes(item.slug);
                  return (
                    <Pressable
                      key={item.slug}
                      onPress={() => onToggle(item.slug)}
                      style={[styles.equipmentChip, selected && styles.equipmentChipActive]}
                    >
                      <Text style={[styles.equipmentChipText, selected && styles.equipmentChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Color.textPrimary },
  categoryCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryHeaderRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  categoryLabel: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  categoryCount: { fontSize: 11, color: Color.textFaint, fontVariant: ["tabular-nums"] },
  equipmentChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  equipmentChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  equipmentChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  equipmentChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  equipmentChipTextActive: { color: Color.gold },
});

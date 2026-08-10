import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { useMyCustomFoods, type FoodRecord } from "@/lib/queries/food-catalog";

export default function MyFoodsScreen() {
  const router = useRouter();
  const { data: foods, isLoading } = useMyCustomFoods();

  function renderItem({ item }: { item: FoodRecord }) {
    return (
      <Pressable onPress={() => router.push({ pathname: "/custom-food", params: { id: item.id } })} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.brandName ? `${item.brandName} — ${item.name}` : item.name}
          </Text>
          <Text style={styles.rowSub}>
            {item.nutrition100g.calories} kcal / 100g{item.barcode ? ` · linked to a barcode` : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Color.textFaint} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Custom Foods</Text>
        <Pressable onPress={() => router.push("/custom-food")} hitSlop={12}>
          <Ionicons name="add" size={24} color={Color.gold} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : !foods || foods.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="restaurant-outline" size={32} color={Color.textFaint} />
          <Text style={styles.emptyText}>No custom foods yet. Add one, or save a food while logging.</Text>
        </View>
      ) : (
        <FlatList data={foods} keyExtractor={(f) => f.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: Spacing.md, lineHeight: 19 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  rowName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  rowSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
});

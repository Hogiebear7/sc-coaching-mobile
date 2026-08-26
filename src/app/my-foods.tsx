import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Color, Radius, Spacing } from "@/constants/theme";
import { FREE_CUSTOM_FOOD_LIMIT, hasAccess } from "@/lib/member-access";
import { getFoodSubmissionEligibility, useMyCustomFoods, useMySubmissions, type FoodRecord } from "@/lib/queries/food-catalog";
import { useMemberTier } from "@/lib/queries/profile";
import { SUBMISSION_STATUS_COPY } from "@/lib/submission-status";

export default function MyFoodsScreen() {
  const router = useRouter();
  const tier = useMemberTier();
  const { data: foods, isLoading } = useMyCustomFoods();
  const { data: submissions } = useMySubmissions();
  const unlimitedFoods = hasAccess(tier, "unlimitedCustomFoods");
  const atFreeLimit = !unlimitedFoods && (foods?.length ?? 0) >= FREE_CUSTOM_FOOD_LIMIT;

  function renderItem({ item }: { item: FoodRecord }) {
    const submission = submissions?.find((s) => s.customFoodId === item.id);
    const badge = submission ? SUBMISSION_STATUS_COPY[submission.status] : null;
    const { eligibility } = getFoodSubmissionEligibility(item);

    return (
      <View style={styles.row}>
        <Pressable onPress={() => router.push({ pathname: "/custom-food", params: { id: item.id } })} style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.brandName ? `${item.brandName} — ${item.name}` : item.name}
          </Text>
          <View style={styles.rowSubRow}>
            <Text style={styles.rowSub}>
              {item.nutrition100g.calories} kcal / 100g{item.barcode ? " · linked to a barcode" : ""}
            </Text>
            {badge ? (
              <View style={[styles.badge, { borderColor: Color[badge.color] }]}>
                <Text style={[styles.badgeText, { color: Color[badge.color] }]}>{badge.label}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: "/submit-food", params: { id: item.id } })} hitSlop={8} style={styles.shareButton}>
          <Ionicons
            name={submission ? "cloud-upload" : "cloud-upload-outline"}
            size={18}
            color={submission || eligibility === "eligible_for_submission" ? Color.gold : Color.textFaint}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Custom Foods</Text>
        <Pressable onPress={() => router.push(atFreeLimit ? "/membership" : "/custom-food")} hitSlop={12}>
          <Ionicons name={atFreeLimit ? "lock-closed-outline" : "add"} size={22} color={Color.gold} />
        </Pressable>
      </View>

      {!unlimitedFoods ? (
        <View style={styles.limitBanner}>
          <Text style={styles.limitBannerText}>
            {(foods?.length ?? 0)}/{FREE_CUSTOM_FOOD_LIMIT} saved on the Free tier
            {atFreeLimit ? " — upgrade for unlimited." : "."}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : !foods || foods.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="restaurant-outline" size={32} color={Color.textFaint} />
          <Text style={styles.emptyTitle}>No custom foods yet</Text>
          <Text style={styles.emptyText}>Add one here, or save a food while logging — it'll show up in this list.</Text>
        </View>
      ) : (
        <FlatList
          data={foods}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <Text style={styles.footerHint}>
              Tap <Ionicons name="cloud-upload-outline" size={12} color={Color.textMuted} /> to share a food publicly via Open Food
              Facts — it stays private unless you opt in.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  limitBanner: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  limitBannerText: { fontSize: 12, color: Color.textFaint },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary, marginTop: Spacing.md },
  emptyText: { fontSize: 13, color: Color.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
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
  rowSubRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: 2 },
  rowSub: { fontSize: 11, color: Color.textMuted },
  badge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: "700" },
  shareButton: { padding: 6 },
  footerHint: { fontSize: 11, color: Color.textMuted, lineHeight: 16, marginTop: Spacing.md, paddingHorizontal: 2 },
});

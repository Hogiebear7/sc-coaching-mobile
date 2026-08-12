import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useStaffMembers, type StaffMemberSummary } from "@/lib/queries/staff";

function MemberRow({ member, onPress }: { member: StaffMemberSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{member.fullName ?? member.email}</Text>
        <Text style={styles.rowEmail}>{member.email}</Text>
      </View>
      {member.currentPlanName ? (
        <View style={styles.planChip}>
          <Text style={styles.planChipText}>{member.currentPlanName}</Text>
        </View>
      ) : (
        <View style={[styles.planChip, styles.planChipNone]}>
          <Text style={[styles.planChipText, styles.planChipTextNone]}>No plan</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={Color.textFaint} style={{ marginLeft: Spacing.xs }} />
    </Pressable>
  );
}

export default function StaffMembersScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffMembers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "plan">("az");

  const filtered = useMemo(() => {
    if (!data) return [];
    const active = data.filter((m) => !m.archivedAt);
    const q = query.trim().toLowerCase();
    const matched = q
      ? active.filter((m) => m.fullName?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : active;

    const sorted = [...matched];
    if (sort === "az") {
      sorted.sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    } else {
      // Plan holders first (grouped by plan name alphabetically), no-plan members last.
      sorted.sort((a, b) => {
        if (!a.currentPlanName && b.currentPlanName) return 1;
        if (a.currentPlanName && !b.currentPlanName) return -1;
        if (a.currentPlanName && b.currentPlanName && a.currentPlanName !== b.currentPlanName) {
          return a.currentPlanName.localeCompare(b.currentPlanName);
        }
        return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
      });
    }
    return sorted;
  }, [data, query, sort]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Members</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Color.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email"
          placeholderTextColor={Color.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        <Pressable onPress={() => setSort("az")} style={[styles.sortChip, sort === "az" && styles.sortChipActive]}>
          <Text style={[styles.sortChipText, sort === "az" && styles.sortChipTextActive]}>A–Z</Text>
        </Pressable>
        <Pressable onPress={() => setSort("plan")} style={[styles.sortChip, sort === "plan" && styles.sortChipActive]}>
          <Text style={[styles.sortChipText, sort === "plan" && styles.sortChipTextActive]}>By membership</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load members.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          {filtered.length === 0 ? (
            <Text style={styles.errorText}>No members match &quot;{query}&quot;.</Text>
          ) : (
            filtered.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                onPress={() => router.push({ pathname: "/staff-member", params: { userId: m.userId } })}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: "700", fontStyle: "italic", color: Color.textPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  searchInput: { flex: 1, color: Color.textPrimary, fontSize: 14 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sortLabel: { fontSize: 11, color: Color.textFaint, marginRight: 2 },
  sortChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  sortChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  sortChipText: { fontSize: 11, fontWeight: "600", color: Color.textMuted },
  sortChipTextActive: { color: Color.gold },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center", marginTop: Spacing.md },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.borderSubtle,
  },
  rowName: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  rowEmail: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  planChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    backgroundColor: Color.goldWeak,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  planChipNone: { borderColor: Color.borderSubtle, backgroundColor: "transparent" },
  planChipText: { fontSize: 10, fontWeight: "600", color: Color.gold },
  planChipTextNone: { color: Color.textFaint },
});

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
import { Radius, Spacing, headline } from "@/constants/theme";
import { useSetMemberStar, useStaffMembers, type StaffMemberSummary } from "@/lib/queries/staff";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Which members the list shows (owner request 2026-10-29). By default the gym's own members, current and paused; the rest are a chip away, and a
// search always looks through everyone. An older server sends no group, so everyone counts as current there.
type GroupFilter = "current" | "past" | "none" | "starred";
const GROUP_FILTERS: { value: GroupFilter; label: string }[] = [
  { value: "current", label: "Current & paused" },
  { value: "past", label: "Past" },
  { value: "none", label: "Non-members" },
  { value: "starred", label: "Starred" },
];
function inGroup(m: StaffMemberSummary, filter: GroupFilter): boolean {
  const group = m.membershipGroup ?? "current";
  if (filter === "starred") return !!m.starred;
  if (filter === "current") return group === "current" || group === "paused";
  return group === filter;
}
const isGymMember = (m: StaffMemberSummary) => (m.membershipGroup ?? "current") === "current" || m.membershipGroup === "paused";

function MemberRow({ member, onPress, onToggleStar }: { member: StaffMemberSummary; onPress: () => void; onToggleStar: () => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Pressable
        onPress={onToggleStar}
        hitSlop={10}
        style={styles.star}
        accessibilityRole="button"
        accessibilityState={{ selected: !!member.starred }}
        accessibilityLabel={member.starred ? `Remove the star from ${member.fullName ?? member.email}` : `Star ${member.fullName ?? member.email}`}
      >
        <Ionicons name={member.starred ? "star" : "star-outline"} size={18} color={member.starred ? Color.gold : Color.textFaint} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{member.fullName ?? member.email}</Text>
        <Text style={styles.rowEmail}>{member.email}</Text>
      </View>
      {!isGymMember(member) ? (
        <View style={[styles.planChip, styles.planChipNone]}>
          <Text style={[styles.planChipText, styles.planChipTextNone]}>{member.membershipGroup === "past" ? "Past member" : "No gym Membership"}</Text>
        </View>
      ) : member.currentPlanName ? (
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
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useStaffMembers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "plan">("az");
  const [group, setGroup] = useState<GroupFilter>("current");
  const setStar = useSetMemberStar();

  const filtered = useMemo(() => {
    if (!data) return [];
    const active = data.filter((m) => !m.archivedAt);
    const q = query.trim().toLowerCase();
    // A search looks through everyone; without one, the group chip decides.
    const matched = q
      ? active.filter((m) => m.fullName?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : active.filter((m) => inGroup(m, group));

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
  }, [data, query, sort, group]);

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow} style={styles.groupScroll}>
        {GROUP_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setGroup(f.value)}
            style={[styles.sortChip, group === f.value && styles.sortChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: group === f.value }}
          >
            <Text style={[styles.sortChipText, group === f.value && styles.sortChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

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
            <Text style={styles.errorText}>
              {query.trim() ? `No members match "${query}".` : "No members here. Search by name or email to find anyone."}
            </Text>
          ) : (
            filtered.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                onPress={() => router.push({ pathname: "/staff-member", params: { userId: m.userId } })}
                onToggleStar={() => !setStar.isPending && setStar.mutate({ userId: m.userId, starred: !m.starred })}
              />
            ))
          )}
          {!query.trim() ? <Text style={styles.hint}>Search to find anyone, including people without a gym Membership.</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
    headerTitle: { ...headline(34), letterSpacing: 0.68, color: Color.textPrimary, flexShrink: 1 },
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
      borderColor: "transparent",
      backgroundColor: Color.surface2,
    },
    searchInput: { flex: 1, color: Color.textPrimary, fontSize: 14 },
    sortRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    sortLabel: { fontSize: 13, color: Color.textFaint, marginRight: 2 },
    groupScroll: { flexGrow: 0, marginBottom: Spacing.sm },
    groupRow: { gap: Spacing.xs, paddingHorizontal: Spacing.lg },
    star: { width: 32, minHeight: 44, alignItems: "flex-start", justifyContent: "center" },
    hint: { color: Color.textFaint, fontSize: 13, textAlign: "center", marginTop: Spacing.lg },
    sortChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Color.surface2, minHeight: 40, justifyContent: "center" },
    sortChipActive: { borderColor: Color.gold, backgroundColor: Color.gold },
    sortChipText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
    sortChipTextActive: { color: Color.goldForeground },
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
    rowEmail: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    planChip: {
      borderRadius: Radius.pill,
      backgroundColor: Color.goldWeak,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4 },
    planChipNone: { borderColor: Color.borderSubtle, backgroundColor: "transparent" },
    planChipText: { fontSize: 12, fontWeight: "600", color: Color.gold },
    planChipTextNone: { color: Color.textFaint },
  })
);

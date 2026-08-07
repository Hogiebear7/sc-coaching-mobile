import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { useStaffNutritionTarget } from "@/lib/queries/nutrition-diary";
import { useStaffPrograms } from "@/lib/queries/programs";
import { useStaffMemberDetail } from "@/lib/queries/staff";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function StaffMemberScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data, isLoading, isError, refetch } = useStaffMemberDetail(userId);
  const { data: programs } = useStaffPrograms(userId);
  const activeProgram = programs?.find((p) => p.status === "active") ?? null;
  const { data: nutritionTarget } = useStaffNutritionTarget(userId);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Member</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load this member.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.name}>{data.fullName ?? data.email}</Text>
          <Text style={styles.email}>{data.email}</Text>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>MEMBERSHIP</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Plan</Text>
              <Text style={styles.rowValue}>{data.currentPlanName ?? "No active plan"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text style={styles.rowValue}>{data.currentStatus ?? "—"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Renews / ends</Text>
              <Text style={styles.rowValue}>{formatDate(data.currentPeriodEnd)}</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Phone</Text>
              <Text style={styles.rowValue}>{data.phone ?? "—"}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Date of birth</Text>
              <Text style={styles.rowValue}>{formatDate(data.dateOfBirth)}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Joined</Text>
              <Text style={styles.rowValue}>{formatDate(data.joinedAt)}</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>TRAINING</Text>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Primary goal</Text>
              <Text style={styles.rowValue}>{data.primaryGoal}</Text>
            </View>
            {data.sportPlayed ? (
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>Sport</Text>
                <Text style={styles.rowValue}>{data.sportPlayed}</Text>
              </View>
            ) : null}
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Sessions logged</Text>
              <Text style={styles.rowValue}>{data.totalSessionsLogged}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Total bookings</Text>
              <Text style={styles.rowValue}>{data.totalBookings}</Text>
            </View>
            <View style={styles.rowLine}>
              <Text style={styles.rowLabel}>Last session</Text>
              <Text style={styles.rowValue}>{formatDate(data.lastSessionDate)}</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>TRAINING PROGRAM</Text>
            {activeProgram ? (
              <>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Program</Text>
                  <Text style={styles.rowValue}>{activeProgram.name}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Days</Text>
                  <Text style={styles.rowValue}>{activeProgram.days.length}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Next up</Text>
                  <Text style={styles.rowValue}>{activeProgram.days[activeProgram.currentDayIndex]?.label ?? "—"}</Text>
                </View>
                <Button
                  title="Edit program"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: "/staff-program-builder", params: { userId, programId: activeProgram.id } })
                  }
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <>
                <Text style={styles.rowValue}>No program assigned yet.</Text>
                <Button
                  title="Assign program"
                  onPress={() => router.push({ pathname: "/staff-program-builder", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>NUTRITION TARGET</Text>
            {nutritionTarget ? (
              <>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Calories</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.calories} kcal</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Protein</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.proteinG} g</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Carbs</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.carbsG} g</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Fat</Text>
                  <Text style={styles.rowValue}>{nutritionTarget.fatG} g</Text>
                </View>
                <Button
                  title="Edit target"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/staff-nutrition-target", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <>
                <Text style={styles.rowValue}>No target set yet.</Text>
                <Button
                  title="Set target"
                  onPress={() => router.push({ pathname: "/staff-nutrition-target", params: { userId } })}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            )}
          </Card>

          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>
              Billing, coach notes, and account actions are managed from the staff web app for now — coming to
              mobile soon.
            </Text>
          </Card>
        </ScrollView>
      )}
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
  name: { fontSize: 20, fontWeight: "700", color: Color.textPrimary },
  email: { fontSize: 12, color: Color.textMuted, marginTop: 2, marginBottom: Spacing.lg },
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  rowLabel: { fontSize: 12, color: Color.textMuted },
  rowValue: { fontSize: 13, color: Color.textPrimary, fontWeight: "500" },
  noteCard: { padding: Spacing.md },
  noteText: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
});

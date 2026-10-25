import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { CommentSheet } from "@/components/ui/CommentSheet";
import { CommunityWinRow } from "@/components/ui/CommunityWinRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { LimitSelector, type ListLimit } from "@/components/ui/LimitSelector";
import { Spacing } from "@/constants/theme";
import { useCommunityWins } from "@/lib/queries/community";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Full "Community Wins" list, opened from the hub's capped preview via
// "See more" — scans full history server-side (see gym-app's wins route),
// so a win from further back than the hub's own preview window still shows
// up when you ask for more.
export default function CommunityWinsScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const [limit, setLimit] = useState<ListLimit>(20);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const { data, isLoading } = useCommunityWins(limit);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Community wins</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.limitWrap}>
        <LimitSelector value={limit} onChange={setLimit} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.lg }} />
        ) : !data || data.wins.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No wins yet"
            body="Follow members to see their personal bests here."
          />
        ) : (
          <Card style={styles.card}>
            {data.wins.map((item, i) => (
              <CommunityWinRow
                key={item.id}
                item={item}
                isLast={i === data.wins.length - 1}
                onPress={() => setActiveCommentId(item.id)}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <CommentSheet
        visible={activeCommentId !== null}
        onClose={() => setActiveCommentId(null)}
        workoutSessionId={activeCommentId ?? ""}
      />
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: "600", color: Color.textPrimary, flexShrink: 1, textAlign: "center" },
    limitWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    card: { padding: 0, overflow: "hidden" },
  })
);

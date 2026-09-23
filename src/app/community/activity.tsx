import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CommentSheet } from "@/components/ui/CommentSheet";
import { CommunityFeedCard } from "@/components/ui/CommunityFeedCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LimitSelector, type ListLimit } from "@/components/ui/LimitSelector";
import { Color, Spacing } from "@/constants/theme";
import { useCommunityFeed } from "@/lib/queries/community";

// Full Activity list, opened from the hub's capped preview via "See more".
// Same card, same like/comment behavior as the hub — just more of them,
// with a real limit instead of always whatever the hub's own default is.
export default function CommunityActivityScreen() {
  const router = useRouter();
  const [limit, setLimit] = useState<ListLimit>(20);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const { data, isLoading } = useCommunityFeed(limit);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.limitWrap}>
        <LimitSelector value={limit} onChange={setLimit} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.lg }} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Your feed is quiet"
            body="Follow members to see their sessions, PBs and progress here."
          />
        ) : (
          data.items.map((item) => (
            <CommunityFeedCard key={item.id} item={item} onOpenComments={() => setActiveCommentId(item.id)} />
          ))
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
  limitWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
});

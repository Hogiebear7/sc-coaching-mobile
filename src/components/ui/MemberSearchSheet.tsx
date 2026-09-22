import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { useFollowUser, useMemberSearch, useUnfollowUser, type MemberSearchResult } from "@/lib/queries/community";

import { Button } from "./Button";
import { TextField } from "./TextField";

// Shared "find a member" search — used both for following someone
// (mode="follow", shows a Follow/Following button per result) and for
// picking an @mention while writing a comment (mode="mention", tapping a
// result selects it and closes). Same plain-Modal pattern as
// ExerciseSwapSheet/InfoModal — the only overlay convention in this app.
export function MemberSearchSheet({
  visible,
  onClose,
  mode,
  onMention,
}: {
  visible: boolean;
  onClose: () => void;
  mode: "follow" | "mention";
  onMention?: (result: MemberSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: results, isFetching } = useMemberSearch(query);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{mode === "mention" ? "Mention someone" : "Follow members"}</Text>
          <TextField
            label="Search by name"
            placeholder="e.g. Alex Rider"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {isFetching ? <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} /> : null}
          <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
            {(results ?? []).map((r) => (
              <View key={r.userId} style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.fullName}
                </Text>
                {mode === "mention" ? (
                  <Pressable
                    onPress={() => {
                      tapFeedback();
                      onMention?.(r);
                      handleClose();
                    }}
                    style={styles.mentionButton}
                  >
                    <Text style={styles.mentionButtonText}>Mention</Text>
                  </Pressable>
                ) : (
                  <Button
                    title={r.isFollowing ? "Following" : "Follow"}
                    variant={r.isFollowing ? "secondary" : "primary"}
                    onPress={() => {
                      tapFeedback();
                      if (r.isFollowing) unfollowUser.mutate(r.userId);
                      else followUser.mutate(r.userId);
                    }}
                    style={styles.followButton}
                  />
                )}
              </View>
            ))}
            {!query.trim() ? (
              <Text style={styles.empty}>Start typing a name to search.</Text>
            ) : results && results.length === 0 && !isFetching ? (
              <Text style={styles.empty}>No members found for &quot;{query.trim()}&quot;.</Text>
            ) : null}
          </ScrollView>

          <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
            <Ionicons name="close" size={16} color={Color.textMuted} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,10,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: { fontSize: 15, fontWeight: "700", color: Color.textPrimary, marginBottom: Spacing.sm },
  results: { marginTop: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  name: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, flexShrink: 1 },
  followButton: { paddingHorizontal: Spacing.md },
  mentionButton: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  mentionButtonText: { fontSize: 12, fontWeight: "600", color: Color.gold },
  empty: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingVertical: Spacing.md },
  closeButton: { position: "absolute", top: Spacing.md, right: Spacing.md, padding: 4 },
});

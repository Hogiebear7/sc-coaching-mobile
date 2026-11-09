import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportReasonSheet } from "@/components/ui/ReportReasonSheet";
import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { MAX_GYM_COMMENT } from "@/lib/community-groups-format";
import { formatCommunityDate } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import { useGymComments, usePostGymComment, useRemoveGymComment, useReportGymContent } from "@/lib/queries/community-groups";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Comments on one gym post, as a bottom sheet. Same plain-Modal pattern as the main CommentSheet; no @mentions here. Anyone can report a comment that
// isn't theirs; the author and the gym's coaches and admins can remove it.
export function GymCommentSheet({ visible, onClose, postId }: { visible: boolean; onClose: () => void; postId: string }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const comments = useGymComments(visible ? postId : "");
  const post = usePostGymComment(postId);
  const remove = useRemoveGymComment(postId);
  const report = useReportGymContent();
  const [text, setText] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const list = comments.data ?? [];
  const trimmed = text.trim();

  function send() {
    if (!trimmed) return;
    tapFeedback();
    post.mutate(trimmed, {
      onSuccess: () => setText(""),
      onError: (e) => Alert.alert("Couldn't post your comment", e.message),
    });
  }

  function confirmRemove(commentId: string) {
    Alert.alert("Remove this comment?", "It will be removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(commentId, { onError: (e) => Alert.alert("Couldn't remove it", e.message) }) },
    ]);
  }

  function sendReport(reason: string) {
    if (!reportingId) return;
    report.mutate(
      { targetType: "comment", targetId: reportingId, reason },
      {
        onSuccess: (r) => {
          setReportingId(null);
          Alert.alert("Reported", r.message);
        },
        onError: (e) => Alert.alert("Couldn't send the report", e.message),
      }
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close comments" />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { maxHeight: windowHeight * 0.8, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Comments{list.length > 0 ? ` (${list.length})` : ""}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>

          {comments.isLoading ? (
            <ActivityIndicator color={Color.gold} style={{ marginVertical: Spacing.lg }} />
          ) : list.length === 0 ? (
            <Text style={styles.empty}>No comments yet. Be the first.</Text>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
              {list.map((c) => (
                <View key={c.id} style={styles.comment}>
                  <View style={styles.commentHead}>
                    <Text style={styles.author} numberOfLines={1}>
                      {c.author.userId === user?.id ? "You" : c.author.displayName}
                      {c.author.isStaff ? "  ·  Coach" : ""}
                    </Text>
                    <Text style={styles.when}>{formatCommunityDate(c.createdAt, "compact")}</Text>
                  </View>
                  <Text style={styles.body}>{c.body}</Text>
                  <View style={styles.commentActions}>
                    {c.canRemove ? (
                      <Pressable onPress={() => confirmRemove(c.id)} hitSlop={8} style={styles.action} accessibilityRole="button">
                        <Text style={styles.actionText}>Remove</Text>
                      </Pressable>
                    ) : null}
                    {c.author.userId !== user?.id ? (
                      <Pressable onPress={() => setReportingId(c.id)} hitSlop={8} style={styles.action} accessibilityRole="button">
                        <Text style={styles.actionText}>Report</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={(t) => setText(t.slice(0, MAX_GYM_COMMENT))}
              placeholder="Write a comment"
              placeholderTextColor={Color.textFaint}
              multiline
              style={styles.input}
              accessibilityLabel="Write a comment"
            />
            <Pressable
              onPress={send}
              disabled={!trimmed || post.isPending}
              style={[styles.send, (!trimmed || post.isPending) && styles.sendDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              {post.isPending ? <ActivityIndicator color={Color.goldForeground} /> : <Text style={styles.sendText}>Post</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ReportReasonSheet
        visible={reportingId !== null}
        onClose={() => setReportingId(null)}
        onSubmit={sendReport}
        submitting={report.isPending}
        heading="Report this comment"
      />
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(4,10,20,0.6)" },
    sheetWrap: { flex: 1, justifyContent: "flex-end" },
    sheet: { backgroundColor: Color.surface1, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
    title: { fontSize: 17, fontWeight: "700", color: Color.textPrimary },
    close: { minHeight: 40, justifyContent: "center" },
    closeText: { fontSize: 15, fontWeight: "600", color: Color.gold },
    empty: { fontSize: 14, color: Color.textMuted, textAlign: "center", paddingVertical: Spacing.lg },
    comment: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    commentHead: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
    author: { flex: 1, fontSize: 14, fontWeight: "700", color: Color.textPrimary },
    when: { fontSize: 12, color: Color.textFaint },
    body: { fontSize: 14, color: Color.textSecondary, lineHeight: 20, marginTop: 2 },
    commentActions: { flexDirection: "row", gap: Spacing.md },
    action: { minHeight: 36, justifyContent: "center" },
    actionText: { fontSize: 13, fontWeight: "600", color: Color.textFaint },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm, marginTop: Spacing.sm },
    input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: Radius.md, backgroundColor: Color.surface2, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 14, color: Color.textPrimary },
    send: { minHeight: 44, minWidth: 64, borderRadius: Radius.pill, backgroundColor: Color.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.md },
    sendDisabled: { opacity: 0.4 },
    sendText: { fontSize: 15, fontWeight: "700", color: Color.goldForeground },
  })
);

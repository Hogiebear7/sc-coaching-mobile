import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Color, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { formatCommunityDate } from "@/lib/community-formatters";
import { tapFeedback } from "@/lib/haptics";
import {
  useDeleteComment,
  usePostComment,
  useReportComment,
  useWorkoutComments,
  type MemberSearchResult,
  type WorkoutComment,
} from "@/lib/queries/community";

import { MemberSearchSheet } from "./MemberSearchSheet";

// Comment thread + composer for one workout session. Same plain-Modal
// pattern as ExerciseSwapSheet — a single shared instance in the Community
// tab, re-opened for whichever feed item's comment button was tapped.
export function CommentSheet({
  visible,
  onClose,
  workoutSessionId,
}: {
  visible: boolean;
  onClose: () => void;
  workoutSessionId: string;
}) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useWorkoutComments(workoutSessionId);
  const postComment = usePostComment(workoutSessionId);
  const deleteComment = useDeleteComment(workoutSessionId);
  const reportComment = useReportComment();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ userId: string; fullName: string }[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  function handleChangeText(next: string) {
    setText(next);
    if (next.endsWith("@")) setMentionPickerOpen(true);
  }

  function handleMention(result: MemberSearchResult) {
    setText((prev) => `${prev.slice(0, -1)}@${result.fullName} `);
    setMentions((prev) => [...prev, { userId: result.userId, fullName: result.fullName }]);
  }

  function handleSend() {
    const body = text.trim();
    if (!body) return;
    tapFeedback();
    postComment.mutate(
      { body, mentionedUserIds: mentions.map((m) => m.userId) },
      {
        onSuccess: () => {
          setText("");
          setMentions([]);
        },
      }
    );
  }

  function handleSubmitReport(commentId: string) {
    const reason = reportReason.trim();
    if (!reason) return;
    reportComment.mutate(
      { commentId, reason },
      {
        onSuccess: () => {
          setReportingId(null);
          setReportReason("");
        },
      }
    );
  }

  function handleClose() {
    setText("");
    setMentions([]);
    setReportingId(null);
    setReportReason("");
    onClose();
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <KeyboardAvoidingView behavior="padding" style={styles.avoidingView}>
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.title}>Comments</Text>

              {isLoading ? (
                <ActivityIndicator color={Color.gold} style={{ marginVertical: Spacing.lg }} />
              ) : (
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {(comments ?? []).length === 0 ? (
                    <Text style={styles.empty}>No comments yet — be the first.</Text>
                  ) : (
                    (comments as WorkoutComment[]).map((c) => {
                      const isDeletingThis = deleteComment.isPending && deleteComment.variables === c.id;
                      const isReportingThis =
                        reportComment.isPending && reportComment.variables?.commentId === c.id;
                      return (
                        <View key={c.id} style={styles.commentRow}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentAuthor} numberOfLines={1}>
                              {c.authorName}
                            </Text>
                            <Text style={styles.commentDate}>{formatCommunityDate(c.createdAt, "compact")}</Text>
                          </View>
                          <Text style={styles.commentBody}>{c.body}</Text>
                          <View style={styles.commentActions}>
                            {c.userId === user?.id ? (
                              <Pressable
                                onPress={() => deleteComment.mutate(c.id)}
                                disabled={isDeletingThis}
                                hitSlop={8}
                              >
                                <Text style={[styles.commentActionText, isDeletingThis && styles.commentActionTextDisabled]}>
                                  {isDeletingThis ? "Deleting…" : "Delete"}
                                </Text>
                              </Pressable>
                            ) : (
                              <Pressable onPress={() => setReportingId(reportingId === c.id ? null : c.id)} hitSlop={8}>
                                <Text style={styles.commentActionText}>Report</Text>
                              </Pressable>
                            )}
                          </View>
                          {deleteComment.isError && deleteComment.variables === c.id ? (
                            <Text style={styles.errorText}>{deleteComment.error?.message ?? "Couldn't delete that comment."}</Text>
                          ) : null}
                          {reportingId === c.id ? (
                            <View style={styles.reportRow}>
                              <TextInput
                                value={reportReason}
                                onChangeText={setReportReason}
                                placeholder="Why are you reporting this?"
                                placeholderTextColor={Color.textFaint}
                                style={styles.reportInput}
                                editable={!isReportingThis}
                              />
                              <Pressable
                                onPress={() => handleSubmitReport(c.id)}
                                disabled={isReportingThis || !reportReason.trim()}
                                hitSlop={8}
                                style={styles.reportSubmit}
                              >
                                {isReportingThis ? (
                                  <ActivityIndicator color={Color.danger} size="small" />
                                ) : (
                                  <Text style={styles.reportSubmitText}>Send</Text>
                                )}
                              </Pressable>
                            </View>
                          ) : null}
                          {reportComment.isError && reportComment.variables?.commentId === c.id ? (
                            <Text style={styles.errorText}>{reportComment.error?.message ?? "Couldn't send that report."}</Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}

              <View style={styles.composerRow}>
                <TextInput
                  value={text}
                  onChangeText={handleChangeText}
                  placeholder="Add a comment… (type @ to mention)"
                  placeholderTextColor={Color.textFaint}
                  style={styles.composerInput}
                  editable={!postComment.isPending}
                  multiline
                />
                <Pressable
                  onPress={handleSend}
                  disabled={postComment.isPending || !text.trim()}
                  hitSlop={8}
                  style={styles.sendButton}
                  accessibilityLabel="Send comment"
                >
                  {postComment.isPending ? (
                    <ActivityIndicator color={Color.gold} size="small" />
                  ) : (
                    <Ionicons name="send" size={18} color={text.trim() ? Color.gold : Color.textFaint} />
                  )}
                </Pressable>
              </View>
              {postComment.isError ? (
                <Text style={styles.errorText}>{postComment.error?.message ?? "Couldn't post your comment."}</Text>
              ) : null}

              <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
                <Ionicons name="close" size={16} color={Color.textMuted} />
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <MemberSearchSheet
        visible={mentionPickerOpen}
        onClose={() => setMentionPickerOpen(false)}
        mode="mention"
        onMention={handleMention}
      />
    </>
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
  avoidingView: { width: "100%", alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  list: { marginTop: Spacing.sm, flexGrow: 0 },
  empty: { fontSize: 12, color: Color.textMuted, textAlign: "center", paddingVertical: Spacing.lg },
  commentRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commentAuthor: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  commentDate: { fontSize: 11, color: Color.textFaint },
  commentBody: { fontSize: 13, color: Color.textSecondary, marginTop: 2, lineHeight: 18 },
  commentActions: { flexDirection: "row", marginTop: 4 },
  commentActionText: { fontSize: 11, fontWeight: "600", color: Color.textFaint },
  commentActionTextDisabled: { opacity: 0.6 },
  errorText: { fontSize: 11, color: Color.danger, marginTop: 4 },
  reportRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.xs, alignItems: "center" },
  reportInput: {
    flex: 1,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.bg0,
    paddingHorizontal: Spacing.sm,
    fontSize: 12,
    color: Color.textPrimary,
  },
  reportSubmit: { paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  reportSubmitText: { fontSize: 12, fontWeight: "600", color: Color.danger },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
    paddingTop: Spacing.sm,
  },
  composerInput: {
    flex: 1,
    maxHeight: 80,
    minHeight: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.bg0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: Color.textPrimary,
  },
  sendButton: { padding: 8 },
  closeButton: { position: "absolute", top: Spacing.md, right: Spacing.md, padding: 4 },
});

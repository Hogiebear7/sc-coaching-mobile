import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, Spacing } from "@/constants/theme";
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

import { MemberSafetySheet } from "./MemberSafetySheet";
import { MemberSearchSheet } from "./MemberSearchSheet";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// Comment thread + composer for one workout session, as a bottom sheet — a
// single shared instance in the Community tab, re-opened for whichever feed
// item's comment button was tapped. The empty state sits outside the
// ScrollView: a flexGrow:0 ScrollView inside the old centred card collapsed
// and clipped "No comments yet" in half.
export function CommentSheet({
  visible,
  onClose,
  workoutSessionId,
}: {
  visible: boolean;
  onClose: () => void;
  workoutSessionId: string;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { data: comments, isLoading } = useWorkoutComments(workoutSessionId);
  const postComment = usePostComment(workoutSessionId);
  const deleteComment = useDeleteComment(workoutSessionId);
  const reportComment = useReportComment();
  const commentCount = (comments ?? []).length;

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ userId: string; fullName: string }[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);
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
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close comments" />
        <KeyboardAvoidingView behavior="padding" style={styles.avoidingView} pointerEvents="box-none">
          <View style={[styles.card, { maxHeight: windowHeight * 0.85, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Comments{commentCount > 0 ? ` · ${commentCount}` : ""}</Text>
              <Pressable onPress={handleClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close comments">
                <Ionicons name="close" size={20} color={Color.textPrimary} />
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator color={Color.gold} style={{ marginVertical: Spacing.xl }} />
            ) : commentCount === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={28} color={Color.textMuted} />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.empty}>Be the first to say something.</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.list, { maxHeight: windowHeight * 0.5 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(comments as WorkoutComment[]).map((c) => {
                  const isDeletingThis = deleteComment.isPending && deleteComment.variables === c.id;
                  const isReportingThis = reportComment.isPending && reportComment.variables?.commentId === c.id;
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
                          <Pressable onPress={() => deleteComment.mutate(c.id)} disabled={isDeletingThis} hitSlop={8}>
                            <Text style={[styles.commentActionText, isDeletingThis && styles.commentActionTextDisabled]}>
                              {isDeletingThis ? "Deleting…" : "Delete"}
                            </Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable onPress={() => setReportingId(reportingId === c.id ? null : c.id)} hitSlop={8}>
                              <Text style={styles.commentActionText}>Report</Text>
                            </Pressable>
                            <Pressable onPress={() => setBlockTarget({ userId: c.userId, name: c.authorName })} hitSlop={8}>
                              <Text style={styles.commentActionText}>Block</Text>
                            </Pressable>
                          </>
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
                })}
              </ScrollView>
            )}

            <View style={styles.composerRow}>
              <TextInput
                value={text}
                onChangeText={handleChangeText}
                placeholder="Add a comment — type @ to mention"
                placeholderTextColor={Color.textFaint}
                style={styles.composerInput}
                editable={!postComment.isPending}
                multiline
              />
              <Pressable
                onPress={handleSend}
                disabled={postComment.isPending || !text.trim()}
                style={[styles.sendButton, text.trim() ? styles.sendButtonActive : null]}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
              >
                {postComment.isPending ? (
                  <ActivityIndicator color={Color.goldForeground} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={text.trim() ? Color.goldForeground : Color.textMuted} />
                )}
              </Pressable>
            </View>
            {postComment.isError ? (
              <Text style={styles.errorText}>{postComment.error?.message ?? "Couldn't post your comment."}</Text>
            ) : null}
            <Text style={styles.rulesNote}>Keep it respectful. Abusive comments are removed, and you can report or block anyone.</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {blockTarget ? (
        <MemberSafetySheet
          visible
          onClose={() => setBlockTarget(null)}
          memberUserId={blockTarget.userId}
          memberName={blockTarget.name}
          initialStep="block"
        />
      ) : null}

      <MemberSearchSheet
        visible={mentionPickerOpen}
        onClose={() => setMentionPickerOpen(false)}
        mode="mention"
        onMention={handleMention}
      />
    </>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4,10,20,0.6)" },
    avoidingView: { flex: 1, justifyContent: "flex-end" },
    card: {
      width: "100%",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: Color.surface1,
      paddingHorizontal: Spacing.lg,
      paddingTop: 10,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Color.borderDefault, marginBottom: 10 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.xs },
    title: { fontSize: 19, fontWeight: "600", color: Color.textPrimary },
    closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    list: { marginTop: Spacing.xs, flexGrow: 0 },
    emptyWrap: { alignItems: "center", paddingVertical: Spacing.xl, gap: 6 },
    emptyTitle: { fontSize: 17, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
    empty: { fontSize: 15, color: Color.textMuted, textAlign: "center" },
    commentRow: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Color.borderSubtle },
    commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: Spacing.sm },
    commentAuthor: { flexShrink: 1, fontSize: 15, fontWeight: "600", color: Color.textPrimary },
    commentDate: { fontSize: 13, color: Color.textMuted },
    commentBody: { fontSize: 15, color: Color.textSecondary, marginTop: 4, lineHeight: 21 },
    commentActions: { flexDirection: "row", marginTop: 6 },
    commentActionText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
    rulesNote: { fontSize: 12, color: Color.textFaint, marginTop: 6 },
    commentActionTextDisabled: { opacity: 0.6 },
    errorText: { fontSize: 13, color: Color.danger, marginTop: 4 },
    reportRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.xs, alignItems: "center" },
    reportInput: {
      flex: 1,
      minHeight: 40,
      borderRadius: Radius.md,
      backgroundColor: Color.surface2,
      paddingHorizontal: 12,
      fontSize: 15,
      color: Color.textPrimary,
    },
    reportSubmit: { paddingHorizontal: Spacing.sm, minHeight: 40, justifyContent: "center" },
    reportSubmitText: { fontSize: 15, fontWeight: "600", color: Color.danger },
    composerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color.borderSubtle,
    },
    composerInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: Color.surface2,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: 15,
      color: Color.textPrimary,
    },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Color.surface2, alignItems: "center", justifyContent: "center" },
    sendButtonActive: { backgroundColor: Color.gold },
  })
);

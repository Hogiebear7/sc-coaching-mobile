import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useDraftAiReply, useSendStaffMessage, useStaffMessageThread } from "@/lib/queries/staff";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function StaffMessageThreadScreen() {
  const router = useRouter();
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName?: string }>();
  const { data, isLoading, isError, refetch } = useStaffMessageThread(memberId);
  const send = useSendStaffMessage(memberId);
  const draftAi = useDraftAiReply();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const text = body.trim();
    if (!text || send.isPending) return;
    setError(null);
    setAiNote(null);
    try {
      await send.mutateAsync(text);
      setBody("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  async function handleDraftWithAi() {
    setError(null);
    setAiNote(null);
    try {
      const res = await draftAi.mutateAsync(memberId);
      if (res.configured) {
        setBody(res.draft ?? "");
      } else {
        setAiNote(res.draft ?? "AI assistant is not configured yet.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {memberName ?? "Member"}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>Couldn&apos;t load this conversation.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.thread}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {data.messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>Send {memberName ?? "this member"} a message to start the conversation.</Text>
              </View>
            ) : (
              data.messages.map((m) => (
                <View key={m.id} style={[styles.bubble, m.senderRole === "staff" ? styles.bubbleStaff : styles.bubbleMember]}>
                  <Text style={m.senderRole === "staff" ? styles.bubbleStaffText : styles.bubbleMemberText}>{m.body}</Text>
                  <Text style={[styles.bubbleTime, m.senderRole === "staff" && styles.bubbleTimeStaff]}>
                    {m.senderRole === "staff" ? "You" : memberName ?? "Member"}
                    {formatTime(m.createdAt) ? ` · ${formatTime(m.createdAt)}` : ""}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {aiNote ? <Text style={styles.aiNote}>{aiNote}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            value={body}
            onChangeText={(t) => {
              setBody(t);
              setError(null);
            }}
            placeholder="Write a message…"
            placeholderTextColor={Color.textFaint}
            style={styles.input}
            multiline
          />
          <View style={styles.inputButtons}>
            <Pressable
              onPress={handleDraftWithAi}
              disabled={draftAi.isPending}
              style={[styles.aiButton, draftAi.isPending && styles.buttonDisabled]}
            >
              {draftAi.isPending ? (
                <ActivityIndicator color={Color.textSecondary} size="small" />
              ) : (
                <Ionicons name="sparkles-outline" size={16} color={Color.textSecondary} />
              )}
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={send.isPending || !body.trim()}
              style={[styles.sendButton, (send.isPending || !body.trim()) && styles.buttonDisabled]}
            >
              {send.isPending ? (
                <ActivityIndicator color={Color.goldForeground} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary, flex: 1, textAlign: "center" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  thread: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  emptySub: { fontSize: 12, color: Color.textMuted, marginTop: 4, textAlign: "center", maxWidth: 260 },
  bubble: { maxWidth: "85%", borderRadius: Radius.md, padding: Spacing.sm },
  bubbleStaff: { alignSelf: "flex-end", backgroundColor: Color.goldWeak },
  bubbleMember: { alignSelf: "flex-start", borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface1 },
  bubbleStaffText: { fontSize: 13, color: Color.gold, lineHeight: 18 },
  bubbleMemberText: { fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  bubbleTime: { fontSize: 10, color: Color.textFaint, marginTop: 4 },
  bubbleTimeStaff: { color: "rgba(198,161,91,0.6)" },
  error: { fontSize: 11, color: Color.danger, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
  aiNote: { fontSize: 11, color: Color.textMuted, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  input: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    color: Color.textPrimary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    maxHeight: 100,
  },
  inputButtons: { flexDirection: "row", gap: Spacing.xs },
  aiButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderDefault,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    backgroundColor: Color.gold,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    height: 40,
  },
  buttonDisabled: { opacity: 0.5 },
  sendButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
});

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { Card } from "@/components/ui/Card";
import { UpsellCard } from "@/components/ui/Upsell";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { hasAccess } from "@/lib/member-access";
import {
  useMessages,
  useSendAiCoachMessage,
  useSendCoachMessage,
  type AiMessage,
  type CoachMessage,
} from "@/lib/queries/messages";
import { useMemberTier } from "@/lib/queries/profile";

type Tab = "ai" | "coach";

function loadBandColor(band: string): string {
  if (band === "high") return Color.warning;
  if (band === "low") return Color.textMuted;
  return Color.success;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function AiCoachTab({
  configured,
  initialMessages,
  context,
}: {
  configured: boolean;
  initialMessages: AiMessage[];
  context: import("@/lib/queries/messages").CoachingContextDisplay | null;
}) {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendAiCoachMessage();
  const seeded = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const tier = useMemberTier();

  useEffect(() => {
    if (!seeded.current && initialMessages.length > 0) {
      setMessages(initialMessages);
      seeded.current = true;
    }
  }, [initialMessages]);

  if (!hasAccess(tier, "aiCoachChat")) {
    return (
      <View style={{ margin: Spacing.lg }}>
        <UpsellCard icon="chatbubble-ellipses-outline" title="AI Coach" body="Chat with the AI Coach — available on App Subscription and above." />
      </View>
    );
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || send.isPending) return;
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() },
    ]);
    try {
      const reply = await send.mutateAsync(content);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-a`, role: "assistant", content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  if (!configured) {
    return (
      <Card style={styles.unavailableCard}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={Color.textMuted} />
        <Text style={styles.unavailableTitle}>AI coach unavailable</Text>
        <Text style={styles.unavailableSub}>
          The AI assistant isn&apos;t configured on this server yet. Use the Message coach tab instead.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {context ? (
        <View style={styles.contextRow}>
          <View style={styles.contextChip}>
            <Text style={styles.contextChipText}>Today · {context.tierLabel}</Text>
          </View>
          <View style={styles.contextChip}>
            <Text style={styles.contextChipText}>
              Readiness <Text style={styles.contextChipValue}>{context.readinessScore ?? "—"}</Text>
            </Text>
          </View>
          <View style={styles.contextChip}>
            <Text style={styles.contextChipText}>
              Load <Text style={[styles.contextChipValue, { color: loadBandColor(context.loadBand) }]}>{context.loadBandLabel}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Ask your coach anything</Text>
            <Text style={styles.emptySub}>
              Answers use your real recovery, load, and training history.
            </Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>{m.content}</Text>
              <Text style={[styles.bubbleTime, m.role === "user" && styles.bubbleTimeUser]}>
                {m.role === "user" ? "You" : "AI Coach"}
                {formatTime(m.createdAt) ? ` · ${formatTime(m.createdAt)}` : ""}
              </Text>
            </View>
          ))
        )}
        {send.isPending ? (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator color={Color.gold} size="small" />
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about training, recovery, or today's session…"
          placeholderTextColor={Color.textFaint}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={send.isPending || !input.trim()}
          style={[styles.sendButton, (send.isPending || !input.trim()) && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CoachTab({ messages }: { messages: CoachMessage[] }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendCoachMessage();
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const text = body.trim();
    if (!text || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync(text);
      setBody("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>Send your coach a message — they&apos;ll reply here.</Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.senderRole === "member" ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={m.senderRole === "member" ? styles.bubbleUserText : styles.bubbleAssistantText}>{m.body}</Text>
              <Text style={[styles.bubbleTime, m.senderRole === "member" && styles.bubbleTimeUser]}>
                {m.senderRole === "staff" ? "Coach" : "You"}
                {formatTime(m.createdAt) ? ` · ${formatTime(m.createdAt)}` : ""}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write a message…"
          placeholderTextColor={Color.textFaint}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={send.isPending || !body.trim()}
          style={[styles.sendButton, (send.isPending || !body.trim()) && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMessages();
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab("ai")} style={[styles.tabButton, tab === "ai" && styles.tabButtonActive]}>
            <Text style={[styles.tabButtonText, tab === "ai" && styles.tabButtonTextActive]}>AI Coach</Text>
          </Pressable>
          <Pressable onPress={() => setTab("coach")} style={[styles.tabButton, tab === "coach" && styles.tabButtonActive]}>
            <Text style={[styles.tabButtonText, tab === "coach" && styles.tabButtonTextActive]}>Message coach</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>Couldn&apos;t load messages.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : tab === "ai" ? (
          <AiCoachTab configured={data.aiConfigured} initialMessages={data.aiMessages} context={data.aiContext} />
        ) : (
          <CoachTab messages={data.coachMessages} />
        )}
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: Color.surface2 },
  tabButtonText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  tabButtonTextActive: { color: Color.textPrimary },
  contextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  contextChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  contextChipText: { fontSize: 11, fontWeight: "500", color: Color.textSecondary },
  contextChipValue: { fontWeight: "700", color: Color.textPrimary },
  thread: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  emptySub: { fontSize: 12, color: Color.textMuted, marginTop: 4, textAlign: "center", maxWidth: 260 },
  bubble: { maxWidth: "85%", borderRadius: Radius.md, padding: Spacing.sm },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Color.goldWeak },
  bubbleAssistant: { alignSelf: "flex-start", borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface1 },
  bubbleUserText: { fontSize: 13, color: Color.gold, lineHeight: 18 },
  bubbleAssistantText: { fontSize: 13, color: Color.textSecondary, lineHeight: 18 },
  bubbleTime: { fontSize: 10, color: Color.textFaint, marginTop: 4 },
  bubbleTimeUser: { color: "rgba(198,161,91,0.6)" },
  unavailableCard: { margin: Spacing.lg, padding: Spacing.lg, alignItems: "center", gap: Spacing.xs },
  unavailableTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
  unavailableSub: { fontSize: 12, color: Color.textMuted, textAlign: "center" },
  error: { fontSize: 11, color: Color.danger, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
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
  sendButton: {
    backgroundColor: Color.gold,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
});

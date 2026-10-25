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
import { LiveColor as Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { hasAccess, isMembershipTier } from "@/lib/member-access";
import {
  useMessages,
  useSendAiCoachMessage,
  useSendCoachMessage,
  type AiMessage,
  type CoachMessage,
} from "@/lib/queries/messages";
import { useMemberTier } from "@/lib/queries/profile";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

type Tab = "ai" | "coach";

function loadBandColor(band: string): string {
  if (band === "high") return Color.warning;
  if (band === "low") return Color.textMuted;
  if (band === "moderate" || band === "light") return Color.success;
  return Color.textMuted; // no data yet
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
  const styles = useStyles();
  const Color = useLegacyColors();
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
  const styles = useStyles();
  const Color = useLegacyColors();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendCoachMessage();
  const scrollRef = useRef<ScrollView>(null);
  const tier = useMemberTier();

  // Server-enforced in app/api/messages/send/route.ts (gym-app) — this is
  // UX only, so a non-Membership member never even sees the composer.
  if (!isMembershipTier(tier)) {
    return (
      <View style={{ margin: Spacing.lg }}>
        <UpsellCard
          icon="chatbubble-ellipses-outline"
          title="Message coach"
          copyVariant="membership"
        />
      </View>
    );
  }

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
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMessages();
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={Color.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 36 }} />
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
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    errorText: { color: Color.textMuted, fontSize: 14 },
    tabBar: { flexDirection: "row", gap: 2, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, padding: 3, borderRadius: Radius.pill, backgroundColor: Color.surface2 },
    tabButton: { flex: 1, minHeight: 38, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    tabButtonActive: { backgroundColor: Color.gold },
    tabButtonText: { fontSize: 14, fontWeight: "600", color: Color.textSecondary },
    tabButtonTextActive: { color: Color.goldForeground },
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
      borderColor: "transparent",
      backgroundColor: Color.surface2,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4 },
    contextChipText: { fontSize: 13, fontWeight: "500", color: Color.textSecondary },
    contextChipValue: { fontWeight: "700", color: Color.textPrimary },
    thread: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    emptyState: { alignItems: "center", paddingVertical: Spacing.xxl },
    emptyTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
    emptySub: { fontSize: 14, color: Color.textMuted, marginTop: 4, textAlign: "center", maxWidth: 260 },
    bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { alignSelf: "flex-end", backgroundColor: Color.gold, borderBottomRightRadius: 6 },
    bubbleAssistant: { alignSelf: "flex-start", backgroundColor: Color.surface2, borderBottomLeftRadius: 6 },
    bubbleUserText: { fontSize: 16, color: Color.goldForeground, lineHeight: 22 },
    bubbleAssistantText: { fontSize: 16, color: Color.textPrimary, lineHeight: 22 },
    bubbleTime: { fontSize: 12, color: Color.textFaint, marginTop: 4 },
    bubbleTimeUser: { color: Color.goldForeground, opacity: 0.6 },
    unavailableCard: { margin: Spacing.lg, padding: Spacing.lg, alignItems: "center", gap: Spacing.xs },
    unavailableTitle: { fontSize: 14, fontWeight: "600", color: Color.textPrimary, marginTop: 4 },
    unavailableSub: { fontSize: 14, color: Color.textMuted, textAlign: "center" },
    error: { fontSize: 13, color: Color.danger, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
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
      borderRadius: 22,
      backgroundColor: Color.surface2,
      color: Color.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      maxHeight: 120,
    },
    sendButton: {
      backgroundColor: Color.gold,
      borderRadius: 22,
      paddingHorizontal: 18,
      minHeight: 46,
      justifyContent: "center",
    },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { fontSize: 16, fontWeight: "600", color: Color.goldForeground },
  })
);

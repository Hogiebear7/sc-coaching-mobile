import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/auth-context";
import { useNutrition, useSendNutritionCoachMessage, type FoodItem, type NutritionAiMessage } from "@/lib/queries/nutrition";

function FoodChip({ item }: { item: FoodItem }) {
  return (
    <View style={styles.foodChip}>
      <Text style={styles.foodChipText}>{item.name}</Text>
    </View>
  );
}

function CoachChat({
  configured,
  initialMessages,
}: {
  configured: boolean;
  initialMessages: NutritionAiMessage[];
}) {
  const [messages, setMessages] = useState<NutritionAiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendNutritionCoachMessage();
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current && initialMessages.length > 0) {
      setMessages(initialMessages);
      seeded.current = true;
    }
  }, [initialMessages]);

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
      <Card style={styles.chatCard}>
        <Text style={styles.chatUnavailable}>AI Nutrition Coach isn&apos;t available right now.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.chatCard}>
      <Text style={styles.chatTitle}>AI Nutrition Coach</Text>
      <View style={styles.chatMessages}>
        {messages.length === 0 ? (
          <Text style={styles.chatEmpty}>
            Ask about meal timing, fuelling for a session, or your macros — grounded in your own training and
            recovery data.
          </Text>
        ) : (
          messages.slice(-12).map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>{m.content}</Text>
            </View>
          ))
        )}
        {send.isPending ? <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.sm }} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.chatInputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask the coach…"
          placeholderTextColor={Color.textFaint}
          style={styles.chatInput}
          multiline
          onSubmitEditing={handleSend}
        />
        <Pressable onPress={handleSend} disabled={send.isPending || !input.trim()} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function NutritionScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useNutrition();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load nutrition data.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const allFoods = [...data.foodRecommendations.protein, ...data.foodRecommendations.carb, ...data.foodRecommendations.snack];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Color.gold} />}
        >
          <Text style={styles.heading}>Nutrition</Text>

          <Card style={styles.contextCard}>
            <Text style={styles.contextTitle}>{data.dietarySummary.preferenceLabel} diet</Text>
            {data.dietarySummary.exclusions.length > 0 ? (
              <Text style={styles.contextSub}>Excluding {data.dietarySummary.exclusions.join(", ")}</Text>
            ) : null}
            <View style={styles.contextRow}>
              <View style={styles.contextStat}>
                <Text style={styles.contextValue}>{data.readinessScore ?? "—"}</Text>
                <Text style={styles.contextLabel}>readiness</Text>
              </View>
              <View style={styles.contextStat}>
                <Text style={styles.contextValue}>{data.daysWithLoad > 0 ? data.sevenDayLoad : "—"}</Text>
                <Text style={styles.contextLabel}>7-day load</Text>
              </View>
              <View style={styles.contextStat}>
                <Text style={styles.contextValue}>{data.bodyWeightKg ?? "—"}</Text>
                <Text style={styles.contextLabel}>kg</Text>
              </View>
            </View>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPORTS DRINK CALCULATOR</Text>
            <Card style={styles.comingSoonCard}>
              <Text style={styles.comingSoonText}>
                Coming soon on mobile — available now on the web app.
              </Text>
            </Card>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FOOD IDEAS</Text>
            <View style={styles.foodGrid}>
              {allFoods.slice(0, 18).map((f) => (
                <FoodChip key={f.name} item={f} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <CoachChat configured={data.aiNutritionCoachConfigured} initialMessages={data.initialAiNutritionMessages} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "italic",
    color: Color.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  contextCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  contextTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary },
  contextSub: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Color.borderSubtle,
  },
  contextStat: { alignItems: "center" },
  contextValue: { fontSize: 16, fontWeight: "700", color: Color.gold, fontVariant: ["tabular-nums"] },
  contextLabel: { fontSize: 10, color: Color.textMuted, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: Color.textMuted,
    marginBottom: Spacing.sm,
  },
  comingSoonCard: { padding: Spacing.md },
  comingSoonText: { fontSize: 12, color: Color.textMuted },
  foodGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  foodChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  foodChipText: { fontSize: 11, color: Color.textSecondary },
  chatCard: { padding: Spacing.md },
  chatTitle: { fontSize: 15, fontWeight: "600", color: Color.textPrimary, marginBottom: Spacing.sm },
  chatUnavailable: { fontSize: 12, color: Color.textMuted },
  chatMessages: { minHeight: 60, marginBottom: Spacing.sm },
  chatEmpty: { fontSize: 12, color: Color.textMuted, lineHeight: 17 },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs, maxWidth: "85%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Color.goldWeak },
  bubbleAssistant: { alignSelf: "flex-start", backgroundColor: Color.surface2 },
  bubbleUserText: { fontSize: 13, color: Color.gold },
  bubbleAssistantText: { fontSize: 13, color: Color.textSecondary },
  error: { fontSize: 11, color: Color.danger, marginBottom: Spacing.xs },
  chatInputRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-end" },
  chatInput: {
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
  sendButtonText: { fontSize: 12, fontWeight: "700", color: Color.goldForeground },
});

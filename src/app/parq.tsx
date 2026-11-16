import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { KeyboardAwareScroll } from "@/components/ui/KeyboardAwareScroll";
import { TextField } from "@/components/ui/TextField";
import { headline, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useParq, useSubmitParq } from "@/lib/queries/parq";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

type Answers = Record<string, { yes: boolean | null; note: string }>;

// The quick health check (PAR-Q) a gym member completes before booking a class. Opened when the server says "parq_required" on a booking. The wording
// comes from the server. A Yes never blocks booking: it tells the coach to have a chat first.
export default function ParqScreen() {
  const styles = useStyles();
  const Color = useLegacyColors();
  const router = useRouter();
  const { data: form, isLoading, isError } = useParq();
  const submit = useSubmitParq();
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState<string | null>(null);

  function setYes(id: string, yes: boolean) {
    tapFeedback();
    setAnswers((a) => ({ ...a, [id]: { yes, note: a[id]?.note ?? "" } }));
  }
  function setNote(id: string, note: string) {
    setAnswers((a) => ({ ...a, [id]: { yes: a[id]?.yes ?? true, note } }));
  }

  async function save() {
    if (!form) return;
    setError(null);
    if (form.questions.some((q) => answers[q.id]?.yes == null)) return setError("Please answer every question with Yes or No.");
    if (!consent) return setError("Please tick the box to agree to us storing your answers.");
    if (!declaration) return setError("Please confirm your answers are true to the best of your knowledge.");
    try {
      await submit.mutateAsync({
        answers: Object.fromEntries(form.questions.map((q) => [q.id, { yes: answers[q.id].yes === true, note: answers[q.id].note.trim() }])),
        consent,
        declaration,
        guardianName: guardian.trim() || undefined,
      });
      successFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} />
        </View>
      </SafeAreaView>
    );
  }
  if (isError || !form) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFill}>
          <Text style={styles.hint}>The health check isn't available right now. Please try again later.</Text>
          <Button title="Back" onPress={() => router.back()} variant="secondary" style={{ marginTop: Spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>BEFORE YOUR FIRST SESSION</Text>
        <Text style={styles.title}>Quick health check</Text>
        <Text style={styles.hint}>{form.intro}</Text>

        {form.questions.map((q, i) => {
          const a = answers[q.id];
          return (
            <View key={q.id} style={styles.question}>
              <Text style={styles.qText}>
                {i + 1}. {q.text}
              </Text>
              <View style={styles.yesNo} accessibilityRole="radiogroup">
                {([true, false] as const).map((v) => {
                  const active = a?.yes === v;
                  return (
                    <Pressable
                      key={String(v)}
                      onPress={() => setYes(q.id, v)}
                      style={[styles.choice, active && styles.choiceActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${v ? "Yes" : "No"} to question ${i + 1}`}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{v ? "Yes" : "No"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {a?.yes ? (
                <TextField
                  label="A few words (optional)"
                  value={a.note}
                  onChangeText={(t) => setNote(q.id, t)}
                  placeholder="What should your coach know?"
                  maxLength={300}
                  style={{ marginTop: Spacing.sm }}
                />
              ) : null}
            </View>
          );
        })}

        <TextField
          label="If you are under 18: parent or guardian name"
          value={guardian}
          onChangeText={setGuardian}
          placeholder="Optional"
          style={{ marginTop: Spacing.lg }}
        />

        <Pressable onPress={() => setConsent((v) => !v)} style={styles.tickRow} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
          <Ionicons name={consent ? "checkbox" : "square-outline"} size={24} color={consent ? Color.gold : Color.textMuted} />
          <Text style={styles.tickText}>{form.consent}</Text>
        </Pressable>
        <Pressable onPress={() => setDeclaration((v) => !v)} style={styles.tickRow} accessibilityRole="checkbox" accessibilityState={{ checked: declaration }}>
          <Ionicons name={declaration ? "checkbox" : "square-outline"} size={24} color={declaration ? Color.gold : Color.textMuted} />
          <Text style={styles.tickText}>{form.declaration}</Text>
        </Pressable>

        <Text style={styles.footer}>{form.footer}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Save my answers" onPress={save} loading={submit.isPending} style={{ marginTop: Spacing.lg }} />
        <Button title="Not now" onPress={() => router.back()} variant="secondary" style={{ marginTop: Spacing.sm }} />
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Color.bg0 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
    eyebrow: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: Color.gold, marginBottom: Spacing.sm },
    title: { ...headline(36), color: Color.textPrimary },
    hint: { fontSize: 14, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 20 },
    question: { marginTop: Spacing.xl },
    qText: { fontSize: 16, lineHeight: 22, color: Color.textPrimary, fontWeight: "500" },
    yesNo: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    choice: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface2 },
    choiceActive: { backgroundColor: Color.gold },
    choiceText: { fontSize: 16, fontWeight: "600", color: Color.textMuted },
    choiceTextActive: { color: Color.goldForeground },
    tickRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start", marginTop: Spacing.lg },
    tickText: { flex: 1, fontSize: 14, lineHeight: 20, color: Color.textSecondary },
    footer: { fontSize: 13, color: Color.textMuted, marginTop: Spacing.lg, lineHeight: 19 },
    error: { color: Color.danger, fontSize: 14, marginTop: Spacing.md },
  })
);

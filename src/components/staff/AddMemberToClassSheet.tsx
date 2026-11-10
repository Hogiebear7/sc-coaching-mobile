import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TextField } from "@/components/ui/TextField";
import { Spacing } from "@/constants/theme";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { useStaffMembers, type StaffClassSummary, type StaffMemberSummary } from "@/lib/queries/staff";
import { useBookMemberIntoClass } from "@/lib/queries/staff-community";
import { bookOutcomeTitle, bookableMembers } from "@/lib/staff-summary-format";
import { makeLegacyStyles, useLegacyColors } from "@/lib/theme";

// A coach books a member into a class on their behalf (for example someone who can't use the app). Every rule the member's own booking applies still applies
// on the server: their membership must be active, they need an emergency contact on file, the class must suit their plan, and they need a session left. A full
// class puts them on the waitlist (up to 2 deep); a full waitlist is refused. The server's own message is shown for every refusal.
export function AddMemberToClassSheet({
  visible,
  onClose,
  classItem,
}: {
  visible: boolean;
  onClose: () => void;
  classItem: StaffClassSummary;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const insets = useSafeAreaInsets();
  const members = useStaffMembers();
  const book = useBookMemberIntoClass();
  const [query, setQuery] = useState("");

  const full = classItem.bookedCount >= classItem.capacity;
  const list = bookableMembers(members.data ?? [], classItem, query);

  function close() {
    setQuery("");
    onClose();
  }

  function confirm(member: StaffMemberSummary) {
    tapFeedback();
    const name = member.fullName ?? member.email;
    Alert.alert(
      full ? `Add ${name} to the waitlist?` : `Book ${name} in?`,
      full
        ? `${classItem.title} is full. ${name} will join the waitlist and get an offer if a space opens. They are told either way.`
        : `${name} will be booked into ${classItem.title}. They get the normal booking confirmation.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: full ? "Add to waitlist" : "Book in",
          onPress: () =>
            book.mutate(
              { classId: classItem.id, userId: member.userId },
              {
                onSuccess: (r) => {
                  successFeedback();
                  close();
                  Alert.alert(bookOutcomeTitle(r.outcome), r.message);
                },
                onError: (e) => Alert.alert("Couldn't book them in", e.message),
              }
            ),
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.screen, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{full ? "Add to waitlist" : "Book a member in"}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {classItem.title} · {classItem.bookedCount}/{classItem.capacity}
              {full ? " · full" : ""}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={12} style={styles.done} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <TextField label="Find a member" value={query} onChangeText={setQuery} placeholder="Name, email or phone" autoCorrect={false} autoCapitalize="none" />
        </View>

        {members.isLoading ? (
          <ActivityIndicator color={Color.gold} style={{ marginTop: Spacing.lg }} />
        ) : members.isError ? (
          <Text style={styles.empty}>Couldn&apos;t load members. {members.error.message}</Text>
        ) : list.length === 0 ? (
          <Text style={styles.empty}>{query.trim() ? "No matching members." : "Everyone is already booked in."}</Text>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(m) => m.userId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => confirm(item)}
                disabled={book.isPending}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Book ${item.fullName ?? item.email}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.fullName ?? item.email}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.currentPlanName ?? "No current plan"}
                    {item.membershipGroup === "paused" ? " · paused" : item.membershipGroup === "past" ? " · past member" : ""}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={Color.gold} />
              </Pressable>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Color.bg0 },
    header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    title: { fontSize: 20, fontWeight: "700", color: Color.textPrimary },
    sub: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
    done: { minHeight: 44, justifyContent: "center" },
    doneText: { fontSize: 16, fontWeight: "600", color: Color.gold },
    searchWrap: { paddingHorizontal: Spacing.lg },
    empty: { fontSize: 14, color: Color.textMuted, textAlign: "center", marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, minHeight: 60, borderTopWidth: 1, borderTopColor: Color.borderSubtle },
    name: { fontSize: 16, fontWeight: "600", color: Color.textPrimary },
    meta: { fontSize: 13, color: Color.textMuted, marginTop: 2 },
  })
);

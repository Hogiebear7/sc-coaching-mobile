import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton, SectionTitle } from "@/components/app/primitives";
import { AppRadius, AppSpace, appTitle } from "@/constants/theme";
import { tapFeedback } from "@/lib/haptics";
import { openMembershipOnWeb } from "@/lib/membership-web";
import { useMembership } from "@/lib/queries/membership";
import { makeStyles, useAppTheme } from "@/lib/theme";

// S&C's own gym page: who we are, what we offer, and the way in. Replaces
// Find a coach while S&C is the only gym (multi-gym search returns in
// Track 2). Memberships are bought on the website (in-person services may be
// paid outside the app); the app shows no prices or purchase flow itself.
// Details mirror gym-app's lib/content.ts and lib/marketing-classes.ts.
const GYM = {
  name: "S&C Performance Coaching",
  intro: "Small-group strength and conditioning coaching in Navan, Co. Meath.",
  location: "Navan, Co. Meath",
  email: "info@sandccoaching.com",
  phone: "083 007 9025",
  phoneHref: "+353830079025",
  mapsQuery: "S&C Performance Coaching, Navan, Co. Meath",
};

const OFFERS: { name: string; text: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    name: "Semi-Private Personal Training",
    text: "Strength, technique and progression, with individual attention in a small group.",
    icon: "barbell-outline",
  },
  { name: "Parent & Baby Classes", text: "Rebuild strength after birth, with your baby beside you.", icon: "heart-outline" },
  { name: "Over 50s", text: "Stay strong, mobile and independent for the long term.", icon: "walk-outline" },
];

const HOW: { title: string; text: string }[] = [
  { title: "Your goals, not a template", text: "Your first session sets your goals and baseline, then shapes the block that follows." },
  { title: "Capped coaching ratios", text: "Small groups on purpose, so every rep gets watched and every cue is for you." },
  { title: "A plan that adapts", text: "Adjusted as your lifts, readiness and recovery change, using what you log in this app." },
];

export default function GymScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { data: membership } = useMembership();
  const isMember = !!membership?.currentPlanName && membership.subscriptionStatus === "active" && !membership.isPeriodLapsed;

  function open(url: string) {
    tapFeedback();
    void Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{GYM.name}</Text>
        <Text style={styles.intro}>{GYM.intro}</Text>

        <View style={styles.actions}>
          <PillButton
            title={isMember ? "Manage membership" : "Join – see memberships"}
            onPress={() => {
              tapFeedback();
              void openMembershipOnWeb();
            }}
          />
          <PillButton title="See the timetable" variant="secondary" onPress={() => router.push("/(tabs)/schedule")} />
        </View>
        <Text style={styles.note}>
          {isMember
            ? "Manage your plan, class packs and passes on our website."
            : "Memberships, class packs and passes are bought on our website, already signed in. Come back here to book your classes."}
        </Text>

        <View style={styles.section}>
          <SectionTitle title="What we offer" />
          <View style={styles.card}>
            {OFFERS.map((o, i) => (
              <View key={o.name} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.icon}>
                  <Ionicons name={o.icon} size={20} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{o.name}</Text>
                  <Text style={styles.rowText}>{o.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="How we coach" />
          <View style={styles.card}>
            {HOW.map((h, i) => (
              <View key={h.title} style={[styles.rowPlain, i > 0 && styles.divider]}>
                <Text style={styles.rowTitle}>{h.title}</Text>
                <Text style={styles.rowText}>{h.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Find us" />
          <View style={styles.card}>
            <ContactRow icon="location-outline" label={GYM.location} sub="Open in Maps" onPress={() => open(`https://maps.google.com/?q=${encodeURIComponent(GYM.mapsQuery)}`)} />
            <ContactRow icon="call-outline" label={GYM.phone} sub="Call us" onPress={() => open(`tel:${GYM.phoneHref}`)} divider />
            <ContactRow icon="mail-outline" label={GYM.email} sub="Email us" onPress={() => open(`mailto:${GYM.email}`)} divider />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({
  icon,
  label,
  sub,
  onPress,
  divider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, divider && styles.divider]} accessibilityRole="button" accessibilityLabel={`${sub}: ${label}`}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowText}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: AppSpace.gutter, paddingVertical: 8 },
    backButton: { width: 40, height: 40, justifyContent: "center" },
    scroll: { paddingHorizontal: AppSpace.gutter, paddingBottom: 48 },
    title: { ...appTitle(36, c.text) },
    intro: { fontSize: 16, lineHeight: 23, color: c.textMuted, marginTop: 8 },
    actions: { gap: AppSpace.gap, marginTop: 20 },
    note: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginTop: 10 },
    section: { marginTop: AppSpace.section },
    card: { backgroundColor: c.surface, borderRadius: AppRadius.card, paddingHorizontal: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, minHeight: 56 },
    rowPlain: { paddingVertical: 14 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
    icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontSize: 16, fontWeight: "600", color: c.text },
    rowText: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginTop: 2 },
  })
);

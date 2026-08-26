import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Spacing, FontSize } from "@/constants/theme";
import { Card } from "./Card";

// Shared "you don't have this yet" treatment for Free-tier gating (see
// src/lib/member-access.ts) — used wherever a feature is shown but disabled
// with upsell copy, rather than hidden outright (per the settings/
// notifications answer: "Visible but disabled, with upsell copy").
// Features that should be hidden entirely for Free (Generate/Import tool
// cards, MORE TOOLS section, search box) don't use this — they're just
// conditionally not rendered at the call site.

const UPGRADE_COPY = "Available on App Subscription and above";

// A settings-style row (icon + title + sub), greyed out, tappable through to
// the membership screen. Matches the shape of settings.tsx's local `Row`.
export function UpsellRow({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push("/membership")} style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={Color.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{UPGRADE_COPY}</Text>
      </View>
      <View style={styles.badge}>
        <Ionicons name="lock-closed" size={11} color={Color.gold} />
        <Text style={styles.badgeText}>Upgrade</Text>
      </View>
    </Pressable>
  );
}

// Full-card replacement for a locked section (e.g. a tool card, or a whole
// "MORE TOOLS" block) — tappable through to the membership screen.
export function UpsellCard({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push("/membership")}>
      <Card tier="compact" style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={18} color={Color.textFaint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardBody}>{body ?? UPGRADE_COPY}</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="lock-closed" size={11} color={Color.gold} />
          <Text style={styles.badgeText}>Upgrade</Text>
        </View>
      </Card>
    </Pressable>
  );
}

// Squarish icon+label tile matching a tool-grid cell (e.g. Workouts tab's
// TOOLS row) — the row/card shapes above don't fit that grid, so this is a
// third shared shape rather than one-off inline styling per screen.
export function UpsellTile({
  title,
  style,
}: {
  title: string;
  style?: object;
}) {
  const router = useRouter();

  return (
    <Card tier="compact" style={style}>
      <Pressable onPress={() => router.push("/membership")} style={styles.tileInner}>
        <Ionicons name="lock-closed" size={14} color={Color.textFaint} />
        <Text style={styles.tileText}>{title}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  tileInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    opacity: 0.55,
  },
  tileText: {
    fontSize: 12,
    fontWeight: "600",
    color: Color.textFaint,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    opacity: 0.6,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Color.textSecondary,
  },
  rowSub: {
    fontSize: FontSize.xs,
    color: Color.textFaint,
    marginTop: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
    opacity: 0.7,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Color.textSecondary,
  },
  cardBody: {
    fontSize: FontSize.xs,
    color: Color.textFaint,
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Color.goldWeak,
    borderWidth: 1,
    borderColor: Color.goldBorder,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Color.gold,
  },
});

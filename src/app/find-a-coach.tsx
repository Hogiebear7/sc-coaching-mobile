import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { useNearbyGyms, type NearbyGym } from "@/lib/queries/gyms";

type Status = "idle" | "requesting" | "denied" | "ready" | "error";

function formatDistance(km: number): string {
  return km < 1 ? "Less than 1 km away" : `${Math.round(km)} km away`;
}

function GymRow({ gym }: { gym: NearbyGym }) {
  return (
    <Card style={styles.gymCard} tier={gym.recommended ? "standard" : "quiet"} accent={gym.recommended}>
      {gym.recommended ? (
        <View style={styles.recommendedBadge}>
          <Ionicons name="star" size={11} color={Color.gold} />
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      ) : null}
      <Text style={styles.gymName}>{gym.name}</Text>
      {gym.tagline ? <Text style={styles.gymTagline}>{gym.tagline}</Text> : null}
      <Text style={styles.gymDistance}>{formatDistance(gym.distanceKm)}</Text>
      <Text style={styles.gymAddress}>{gym.addressLine}</Text>
      <View style={styles.gymActions}>
        {gym.contactPhone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${gym.contactPhone}`)} style={styles.gymActionButton}>
            <Ionicons name="call-outline" size={14} color={Color.gold} />
            <Text style={styles.gymActionText}>Call</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Linking.openURL(`mailto:${gym.contactEmail}`)} style={styles.gymActionButton}>
          <Ionicons name="mail-outline" size={14} color={Color.gold} />
          <Text style={styles.gymActionText}>Email</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function FindACoachScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { data: gyms, isLoading, isError, error } = useNearbyGyms(coords);

  async function requestLocation() {
    setStatus("requesting");
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Find a coach</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <BrandMark height={22} style={styles.logo} />
        <Text style={styles.title}>Gyms and coaches near you</Text>
        <Text style={styles.hint}>
          Share your location to see the nearest S&C-network gyms and coaches, closest first.
        </Text>

        {status === "requesting" ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : status === "denied" ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>
              Location access is off, so nearby gyms can&apos;t be shown. Enable it in your device settings to
              use this.
            </Text>
            <Button title="Try again" onPress={requestLocation} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : status === "error" || isError ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>
              {error instanceof ApiError ? error.message : "Couldn't find your location. Try again."}
            </Text>
            <Button title="Try again" onPress={requestLocation} variant="secondary" style={{ marginTop: Spacing.md }} />
          </View>
        ) : isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : !gyms || gyms.length === 0 ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>No gyms found nearby yet.</Text>
          </View>
        ) : (
          <View style={styles.gymList}>
            {gyms.map((gym) => (
              <GymRow key={gym.id} gym={gym} />
            ))}
          </View>
        )}
      </ScrollView>
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
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  logo: { marginBottom: Spacing.md },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Color.textPrimary,
    fontStyle: "italic",
  },
  hint: {
    fontSize: 13,
    color: Color.textMuted,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    lineHeight: 19,
  },
  centerFill: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xxl },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  gymList: { gap: Spacing.md },
  gymCard: { padding: Spacing.lg },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Color.goldWeak,
    borderWidth: 1,
    borderColor: Color.goldBorder,
    marginBottom: Spacing.sm,
  },
  recommendedText: { fontSize: 11, fontWeight: "700", color: Color.gold },
  gymName: { fontSize: 17, fontWeight: "700", color: Color.textPrimary },
  gymTagline: { fontSize: 13, color: Color.textMuted, marginTop: 4, lineHeight: 18 },
  gymDistance: { fontSize: 13, fontWeight: "600", color: Color.gold, marginTop: Spacing.sm },
  gymAddress: { fontSize: 12, color: Color.textFaint, marginTop: 2 },
  gymActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  gymActionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  gymActionText: { fontSize: 13, fontWeight: "600", color: Color.gold },
});

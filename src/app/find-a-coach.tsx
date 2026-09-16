import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Color, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import {
  isGeocodeCandidateList,
  useGeocodeLocation,
  useNearbyGyms,
  type GeocodeCandidate,
  type NearbyGym,
} from "@/lib/queries/gyms";

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
  // Set only when coords came from the manual search box below, not device
  // GPS — used to caption the results list so it's clear what "near you"
  // actually means right now.
  const [searchedLabel, setSearchedLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Set only when a search came back genuinely ambiguous (2+ real distinct
  // places — see gym-app's geocode route for the exact rule). Showing the
  // form and a candidate list at once would be cluttered, so picking one
  // replaces the other rather than layering.
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const { data: gyms, isLoading, isError, error } = useNearbyGyms(coords);
  const geocode = useGeocodeLocation();

  async function requestLocation() {
    setStatus("requesting");
    setSearchedLabel(null);
    setCandidates(null);
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

  // The one place coords/searchedLabel get set from a manual search —
  // always a single, already-disambiguated candidate, never a raw geocode
  // response. No distance is ever computed before this runs (useNearbyGyms
  // stays disabled until coords exists).
  function selectLocation(candidate: GeocodeCandidate) {
    setCoords({ lat: candidate.lat, lng: candidate.lng });
    setSearchedLabel(candidate.label);
    setCandidates(null);
    setStatus("ready");
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query || geocode.isPending) return;
    setCandidates(null);
    try {
      const result = await geocode.mutateAsync(query);
      if (isGeocodeCandidateList(result)) {
        setCandidates(result.candidates);
        return;
      }
      selectLocation(result);
    } catch {
      // geocode.error already carries the message — rendered below.
    }
  }

  // "Search another area" from the no-results state — returns to the same
  // manual-search entry point as a failed device-location lookup, rather
  // than inventing a second UI for the same job.
  function resetToSearch() {
    setCoords(null);
    setSearchedLabel(null);
    setCandidates(null);
    setSearchQuery("");
    setStatus("denied");
  }

  useEffect(() => {
    requestLocation();
  }, []);

  const showSearchFallback = status === "denied" || status === "error" || isError;

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
        ) : showSearchFallback ? (
          <View>
            <View style={styles.centerFillTight}>
              {status === "denied" ? (
                <>
                  <Text style={styles.errorHeading}>Location access is off</Text>
                  <Text style={styles.errorText}>
                    Enable location to find nearby gyms, or search for a town, city or postcode below.
                  </Text>
                </>
              ) : (
                <Text style={styles.errorText}>
                  {error instanceof ApiError ? error.message : "Couldn't find your location. Try again, or search an area below."}
                </Text>
              )}
              <Button title="Try again" onPress={requestLocation} variant="secondary" style={{ marginTop: Spacing.sm }} />
            </View>

            {candidates ? (
              <View>
                <Text style={styles.candidatesHeading}>
                  A few places match &ldquo;{searchQuery.trim()}&rdquo; — choose one:
                </Text>
                <View style={styles.candidatesList}>
                  {candidates.map((candidate, i) => (
                    <Pressable key={i} onPress={() => selectLocation(candidate)} style={styles.candidateRow}>
                      <Ionicons name="location-outline" size={16} color={Color.gold} />
                      <Text style={styles.candidateLabel}>{candidate.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setCandidates(null)} hitSlop={8} style={styles.candidatesBack}>
                  <Text style={styles.candidatesBackText}>Search again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Search an area"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search town, city or postcode"
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                    />
                  </View>
                  <Button
                    title="Search"
                    onPress={handleSearch}
                    loading={geocode.isPending}
                    disabled={!searchQuery.trim() || geocode.isPending}
                    style={styles.searchButton}
                  />
                </View>
                {geocode.isError ? (
                  <Text style={[styles.errorText, styles.searchError]}>
                    {geocode.error instanceof ApiError ? geocode.error.message : "Couldn't search that area. Try again."}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ) : isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Color.gold} size="large" />
          </View>
        ) : !gyms || gyms.length === 0 ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorHeading}>No gyms or coaches found nearby</Text>
            <Text style={styles.errorText}>Try a nearby town or postcode, or browse digital coaching from S&C.</Text>
            <Button title="Search another area" onPress={resetToSearch} variant="secondary" style={{ marginTop: Spacing.md }} />
            <Pressable onPress={() => router.push("/membership")} hitSlop={8} style={styles.noResultsSecondary}>
              <Text style={styles.noResultsSecondaryText}>See S&C app plans</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {searchedLabel ? <Text style={styles.searchedLabel}>Showing results near {searchedLabel}</Text> : null}
            <View style={styles.gymList}>
              {gyms.map((gym) => (
                <GymRow key={gym.id} gym={gym} />
              ))}
            </View>
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
  // ~25% less vertical padding than centerFill — used for the denied/error
  // fallback specifically, since the search form now sits directly below it
  // and the original gap read as too loose once that form became the clear
  // primary path rather than an afterthought.
  centerFillTight: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xl },
  errorHeading: {
    color: Color.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  errorText: { color: Color.textMuted, fontSize: 14, textAlign: "center" },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    // ~25% less than the original Spacing.lg — matches centerFillTight's
    // reduction so the whole fallback state feels like one tightened block.
    marginTop: Spacing.md,
  },
  searchButton: { height: 48 },
  searchError: { marginTop: Spacing.sm, textAlign: "left" },
  searchedLabel: {
    fontSize: 12,
    color: Color.textFaint,
    marginBottom: Spacing.md,
  },
  candidatesHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: Color.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  candidatesList: { gap: Spacing.xs },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
  },
  candidateLabel: { flex: 1, fontSize: 13, color: Color.textPrimary, lineHeight: 18 },
  candidatesBack: { marginTop: Spacing.sm, alignSelf: "center", padding: Spacing.xs },
  candidatesBackText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
  noResultsSecondary: { marginTop: Spacing.sm },
  noResultsSecondaryText: { fontSize: 13, fontWeight: "600", color: Color.gold },
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

import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface NearbyGym {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  contactEmail: string;
  contactPhone: string | null;
  addressLine: string;
  distanceKm: number;
  recommended: boolean;
}

interface NearbyGymsResponse {
  success: true;
  data: NearbyGym[];
}

// Mirrors gym-app's ALLOWED_RADIUS_KM/DEFAULT_RADIUS_KM
// (app/api/mobile/gyms/nearby/route.ts) — kept as a plain duplicate literal
// rather than a shared import, matching this codebase's existing
// PRIMARY_GYM_SLUG/APP_SUBSCRIPTION_PACKAGE_SLUG precedent for small
// cross-repo constants that can't be imported directly.
export const ALLOWED_RADIUS_KM = [25, 50, 100] as const;
export type RadiusKm = (typeof ALLOWED_RADIUS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 25;

// Disabled until real coordinates are available (see find-a-coach.tsx's
// location-permission flow) — there's no meaningful "nearby" without them,
// and firing the request early would just 400.
export function useNearbyGyms(coords: { lat: number; lng: number } | null, radiusKm: RadiusKm = DEFAULT_RADIUS_KM) {
  return useQuery({
    queryKey: ["gyms-nearby", coords?.lat, coords?.lng, radiusKm],
    queryFn: () =>
      apiFetch<NearbyGymsResponse>(
        `/api/mobile/gyms/nearby?lat=${encodeURIComponent(coords!.lat)}&lng=${encodeURIComponent(coords!.lng)}&radiusKm=${radiusKm}`
      ).then((r) => r.data),
    enabled: coords !== null,
  });
}

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  label: string;
}

// A single unambiguous match resolves directly; two or more real candidates
// (e.g. "Navan" — genuinely a place in Canada, two counties in Ireland,
// Northern Ireland, and Norway) come back for the caller to disambiguate
// instead of the server guessing. See gym-app's geocode route for the exact
// rule (candidate count from Nominatim, not a scoring heuristic).
export type GeocodeResult = GeocodeCandidate | { candidates: GeocodeCandidate[] };

interface GeocodeResponse {
  success: true;
  data: GeocodeResult;
}

export function isGeocodeCandidateList(
  result: GeocodeResult
): result is { candidates: GeocodeCandidate[] } {
  return "candidates" in result;
}

// Manual fallback for find-a-coach.tsx when device location is denied or
// unavailable — turns a typed place name into coordinates via the same
// nearby-search flow device GPS feeds, so there's only one results path to
// render either way.
export function useGeocodeLocation() {
  return useMutation({
    mutationFn: (query: string) =>
      apiFetch<GeocodeResponse>(`/api/mobile/gyms/geocode?q=${encodeURIComponent(query)}`).then((r) => r.data),
  });
}

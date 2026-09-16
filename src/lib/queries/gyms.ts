import { useQuery } from "@tanstack/react-query";

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

// Disabled until real coordinates are available (see find-a-coach.tsx's
// location-permission flow) — there's no meaningful "nearby" without them,
// and firing the request early would just 400.
export function useNearbyGyms(coords: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ["gyms-nearby", coords?.lat, coords?.lng],
    queryFn: () =>
      apiFetch<NearbyGymsResponse>(
        `/api/mobile/gyms/nearby?lat=${encodeURIComponent(coords!.lat)}&lng=${encodeURIComponent(coords!.lng)}`
      ).then((r) => r.data),
    enabled: coords !== null,
  });
}

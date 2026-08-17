import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors ExerciseLibraryRecord/ExerciseMediaRecord in the main repo's
// lib/exercise-library/types.ts.
export interface ExerciseLibraryRecord {
  id: string;
  source: string;
  sourceId: string | null;
  slug: string;
  name: string;
  aliases: string[];
  bodyPart: string | null;
  targetMuscle: string | null;
  secondaryMuscles: string[];
  equipment: string | null;
  category: string | null;
  difficulty: string | null;
  description: string | null;
  instructions: string[];
  isCustom: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseMediaRecord {
  id: string;
  exerciseId: string;
  kind: string;
  resolution: string | null;
  storagePath: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  createdAt: string;
}

interface ExerciseLibraryListResponse {
  success: true;
  exercises: ExerciseLibraryRecord[];
  filters: { bodyParts: string[]; equipment: string[]; categories: string[] };
}

export function useExerciseLibrary() {
  return useQuery({
    queryKey: ["exercise-library"],
    queryFn: () => apiFetch<ExerciseLibraryListResponse>("/api/exercise-library").then((r) => r),
  });
}

interface RelatedExerciseRef {
  id: string;
  name: string;
  slug: string | null;
}

interface ExerciseLibraryDetailResponse {
  success: true;
  exercise: ExerciseLibraryRecord;
  media: ExerciseMediaRecord[];
  favorited: boolean;
  related: {
    similarExercises: RelatedExerciseRef[];
    substitutions: RelatedExerciseRef[];
    progressions: RelatedExerciseRef[];
    regressions: RelatedExerciseRef[];
  };
}

export function useExerciseLibraryDetail(slug: string) {
  return useQuery({
    queryKey: ["exercise-library", slug],
    queryFn: () =>
      apiFetch<ExerciseLibraryDetailResponse>(`/api/exercise-library/${encodeURIComponent(slug)}`).then((r) => r),
    enabled: !!slug,
  });
}

// Same "prefer a mid-size render, not the largest" pick as the web app's
// ExerciseDetailView.tsx — 720 balances clarity against a mobile data
// connection; 1080 and then whatever's first are fallbacks for a media set
// that's missing that exact resolution.
export function pickHeroMedia(media: ExerciseMediaRecord[]): ExerciseMediaRecord | null {
  return media.find((m) => m.resolution === "720") ?? media.find((m) => m.resolution === "1080") ?? media[0] ?? null;
}

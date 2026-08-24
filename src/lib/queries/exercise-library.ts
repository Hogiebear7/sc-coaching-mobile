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

interface ExerciseLibraryNamesResponse {
  success: true;
  items: { name: string; slug: string }[];
}

export interface ExerciseLibraryNameIndex {
  exact: Map<string, string>;
  items: { name: string; slug: string }[];
}

// Name -> slug lookup, mirroring the web app's WorkoutLogForm.tsx — lets the
// workout logger link "you typed/picked an exercise" straight to its
// demonstration without pulling the full exercise list. Works for any
// exercise in the library, not just the ones seeded so far, so this needs no
// changes as more get imported.
export function useExerciseLibraryNameIndex() {
  return useQuery({
    queryKey: ["exercise-library", "names"],
    queryFn: () =>
      apiFetch<ExerciseLibraryNamesResponse>("/api/exercise-library/names").then(
        (r): ExerciseLibraryNameIndex => ({
          exact: new Map(r.items.map((i) => [i.name.trim().toLowerCase(), i.slug])),
          items: r.items,
        })
      ),
    staleTime: 5 * 60_000,
  });
}

function nameWords(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

// The autocomplete a member types into (log-workout.tsx) draws from a
// separate, coach-curated exercise list used for muscle-group tracking
// (e.g. "Bench Press") — it doesn't share naming with this big imported
// library, which prefixes equipment ("Barbell Bench Press", "Dumbbell Bench
// Press"). An exact match is tried first since it's the common case for
// freeform typing; when that fails, fall back to a whole-word match — every
// word in the shorter name must appear in the longer one — so "Bench Press"
// still resolves to a real demo image instead of showing nothing. Picks the
// closest-length candidate so "Bench Press" prefers "Barbell Bench Press"
// over a much more specific variant.
export function findExerciseLibrarySlug(typed: string, index: ExerciseLibraryNameIndex): string | null {
  const key = typed.trim().toLowerCase();
  if (!key) return null;

  const exact = index.exact.get(key);
  if (exact) return exact;

  const typedWords = nameWords(key);
  if (typedWords.size === 0) return null;

  let best: { slug: string; name: string } | null = null;
  for (const item of index.items) {
    const itemWords = nameWords(item.name);
    const [small, big] = typedWords.size <= itemWords.size ? [typedWords, itemWords] : [itemWords, typedWords];
    let subset = true;
    for (const w of small) {
      if (!big.has(w)) {
        subset = false;
        break;
      }
    }
    if (!subset) continue;
    if (!best || item.name.length < best.name.length) best = item;
  }
  return best?.slug ?? null;
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

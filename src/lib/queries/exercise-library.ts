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
  /** Vendor-supplied classification (mechanic/forceType/primaryRegion/...) —
      the server has always sent this field, it just wasn't typed/used here
      until the compound-first structured workout generator needed it (see
      lib/movement-buckets.ts). */
  taxonomy: Record<string, unknown> | null;
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

// The library only holds the 180 and 360 renders (the 720 and 1080 ones come with ExerciseDB's full pack), and the server lists media smallest
// first. The old pick fell through to "whatever is first", which was the 180 picture, stretched to the full phone width: that was the blur.
// Order of preference for the demonstration: 720, 1080, then the biggest of what is left.
const HERO_PREFERENCE = ["720", "1080"];

function resolutionNumber(m: ExerciseMediaRecord): number {
  const n = parseInt(m.resolution ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

// Your own uploaded clip is a video (kind "video", resolution "own"). The picture picks below only ever look at pictures, since an image view cannot
// show a video; the clip is chosen separately by pickOwnVideo.
const isPicture = (m: ExerciseMediaRecord) => m.kind !== "video";

export function pickOwnVideo(media: ExerciseMediaRecord[]): ExerciseMediaRecord | null {
  return media.find((m) => m.kind === "video" && !!m.url) ?? null;
}

export function pickHeroMedia(media: ExerciseMediaRecord[]): ExerciseMediaRecord | null {
  const pictures = media.filter(isPicture);
  for (const wanted of HERO_PREFERENCE) {
    const hit = pictures.find((m) => m.resolution === wanted);
    if (hit) return hit;
  }
  return [...pictures].sort((a, b) => resolutionNumber(b) - resolutionNumber(a))[0] ?? null;
}

// A small thumbnail (about 50pt, so about 150px on a phone) only needs a small render: the smallest one that is at least 150 wide, else the
// biggest available. Saves data and avoids pulling the 360 file for every row of a long workout.
export function pickThumbMedia(media: ExerciseMediaRecord[]): ExerciseMediaRecord | null {
  const sorted = media.filter(isPicture).sort((a, b) => resolutionNumber(a) - resolutionNumber(b));
  return sorted.find((m) => resolutionNumber(m) >= 150) ?? sorted[sorted.length - 1] ?? null;
}

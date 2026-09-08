import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { WorkoutExerciseEntry, WorkoutRunEntry } from "@/lib/queries/workouts";

// Mirrors gym-app's lib/leaderboard.ts.
export type LeaderboardMetric = "volume" | "squat" | "bench" | "deadlift";

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  value: number;
  bodyweightPct: number | null;
}

export function useLeaderboard(metric: LeaderboardMetric) {
  return useQuery({
    queryKey: ["community-leaderboard", metric],
    queryFn: () =>
      apiFetch<{ success: true; data: { entries: LeaderboardEntry[]; myUserId: string } }>(
        `/api/mobile/community/leaderboard?metric=${metric}`
      ).then((r) => r.data),
  });
}

export interface CommunityFeedItem {
  id: string;
  userId: string;
  authorName: string;
  date: string;
  title: string;
  exercises: WorkoutExerciseEntry[];
  runs: WorkoutRunEntry[];
  sessionRpe: number | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** This session is where the author set an all-time best — drives the
      Community screen's "Member wins" section. */
  isPersonalBest: boolean;
  personalBestExercise: string | null;
  createdAt: string;
}

export function useCommunityFeed() {
  return useQuery({
    queryKey: ["community-feed"],
    queryFn: () =>
      apiFetch<{ success: true; data: { items: CommunityFeedItem[]; hasMore: boolean } }>(
        "/api/mobile/community/feed"
      ).then((r) => r.data),
  });
}

// One feed item by id — backs the /community/workout/[id] deep-link target,
// which doesn't require the item to be on the requester's current feed page.
export function useCommunityWorkoutItem(id: string) {
  return useQuery({
    queryKey: ["community-workout-item", id],
    queryFn: () =>
      apiFetch<{ success: true; data: { item: CommunityFeedItem } }>(`/api/mobile/community/workouts/${id}`).then(
        (r) => r.data.item
      ),
    enabled: !!id,
  });
}

// The ONE thing the Home screen's compact Community module shows — never a
// list. See gym-app's app/api/mobile/community/highlight/route.ts.
export interface CommunityHighlight {
  type: "win" | "leaderboard" | "empty";
  text: string;
  href: string;
}

export function useCommunityHighlight() {
  return useQuery({
    queryKey: ["community-highlight"],
    queryFn: () =>
      apiFetch<{ success: true; data: CommunityHighlight }>("/api/mobile/community/highlight").then((r) => r.data),
  });
}

export interface MemberSearchResult {
  userId: string;
  fullName: string;
  isFollowing: boolean;
}

export function useMemberSearch(query: string) {
  return useQuery({
    queryKey: ["community-search", query],
    queryFn: () =>
      apiFetch<{ success: true; data: { results: MemberSearchResult[] } }>(
        `/api/mobile/community/search?q=${encodeURIComponent(query)}`
      ).then((r) => r.data.results),
    enabled: query.trim().length > 0,
  });
}

// A handful of real members not yet followed — backs the Community screen's
// empty-Activity state so it offers actual people, not just a dead void.
export function useSuggestedMembers() {
  return useQuery({
    queryKey: ["community-suggested-members"],
    queryFn: () =>
      apiFetch<{ success: true; data: { results: MemberSearchResult[] } }>(
        "/api/mobile/community/search?suggested=1"
      ).then((r) => r.data.results),
  });
}

function invalidateFeedAndSearch(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["community-feed"] });
  qc.invalidateQueries({ queryKey: ["community-search"] });
  qc.invalidateQueries({ queryKey: ["community-suggested-members"] });
}

export function useFollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: true }>("/api/mobile/community/follow", { method: "POST", body: { userId } }),
    onSuccess: () => invalidateFeedAndSearch(qc),
  });
}

export function useUnfollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: true }>("/api/mobile/community/unfollow", { method: "POST", body: { userId } }),
    onSuccess: () => invalidateFeedAndSearch(qc),
  });
}

export function useToggleWorkoutLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutSessionId: string) =>
      apiFetch<{ success: true; data: { liked: boolean } }>(
        `/api/mobile/community/workouts/${workoutSessionId}/like`,
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export interface WorkoutComment {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export function useWorkoutComments(workoutSessionId: string) {
  return useQuery({
    queryKey: ["community-comments", workoutSessionId],
    queryFn: () =>
      apiFetch<{ success: true; data: { comments: WorkoutComment[] } }>(
        `/api/mobile/community/workouts/${workoutSessionId}/comments`
      ).then((r) => r.data.comments),
    enabled: !!workoutSessionId,
  });
}

export function usePostComment(workoutSessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; mentionedUserIds?: string[] }) =>
      apiFetch<{ success: true; data: { comment: WorkoutComment } }>(
        `/api/mobile/community/workouts/${workoutSessionId}/comments`,
        { method: "POST", body: input }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-comments", workoutSessionId] });
      qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}

export function useDeleteComment(workoutSessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiFetch<{ success: true }>(`/api/mobile/community/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-comments", workoutSessionId] });
      qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}

export function useReportComment() {
  return useMutation({
    mutationFn: (input: { commentId: string; reason: string }) =>
      apiFetch<{ success: true }>(`/api/mobile/community/comments/${input.commentId}/report`, {
        method: "POST",
        body: { reason: input.reason },
      }),
  });
}

export interface CommunityPrivacy {
  discoverable: boolean;
  leaderboardVisible: boolean;
  showRealName: boolean;
}

export function useCommunityPrivacy() {
  return useQuery({
    queryKey: ["community-privacy"],
    queryFn: () =>
      apiFetch<{ success: true; data: CommunityPrivacy }>("/api/mobile/community/privacy").then((r) => r.data),
  });
}

export function useSetCommunityPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CommunityPrivacy) =>
      apiFetch<{ success: true }>("/api/mobile/community/privacy", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-privacy"] }),
  });
}

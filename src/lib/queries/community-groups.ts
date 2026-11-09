import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useHasFeature } from "@/lib/queries/profile";

// Community groups, challenges and the gym community. Mirrors the server routes under gym-app's app/api/mobile/community/{groups,gym} (Community plan,
// 2026-11). The server decides who may do what on every call; the hooks here only avoid asking when the member's plan can't have it.

/** The server's code when a member must confirm they are 18 or over before groups / the gym community (see confirm-adult). */
export const ADULT_CONFIRMATION_REQUIRED_CODE = "adult_confirmation_required";

export function isAdultConfirmationRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === ADULT_CONFIRMATION_REQUIRED_CODE;
}

// ── Adult (18+) confirmation ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function useAdultConfirmed() {
  return useQuery({
    queryKey: ["community-adult-confirmed"],
    queryFn: () =>
      apiFetch<{ success: true; data: { adultConfirmed?: boolean } }>("/api/mobile/community/privacy").then(
        (r) => r.data.adultConfirmed === true
      ),
  });
}

export function useConfirmAdult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ success: true }>("/api/mobile/community/confirm-adult", { method: "POST", body: { confirm: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-adult-confirmed"] });
      qc.invalidateQueries({ queryKey: ["community-privacy"] });
      qc.invalidateQueries({ queryKey: ["community-groups"] });
      qc.invalidateQueries({ queryKey: ["community-gym"] });
    },
  });
}

// ── Challenges (shared by groups and the gym) ────────────────────────────────────────────────────────────────────────────────────────────────

export type ChallengeMetric = "volume" | "workouts" | "squat" | "bench" | "deadlift";
export type ChallengeStatus = "upcoming" | "active" | "ended" | "canceled";

export interface Challenge {
  id: string;
  title: string;
  metric: ChallengeMetric;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  createdAt: string;
}

export interface ChallengeEntry {
  userId: string;
  displayName: string;
  value: number;
  bodyweightPct: number | null;
}

export interface ChallengeStandings {
  challenge: Challenge;
  entries: ChallengeEntry[];
  myUserId: string;
  /** The member switched their leaderboard visibility off, so they are not listed even if they have scored. */
  iAmHidden: boolean;
}

export interface NewChallengeInput {
  title: string;
  metric: ChallengeMetric;
  startDate: string;
  endDate: string;
}

export type ChallengeScope = { type: "group"; id: string } | { type: "gym" };

function challengesBase(scope: ChallengeScope): string {
  return scope.type === "group" ? `/api/mobile/community/groups/${scope.id}/challenges` : "/api/mobile/community/gym/challenges";
}

const scopeKey = (scope: ChallengeScope) => (scope.type === "group" ? `group:${scope.id}` : "gym");

export function useChallenges(scope: ChallengeScope, enabled = true) {
  return useQuery({
    queryKey: ["community-challenges", scopeKey(scope)],
    queryFn: () => apiFetch<{ success: true; data: Challenge[] }>(challengesBase(scope)).then((r) => r.data),
    enabled,
  });
}

export function useChallengeStandings(scope: ChallengeScope, challengeId: string) {
  return useQuery({
    queryKey: ["community-challenge", scopeKey(scope), challengeId],
    queryFn: () => apiFetch<{ success: true; data: ChallengeStandings }>(`${challengesBase(scope)}/${challengeId}`).then((r) => r.data),
    enabled: !!challengeId,
  });
}

export function useCreateChallenge(scope: ChallengeScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewChallengeInput) => apiFetch<{ success: true; data: Challenge }>(challengesBase(scope), { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-challenges", scopeKey(scope)] }),
  });
}

export function useCancelChallenge(scope: ChallengeScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => apiFetch<{ success: true }>(`${challengesBase(scope)}/${challengeId}/cancel`, { method: "POST" }),
    onSuccess: (_data, challengeId) => {
      qc.invalidateQueries({ queryKey: ["community-challenges", scopeKey(scope)] });
      qc.invalidateQueries({ queryKey: ["community-challenge", scopeKey(scope), challengeId] });
    },
  });
}

// ── Groups ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  isOrganiser: boolean;
  memberCount: number;
  /** Only present for the organiser. */
  inviteCode?: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  isOrganiser: boolean;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}

/** Groups are part of the App tier; a member below it is shown the upgrade card instead of asking the server. */
export function useGroups() {
  const allowed = useHasFeature("communityGroups");
  return useQuery({
    queryKey: ["community-groups", "list"],
    queryFn: () => apiFetch<{ success: true; data: GroupSummary[] }>("/api/mobile/community/groups").then((r) => r.data),
    enabled: allowed,
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: ["community-groups", "detail", id],
    queryFn: () => apiFetch<{ success: true; data: GroupDetail }>(`/api/mobile/community/groups/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

function invalidateGroups(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["community-groups"] });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string }) =>
      apiFetch<{ success: true; data: GroupSummary }>("/api/mobile/community/groups", { method: "POST", body: input }).then((r) => r.data),
    onSuccess: () => invalidateGroups(qc),
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ success: true; data: GroupSummary }>("/api/mobile/community/groups/join", { method: "POST", body: { code } }).then((r) => r.data),
    onSuccess: () => invalidateGroups(qc),
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => apiFetch<{ success: true }>(`/api/mobile/community/groups/${groupId}/leave`, { method: "POST" }),
    onSuccess: () => invalidateGroups(qc),
  });
}

export function useCloseGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => apiFetch<{ success: true }>(`/api/mobile/community/groups/${groupId}/close`, { method: "POST" }),
    onSuccess: () => invalidateGroups(qc),
  });
}

export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: true }>(`/api/mobile/community/groups/${groupId}/remove-member`, { method: "POST", body: { userId } }),
    onSuccess: () => invalidateGroups(qc),
  });
}

// ── The gym community (gym Membership) ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface GymAuthor {
  userId: string;
  displayName: string;
  isStaff: boolean;
}

export interface GymPost {
  id: string;
  author: GymAuthor;
  body: string;
  createdAt: string;
  commentCount: number;
  /** The author, or the gym's staff. */
  canRemove: boolean;
}

export interface GymComment {
  id: string;
  author: GymAuthor;
  body: string;
  createdAt: string;
  canRemove: boolean;
}

export interface GymFeedPage {
  posts: GymPost[];
  /** Pass as `before` to get the next older page; null when there is none. */
  nextBefore: string | null;
}

/**
 * Who can open the gym's community: a member with a gym Membership, or the gym's own coaches and admins (who need no Membership and are not asked to confirm their
 * age). The server makes the same decision on every call; this only decides what to show.
 */
export function useGymCommunityAccess(): { allowed: boolean; isStaff: boolean } {
  const { user } = useAuth();
  const hasMembership = useHasFeature("communityGym");
  const isStaff = !!user && user.role !== "member";
  return { allowed: hasMembership || isStaff, isStaff };
}

/** The gym's own feed is part of a gym Membership (and open to the gym's staff). `before` pages backwards through older posts. */
export function useGymFeed() {
  const { allowed } = useGymCommunityAccess();
  return useQuery({
    queryKey: ["community-gym", "feed"],
    queryFn: () => apiFetch<{ success: true; data: GymFeedPage }>("/api/mobile/community/gym").then((r) => r.data),
    enabled: allowed,
  });
}

export function useGymOlderPosts() {
  return useMutation({
    mutationFn: (before: string) =>
      apiFetch<{ success: true; data: GymFeedPage }>(`/api/mobile/community/gym?before=${encodeURIComponent(before)}`).then((r) => r.data),
  });
}

export function useCreateGymPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiFetch<{ success: true; data: GymPost }>("/api/mobile/community/gym", { method: "POST", body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-gym", "feed"] }),
  });
}

export function useRemoveGymPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiFetch<{ success: true }>(`/api/mobile/community/gym/posts/${postId}/remove`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-gym", "feed"] }),
  });
}

export function useGymComments(postId: string) {
  return useQuery({
    queryKey: ["community-gym", "comments", postId],
    queryFn: () =>
      apiFetch<{ success: true; data: GymComment[] }>(`/api/mobile/community/gym/posts/${postId}/comments`).then((r) => r.data),
    enabled: !!postId,
  });
}

export function usePostGymComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ success: true; data: GymComment }>(`/api/mobile/community/gym/posts/${postId}/comments`, { method: "POST", body: { body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-gym", "comments", postId] });
      qc.invalidateQueries({ queryKey: ["community-gym", "feed"] });
    },
  });
}

export function useRemoveGymComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiFetch<{ success: true }>(`/api/mobile/community/gym/comments/${commentId}/remove`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-gym", "comments", postId] });
      qc.invalidateQueries({ queryKey: ["community-gym", "feed"] });
    },
  });
}

export function useReportGymContent() {
  return useMutation({
    mutationFn: (input: { targetType: "post" | "comment"; targetId: string; reason: string }) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/community/gym/report", { method: "POST", body: input }),
  });
}

// Wording for the Community profile card and its two privacy settings. Pure, so it is unit tested.

import type { LeaderboardMode, ProfileVisibility, WhoCanFollow } from "@/lib/queries/community";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "12,400 kg". Whole kilograms with thousands separators (written by hand so it does not depend on the phone's locale support). */
export function formatVolumeKg(kg: number): string {
  const whole = Math.max(0, Math.round(Number.isFinite(kg) ? kg : 0));
  return `${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} kg`;
}

/** "March 2026" from "2026-03". Anything else gives null so the card simply leaves the line out. */
export function formatMemberSince(month: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!m) return null;
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${m[1]}` : null;
}

export function sessionsLabel(n: number): string {
  return n === 1 ? "1 session" : `${n} sessions`;
}

export const PROFILE_VISIBILITY_OPTIONS: { value: ProfileVisibility; title: string; sub: string }[] = [
  { value: "followers", title: "Only my followers", sub: "Only people who follow you see your training numbers and recent workouts." },
  { value: "followers_gym", title: "Followers and my gym", sub: "Your followers, plus members of your gym, see them." },
  { value: "everyone", title: "Everyone in Community", sub: "Anyone in your Community sees them." },
];

export const LEADERBOARD_MODE_OPTIONS: { value: LeaderboardMode; title: string; sub: string }[] = [
  { value: "named", title: "Show my name", sub: "You appear on leaderboards and challenges under your name." },
  { value: "alias", title: "Use an alias", sub: "You stay ranked with your numbers showing, under an alias, so nobody can wrongly think they are first. Your profile card stays private." },
  { value: "hidden", title: "Hide me completely", sub: "You are not shown on leaderboards or challenges at all." },
];

export const WHO_CAN_FOLLOW_OPTIONS: { value: WhoCanFollow; title: string; sub: string }[] = [
  { value: "anyone", title: "Anyone", sub: "Any member of your Community can follow you." },
  { value: "gym", title: "My gym only", sub: "Only members and staff of your gym can start following you." },
  { value: "nobody", title: "Nobody", sub: "No new followers. People who already follow you stay." },
];

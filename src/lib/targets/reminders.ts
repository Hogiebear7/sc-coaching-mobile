import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { TargetsState } from "./data";
import { planReminders } from "./index";

// Local reminders for goals and rehab. Planned as a rolling window (see index.ts): rebuilt every time the list changes and whenever the goals
// screen or the Home card loads. iOS allows 64 scheduled notifications per app in total and the check-in reminder uses up to 7, so this uses
// at most 40. Kept apart from the storage hook so sign-out can cancel them without importing the auth context (which would be circular).

export const TARGET_REMINDER_PREFIX = "target-reminder-";
export const TARGET_REMINDER_LINK = "/targets";
export const TARGET_REHAB_LINK = "/targets?kind=rehab";
export const REMINDER_CAP = 40;
export const HORIZON_DAYS = 7;

async function cancelTargetReminderNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(TARGET_REMINDER_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Asks for notification permission if the member has not decided yet. Returns whether reminders can be scheduled. */
export async function ensureReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === "granted";
  } catch {
    return false;
  }
}

/** Clears and refills the goal and rehab reminders. Safe to call any time; never throws and never asks for permission. */
export async function syncTargetReminders(state: TargetsState): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await cancelTargetReminderNotifications();
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const plan = planReminders(state.targets, state.entries, new Date(), { horizonDays: HORIZON_DAYS, cap: REMINDER_CAP });
    for (let i = 0; i < plan.length; i++) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${TARGET_REMINDER_PREFIX}${i}`,
        content: { title: plan[i].title, body: plan[i].body, data: { linkHref: state.targets.find((t) => t.id === plan[i].targetId)?.kind === "rehab" ? TARGET_REHAB_LINK : TARGET_REMINDER_LINK } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan[i].at },
      });
    }
  } catch {
    // Best-effort: a reminder is never a reason for anything else to fail.
  }
}

/** Sign-out: the next person on this phone should not get the last one's reminders. */
export async function cancelTargetReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await cancelTargetReminderNotifications();
  } catch {
    // Best-effort.
  }
}

/** For the plain "reminders are set up to <day>" note under a goal or rehab list. */
export function reminderCoverage(state: TargetsState, now: Date = new Date()): { count: number; lastDay: Date | null; capped: boolean } {
  const plan = planReminders(state.targets, state.entries, now, { horizonDays: HORIZON_DAYS, cap: REMINDER_CAP });
  const all = planReminders(state.targets, state.entries, now, { horizonDays: HORIZON_DAYS, cap: 10_000 });
  return { count: plan.length, lastDay: plan.length ? plan[plan.length - 1].at : null, capped: all.length > plan.length };
}

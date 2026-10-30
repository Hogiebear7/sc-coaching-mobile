import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// The morning check-in reminder (owner decision 2026-10-30): on by default at 08:45, the member can change the time or turn it off in Settings.
//
// Scheduled ON THE PHONE, not sent by the server: it fires at the member's own local time, offline too, with no time zone for the server to
// guess. The next 7 mornings are scheduled as single notifications (not one repeating one) so a morning can be skipped: once today's check-in
// is saved, today's reminder is dropped. Re-synced at every app start, every save of today's check-in and every settings change, so the week
// ahead is always filled. Never asks for notification permission itself: it schedules only when the member has already allowed notifications.

export interface CheckinReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_CHECKIN_REMINDER: CheckinReminderPrefs = { enabled: true, hour: 8, minute: 45 };

const PREFS_KEY = "sc.checkinReminder";
const LAST_CHECKIN_KEY = "sc.checkinReminder.lastCheckinDate";
const DAYS_AHEAD = 7;
const idFor = (i: number) => `checkin-reminder-${i}`;
export const CHECKIN_REMINDER_LINK = "/recovery";

/** YYYY-MM-DD in the phone's own time zone. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatReminderTime(p: Pick<CheckinReminderPrefs, "hour" | "minute">): string {
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** The mornings to remind on: the next DAYS_AHEAD days at the chosen time, skipping a time already past and today when it is already checked in. */
export function reminderTimes(now: Date, prefs: CheckinReminderPrefs, lastCheckinDate: string | null, days: number = DAYS_AHEAD): Date[] {
  if (!prefs.enabled) return [];
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, prefs.hour, prefs.minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    if (lastCheckinDate === localDateKey(at)) continue;
    out.push(at);
  }
  return out;
}

function validPrefs(v: unknown): CheckinReminderPrefs | null {
  const p = v as Partial<CheckinReminderPrefs> | null;
  if (!p || typeof p.enabled !== "boolean") return null;
  if (!Number.isInteger(p.hour) || (p.hour as number) < 0 || (p.hour as number) > 23) return null;
  if (!Number.isInteger(p.minute) || (p.minute as number) < 0 || (p.minute as number) > 59) return null;
  return { enabled: p.enabled, hour: p.hour as number, minute: p.minute as number };
}

export async function loadCheckinReminderPrefs(): Promise<CheckinReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return (raw && validPrefs(JSON.parse(raw))) || DEFAULT_CHECKIN_REMINDER;
  } catch {
    return DEFAULT_CHECKIN_REMINDER;
  }
}

export async function saveCheckinReminderPrefs(prefs: CheckinReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort: the reminder keeps its previous setting.
  }
  await syncCheckinReminder();
}

/** Called when a check-in is saved: a check-in for today drops today's reminder. */
export async function noteCheckinSaved(date: string): Promise<void> {
  if (date !== localDateKey(new Date())) return;
  try {
    await AsyncStorage.setItem(LAST_CHECKIN_KEY, date);
  } catch {
    // Best-effort.
  }
  await syncCheckinReminder();
}

/** Clears and refills the week ahead. Safe to call any time; never throws. */
export async function syncCheckinReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    for (let i = 0; i < DAYS_AHEAD; i++) await Notifications.cancelScheduledNotificationAsync(idFor(i));
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const [prefs, last] = await Promise.all([loadCheckinReminderPrefs(), AsyncStorage.getItem(LAST_CHECKIN_KEY).catch(() => null)]);
    const times = reminderTimes(new Date(), prefs, last);
    for (let i = 0; i < times.length; i++) {
      await Notifications.scheduleNotificationAsync({
        identifier: idFor(i),
        content: {
          title: "Morning check-in",
          body: "How did you sleep? Log today's check-in to see how ready you are to train.",
          data: { linkHref: CHECKIN_REMINDER_LINK },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: times[i] },
      });
    }
  } catch {
    // Best-effort: a reminder is never a reason for anything else to fail.
  }
}

/** Cancels every scheduled reminder (sign-out: the next person on this phone should not get the last one's reminders). */
export async function cancelCheckinReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    for (let i = 0; i < DAYS_AHEAD; i++) await Notifications.cancelScheduledNotificationAsync(idFor(i));
  } catch {
    // Best-effort.
  }
}

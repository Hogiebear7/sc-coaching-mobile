import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock("expo-notifications", () => ({ SchedulableTriggerInputTypes: { DATE: "date" } }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { DEFAULT_CHECKIN_REMINDER, formatReminderTime, localDateKey, reminderTimes } from "../checkin-reminder";

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe("morning check-in reminder", () => {
  it("defaults to on at 08:45", () => {
    expect(DEFAULT_CHECKIN_REMINDER).toEqual({ enabled: true, hour: 8, minute: 45 });
    expect(formatReminderTime(DEFAULT_CHECKIN_REMINDER)).toBe("08:45");
  });

  it("schedules the next 7 mornings, starting today while the time is still ahead", () => {
    const times = reminderTimes(at(2026, 10, 30, 7, 0), DEFAULT_CHECKIN_REMINDER, null);
    expect(times).toHaveLength(7);
    expect(times[0]).toEqual(at(2026, 10, 30, 8, 45));
    expect(times[6]).toEqual(at(2026, 11, 5, 8, 45));
  });

  it("skips today once the time has passed", () => {
    const times = reminderTimes(at(2026, 10, 30, 9, 0), DEFAULT_CHECKIN_REMINDER, null);
    expect(times[0]).toEqual(at(2026, 10, 31, 8, 45));
    expect(times).toHaveLength(6);
  });

  it("skips today when today's check-in is already saved", () => {
    const now = at(2026, 10, 30, 7, 0);
    const times = reminderTimes(now, DEFAULT_CHECKIN_REMINDER, localDateKey(now));
    expect(times[0]).toEqual(at(2026, 10, 31, 8, 45));
  });

  it("schedules nothing when turned off, and follows a changed time", () => {
    expect(reminderTimes(at(2026, 10, 30, 7, 0), { ...DEFAULT_CHECKIN_REMINDER, enabled: false }, null)).toEqual([]);
    expect(reminderTimes(at(2026, 10, 30, 7, 0), { enabled: true, hour: 6, minute: 30 }, null)[0]).toEqual(at(2026, 10, 31, 6, 30));
  });
});

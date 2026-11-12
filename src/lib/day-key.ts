import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Local calendar day as YYYY-MM-DD, from the device clock. */
export function localDayKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Milliseconds from `now` to the next local midnight, plus one second so the new day has definitely started. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * The current local day, kept up to date. A screen that works out "Today" or "Tomorrow" while it renders only knows the day it last drew
 * on, so an app left open overnight showed yesterday's labels (a class booked for tomorrow still said "Tomorrow" the next morning).
 * This re-renders the caller when the app comes back to the foreground on a new day, and at midnight if it is open then. The caller can
 * also watch the returned key to refetch anything that depends on the day.
 */
export function useDayKey(): string {
  const [key, setKey] = useState(() => localDayKey());
  // Also redraws on every return to the foreground even when the day is unchanged, so time-of-day wording ("Morning", "Afternoon") moves on.
  const [, setForegrounds] = useState(0);

  useEffect(() => {
    const refresh = () => setKey((prev) => {
      const now = localDayKey();
      return now === prev ? prev : now;
    });

    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        setForegrounds((n) => n + 1);
      }
    });

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextLocalMidnight());
    };
    schedule();

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  return key;
}

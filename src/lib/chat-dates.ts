// WhatsApp-style date dividers for every chat list ("Today", "Yesterday", a weekday, then a full date).

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** The label for the divider above a message sent at `iso`, as seen on `now`. */
export function dateDividerLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export type DividedItem<T> = { kind: "divider"; key: string; label: string } | { kind: "message"; key: string; message: T };

/** The messages in order with a divider before the first message of each day. Messages with no usable date get no divider. */
export function withDateDividers<T>(messages: T[], getIso: (m: T) => string, getKey: (m: T) => string, now: Date = new Date()): DividedItem<T>[] {
  const items: DividedItem<T>[] = [];
  let lastDay: string | null = null;
  for (const message of messages) {
    const iso = getIso(message);
    const day = dayKey(iso);
    if (day && day !== lastDay) {
      items.push({ kind: "divider", key: `divider-${day}`, label: dateDividerLabel(iso, now) });
      lastDay = day;
    }
    items.push({ kind: "message", key: getKey(message), message });
  }
  return items;
}

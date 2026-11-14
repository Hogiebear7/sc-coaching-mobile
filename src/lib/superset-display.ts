import { DataColor } from "@/constants/theme";
import { distinctGroups, supersetMemberLabel } from "@/lib/superset-label";

// The same colours and labels as the log screen, for the places that look back at a workout (the summary and the history). Pass each entry's
// superset label in the order shown (exercises and cardio together); back comes a label like "A1" and a colour, or null for an entry on its own.

const COLOURS = [DataColor.sessions, DataColor.load, DataColor.sleep, DataColor.hydration];

export function supersetColourFor(group: string, allGroups: (string | null | undefined)[]): string {
  const i = distinctGroups(allGroups).indexOf(group);
  return COLOURS[(i < 0 ? 0 : i) % COLOURS.length];
}

export function supersetBadges(groups: (string | null | undefined)[]): ({ label: string; color: string } | null)[] {
  const seen = new Map<string, number>();
  return groups.map((g) => {
    if (!g) return null;
    const n = seen.get(g) ?? 0;
    seen.set(g, n + 1);
    return { label: supersetMemberLabel(g, groups, n), color: supersetColourFor(g, groups) };
  });
}

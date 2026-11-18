import { DataColor } from "@/constants/theme";
import { distinctGroups } from "@/lib/superset-label";

// How the workout cards group exercises into supersets and colour them. Shared by the logging screen and the template editor so they agree.

/** Splits exercise rows into the boxes they are drawn in: each superset (by label) in one box, every other exercise on its own. */
export function groupExerciseRowsBySuperset<R extends { supersetGroup: string | null }>(rows: R[]): { group: string | null; rows: R[] }[] {
  const groups: { group: string | null; rows: R[] }[] = [];
  const groupIndexByLabel = new Map<string, number>();
  for (const row of rows) {
    if (row.supersetGroup) {
      const existingIdx = groupIndexByLabel.get(row.supersetGroup);
      if (existingIdx !== undefined) {
        groups[existingIdx].rows.push(row);
        continue;
      }
      groupIndexByLabel.set(row.supersetGroup, groups.length);
      groups.push({ group: row.supersetGroup, rows: [row] });
    } else {
      groups.push({ group: null, rows: [row] });
    }
  }
  return groups;
}

// One colour per superset, in the order they appear, from the app's data colours.
const SUPERSET_COLOURS = [DataColor.sessions, DataColor.load, DataColor.sleep, DataColor.hydration];
export function supersetColor(group: string, allGroups: (string | null)[]): string {
  const i = distinctGroups(allGroups).indexOf(group);
  return SUPERSET_COLOURS[(i < 0 ? 0 : i) % SUPERSET_COLOURS.length];
}

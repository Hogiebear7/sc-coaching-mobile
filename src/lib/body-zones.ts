// Body-diagram zone definitions — deliberately NOT hardcoding an assumed
// ExerciseDB taxonomy as gospel. Each zone's vendorValues are matched
// case-insensitively against whatever the live exercise library actually
// returns (data.filters.bodyParts), the same alias-normalization approach
// used for the equipment catalog (see lib/equipment-matching.ts). If a
// zone's vendor value never appears in the real data, the diagram renders
// it as unavailable rather than silently pretending it's selectable.

export type BodyZoneKey =
  | "neck"
  | "shoulders"
  | "chest"
  | "back"
  | "upper-arms"
  | "lower-arms"
  | "waist"
  | "upper-legs"
  | "lower-legs";

export interface BodyZoneDef {
  key: BodyZoneKey;
  label: string;
  vendorValues: string[];
  views: ("front" | "back")[];
}

export const BODY_ZONES: BodyZoneDef[] = [
  { key: "neck", label: "Neck", vendorValues: ["neck"], views: ["front", "back"] },
  { key: "shoulders", label: "Shoulders", vendorValues: ["shoulders"], views: ["front", "back"] },
  { key: "chest", label: "Chest", vendorValues: ["chest"], views: ["front"] },
  { key: "back", label: "Back", vendorValues: ["back"], views: ["back"] },
  { key: "upper-arms", label: "Upper arms", vendorValues: ["upper arms"], views: ["front", "back"] },
  { key: "lower-arms", label: "Lower arms", vendorValues: ["lower arms"], views: ["front", "back"] },
  { key: "waist", label: "Waist", vendorValues: ["waist"], views: ["front", "back"] },
  { key: "upper-legs", label: "Upper legs", vendorValues: ["upper legs"], views: ["front", "back"] },
  { key: "lower-legs", label: "Lower legs", vendorValues: ["lower legs"], views: ["front", "back"] },
];

// "cardio" is a real bodyPart value in the library but has no natural body
// zone — surfaced as a separate toggle alongside the diagram instead.
export const CARDIO_VENDOR_VALUE = "cardio";

export function findBodyZone(key: BodyZoneKey): BodyZoneDef | undefined {
  return BODY_ZONES.find((z) => z.key === key);
}

export function bodyZoneMatchesVendorValue(zone: BodyZoneDef, vendorValue: string): boolean {
  const v = vendorValue.trim().toLowerCase();
  return zone.vendorValues.some((x) => x.toLowerCase() === v);
}

// The zone's real vendor value(s) as they actually exist in the live
// library right now (a zone can be "on the diagram" but have zero matches
// if the gym's exercise data doesn't use that value yet).
export function vendorValuesPresentForZone(zone: BodyZoneDef, availableVendorValues: string[]): string[] {
  return availableVendorValues.filter((v) => bodyZoneMatchesVendorValue(zone, v));
}

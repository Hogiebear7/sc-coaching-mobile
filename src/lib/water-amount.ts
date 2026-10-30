import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// The member's usual drink of water (owner request 2026-10-30): 250 ml unless they set their own in Settings. It is the first quick-add
// button on the Hydration card and the "+" button on the water widget. Kept on the device, like the haptics switch.

export const DEFAULT_WATER_AMOUNT_ML = 250;
export const WATER_AMOUNT_MIN_ML = 50;
export const WATER_AMOUNT_MAX_ML = 2000;
export const WATER_AMOUNT_PRESETS = [150, 250, 330, 500, 750];
const OTHER_QUICK_ADDS = [250, 500, 750];
const STORAGE_KEY = "sc.waterAmountMl";

let current = DEFAULT_WATER_AMOUNT_ML;
const listeners = new Set<() => void>();

/** A whole number of ml inside the allowed range, or null. */
export function validWaterAmount(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const ml = Math.round(n);
  return ml >= WATER_AMOUNT_MIN_ML && ml <= WATER_AMOUNT_MAX_ML ? ml : null;
}

/** The Hydration card's three buttons: the member's own amount first, then the usual sizes it doesn't repeat. */
export function waterQuickAdds(amountMl: number): number[] {
  return [amountMl, ...OTHER_QUICK_ADDS.filter((ml) => ml !== amountMl)].slice(0, 3);
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    const ml = validWaterAmount(raw);
    if (ml !== null && ml !== current) {
      current = ml;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

export function setWaterAmount(ml: number) {
  const valid = validWaterAmount(ml);
  if (valid === null) return;
  current = valid;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, String(valid)).catch(() => {});
}

export function getWaterAmount(): number {
  return current;
}

export function useWaterAmount(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}

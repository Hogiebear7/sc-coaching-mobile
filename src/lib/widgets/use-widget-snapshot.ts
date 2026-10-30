import { useMemo } from "react";

import { useHydration, useMyNutritionTarget, useNutritionDiary } from "@/lib/queries/nutrition-diary";
import { useSchedule } from "@/lib/queries/schedule";
import { useWaterAmount } from "@/lib/water-amount";
import { buildClassData, buildNutritionData, buildWaterData, localDate, type WidgetSnapshot } from "@/lib/widgets/snapshot";

/** The widgets' snapshot from the data the app already loads (and caches) for the Nutrition and Schedule screens. */
export function useWidgetSnapshot(): WidgetSnapshot {
  const today = localDate(new Date());
  const amountMl = useWaterAmount();
  const { data: hydration } = useHydration(today);
  const { data: diary } = useNutritionDiary(today);
  const { data: target } = useMyNutritionTarget(today);
  const { data: schedule } = useSchedule();

  return useMemo(
    () => ({
      updatedAt: new Date().toISOString(),
      water: buildWaterData(today, hydration, amountMl),
      nutrition: buildNutritionData(today, diary?.totals, target),
      classes: buildClassData(schedule),
    }),
    [today, hydration, amountMl, diary, target, schedule]
  );
}

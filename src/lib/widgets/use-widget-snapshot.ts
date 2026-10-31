import { useMemo } from "react";

import { useHydration, useMyNutritionTarget, useNutritionDiary } from "@/lib/queries/nutrition-diary";
import { useSchedule } from "@/lib/queries/schedule";
import { useWaterAmount } from "@/lib/water-amount";
import { useWidgetStyle } from "@/lib/widgets/widget-style";
import { buildClassData, buildNutritionData, buildWaterData, localDate, type WidgetSnapshot } from "@/lib/widgets/snapshot";

/** The widgets' snapshot from the data the app already loads (and caches) for the Nutrition and Schedule screens. */
export function useWidgetSnapshot(): WidgetSnapshot {
  const today = localDate(new Date());
  const amountMl = useWaterAmount();
  const style = useWidgetStyle();
  const { data: hydration } = useHydration(today);
  const { data: diary } = useNutritionDiary(today);
  const { data: target } = useMyNutritionTarget(today);
  const { data: schedule } = useSchedule();

  return useMemo(
    () => ({
      updatedAt: new Date().toISOString(),
      style,
      water: buildWaterData(today, hydration, amountMl),
      nutrition: buildNutritionData(today, diary?.totals, target),
      classes: buildClassData(schedule),
    }),
    [today, hydration, amountMl, style, diary, target, schedule]
  );
}

/** Where each widget data request stands ("hydration loaded, diary error 401: …"), for the diagnostic log when the widgets have nothing. */
export function useWidgetDataStatus(): string {
  const today = localDate(new Date());
  const parts: [string, { status: string; error: unknown; fetchStatus: string }][] = [
    ["hydration", useHydration(today)],
    ["diary", useNutritionDiary(today)],
    ["schedule", useSchedule()],
  ];
  return parts.map(([name, q]) => `${name} ${q.status}/${q.fetchStatus}${q.error ? `: ${String(q.error)}` : ""}`).join(", ");
}

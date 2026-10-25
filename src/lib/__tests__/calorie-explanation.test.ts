import { describe, expect, it } from "vitest";

import { calorieExplanation } from "@/lib/calorie-explanation";
import type { ResolvedNutritionTarget } from "@/lib/queries/nutrition-diary";

function target(partial: Partial<ResolvedNutritionTarget>): ResolvedNutritionTarget {
  return {
    date: "2026-10-26",
    mode: "auto",
    calories: 1650,
    proteinG: 96,
    carbsG: 190,
    fatG: 54,
    fuelDay: "standard",
    fuelDayLabel: "Standard fuel day",
    source: "estimated",
    notes: null,
    bodyWeightKg: 60,
    rationale: ["Built on an estimate of your burn."],
    setByMember: false,
    ...partial,
  };
}

const weekly = {
  weekStart: "2026-10-26",
  weekBudgetKcal: 11550,
  dailyAverageKcal: 1650,
  expenditureKcal: 1980,
  expenditureSource: "formula" as const,
  completeDaysLast14: 0,
  pacePctPerWeek: -0.5,
  paceLimited: false,
  minimumApplied: false,
  distribution: "even" as const,
  distributionSource: "default" as const,
};

describe("calorieExplanation", () => {
  it("asks for a weight when there is no target", () => {
    expect(calorieExplanation(target({ calories: null }))).toContain("Add your weight");
    expect(calorieExplanation(null)).toContain("Add your weight");
  });

  it("explains a weekly target step by step", () => {
    const text = calorieExplanation(target(weekly));
    expect(text).toContain("your share of this week's 11,550 kcal budget");
    expect(text).toContain("1. Your burn — about 1,980 kcal a day, estimated");
    expect(text).toContain("lose about 0.5% of your bodyweight a week");
    expect(text).toContain("split evenly");
    expect(text).toContain("• Built on an estimate of your burn.");
    expect(text).toContain("reviewed every Monday");
  });

  it("says when the pace was slowed and when calories follow training", () => {
    const text = calorieExplanation(target({ ...weekly, paceLimited: true, distribution: "training", expenditureSource: "learned" }));
    expect(text).toContain("it's been slowed");
    expect(text).toContain("follows your training");
    expect(text).toContain("learned from your complete food days");
  });

  it("explains a coach-set target without the weekly steps", () => {
    const text = calorieExplanation(target({ mode: "manual", calories: 2100, source: "manual" }));
    expect(text).toContain("set by your coach");
    expect(text).not.toContain("How it's worked out");
  });

  it("still works against a server without the weekly fields", () => {
    const text = calorieExplanation(target({}));
    expect(text).toContain("Today's target is 1,650 kcal.");
    expect(text).not.toContain("How it's worked out");
  });
});

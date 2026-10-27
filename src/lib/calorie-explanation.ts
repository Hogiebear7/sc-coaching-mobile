import type { ResolvedNutritionTarget } from "@/lib/queries/nutrition-diary";

// Plain-English "why is my number this?" text for the Nutrition tab's info
// sheet (nutrition targets v2). Built only from what the server actually
// used — the weekly fields and its own rationale lines — so it can never
// disagree with the number on screen. Pure, so it's unit-tested.

const kcal = (n: number) => `${n.toLocaleString("en-GB")} kcal`;

export function calorieExplanation(target: ResolvedNutritionTarget | null | undefined): string {
  if (!target || target.calories === null) {
    return "There's no calorie target yet. Add your weight in Profile and the app will work one out for you.";
  }

  const lines: string[] = [];

  if (target.mode === "manual") {
    lines.push(
      target.setByMember
        ? `Today's target is ${kcal(target.calories)}, which you set through the AI Nutrition Coach. It stays the same every day until you or your coach change it.`
        : `Today's target is ${kcal(target.calories)}, set by your coach. It stays the same every day until they change it — message them if it doesn't feel right.`
    );
    return lines.join("\n\n");
  }

  const hasWeek = target.weekBudgetKcal != null && target.dailyAverageKcal != null;
  lines.push(
    hasWeek
      ? `Today's target is ${kcal(target.calories)} — your share of this week's ${kcal(target.weekBudgetKcal!)} budget (about ${kcal(target.dailyAverageKcal!)} a day on average)${
          (target.workoutExtraKcal ?? 0) > 0 ? `, plus ${kcal(target.workoutExtraKcal!)} for training beyond your plan` : ""
        }.`
      : `Today's target is ${kcal(target.calories)}.`
  );

  if (hasWeek) {
    const steps: string[] = [];
    if (target.expenditureKcal != null) {
      steps.push(
        target.expenditureSource === "learned"
          ? `1. Your burn — about ${kcal(target.expenditureKcal)} a day, learned from your complete food days and weigh-ins.`
          : `1. Your burn — about ${kcal(target.expenditureKcal)} a day, estimated from your weight, height, age and how active you are. It switches to your real burn once you've logged about two weeks of complete days and weigh-ins.`
      );
    }
    const pace = target.pacePctPerWeek ?? 0;
    const extra = target.stageExtraKcal ?? 0;
    steps.push(
      target.nutritionStage === "pregnant" || target.nutritionStage === "postpartum"
        ? `2. Your goal — paused ${target.nutritionStage === "pregnant" ? "while you're pregnant" : "for the first 12 weeks after the birth"}, so your target maintains your weight${extra > 0 ? ` plus ${kcal(extra)} a day${target.nutritionStage === "pregnant" ? " for your stage of pregnancy" : " for breastfeeding"}` : ""}.`
        : pace === 0
          ? "2. Your goal — maintain your weight, so no deficit or surplus is applied."
          : `2. Your goal — ${pace < 0 ? "lose" : "gain"} about ${Math.abs(pace)}% of your bodyweight a week, so the budget is ${pace < 0 ? "below" : "above"} your burn by the right amount.`
    );
    if (target.nutritionStage === "breastfeeding" && extra > 0) {
      steps.push(`   Plus ${kcal(extra)} a day while you're breastfeeding. Let the app know when you stop, in Cycle tracking.`);
    }
    steps.push(
      target.paceLimited
        ? "3. A safe minimum — your pace would have taken you too low, so it's been slowed to keep you at a safe level."
        : "3. A safe minimum — the app never goes below a safe level for you, whatever the goal."
    );
    steps.push(
      target.distribution === "training"
        ? "4. The spread — your weekly budget follows your training: more on heavy and match days, less on rest days, within 20% of your average."
        : "4. The spread — your weekly budget is split evenly, so every day is the same."
    );
    lines.push(`How it's worked out\n${steps.join("\n")}`);
  }

  if (target.rationale && target.rationale.length > 0) {
    lines.push(`Why today's number\n${target.rationale.map((l) => `• ${l}`).join("\n")}`);
  }

  lines.push(
    hasWeek
      ? "Your budget is reviewed every Monday, and eating over one day is never taken off the next. You can change your pace, activity and how calories are spread in Calorie targets."
      : "You can see more in Calorie targets."
  );
  return lines.join("\n\n");
}

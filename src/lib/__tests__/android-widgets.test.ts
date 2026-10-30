import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// The package entry pulls in React Native; the widget primitives and the tree builder are plain JavaScript, so use those directly.
vi.mock("react-native-android-widget", async () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FlexWidget: ((await import("react-native-android-widget/lib/module/widgets/FlexWidget" as string)) as any).FlexWidget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TextWidget: ((await import("react-native-android-widget/lib/module/widgets/TextWidget" as string)) as any).TextWidget,
}));

// @ts-expect-error -- an internal file of the library, without types; it is the step that turns a widget into its native layout.
import { buildWidgetTree } from "react-native-android-widget/lib/module/api/build-widget-tree";

import { ClassWidgetAndroid, NutritionWidgetAndroid, WaterWidgetAndroid } from "@/widgets/android/home-widgets";

// Runs each Android widget through the library's own tree builder (the step that turns it into the native layout), in both looks, with
// data and without (before the app has saved any). A widget that throws here is a see-through, empty widget on the phone.
const water = { date: "2026-10-30", loggedMl: 1250, targetMl: 2800, amountMl: 250 };
const nutrition = { date: "2026-10-30", calories: 1520, targetCalories: 2400, proteinG: 98, targetProteinG: 160 };
const classes = { next: { title: "Over 50s", date: "2026-10-31", startTime: "10:00" }, classesLeft: 3, canBook: true };

function colours(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === "string" && /color|Color/.test(k)) out.push(v);
    else if (typeof v === "object") colours(v, out);
  }
  return out;
}

describe("Android widgets", () => {
  for (const look of ["navy", "glass"] as const) {
    it(`build without errors (${look}), with and without data`, () => {
      for (const el of [
        createElement(WaterWidgetAndroid, { data: water, look }),
        createElement(NutritionWidgetAndroid, { data: nutrition, look }),
        createElement(ClassWidgetAndroid, { data: classes, look }),
        createElement(WaterWidgetAndroid, { data: null, look }),
      ]) {
        const tree = buildWidgetTree(el);
        expect(tree).toBeTruthy();
        // Every colour the native side receives is Android's #aarrggbb or #rrggbb, never anything else.
        for (const c of colours(tree)) expect(c).toMatch(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i);
      }
    });
  }
});

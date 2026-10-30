"use no memo";

// The React Compiler is on for the app (app.json experiments.reactCompiler); it rewrites components with hidden hooks, which a widget
// renderer can't run, so it must leave this file alone. Without this line every widget stays an empty, see-through frame.

import { FlexWidget, TextWidget } from "react-native-android-widget";

import { describeClassTime, type ClassWidgetData, type NutritionWidgetData, type WaterWidgetData } from "@/lib/widgets/snapshot";
import type { WidgetStyle } from "@/lib/widgets/widget-style";

// The Android home-screen widgets (App Widgets, through react-native-android-widget). Drawn from the same snapshot as the iPhone widgets and
// the in-app previews. Android launchers can't blur the wallpaper behind a widget, so the Glass look is a see-through frosted tint here.
// Tapping opens the matching screen; the water widget's button logs water straight away (src/widgets/android/task-handler.tsx).
// Colours: plain #rrggbb, or rgba() for see-through. (The library reads an 8-digit hex as CSS #rrggbbaa, not Android's #aarrggbb.)

export const ANDROID_WIDGET_NAMES = { water: "Water", nutrition: "Nutrition", nextClass: "NextClass" } as const;

const NAVY = "#0a1526" as const;
const NAVY_HI = "#16243a" as const;
const GOLD = "#c6a15b" as const;
const WATER = "#5fb4e8" as const;
const WHITE = "#ffffff" as const;

function palette(look: WidgetStyle) {
  const glass = look === "glass";
  return {
    bg: glass ? ("rgba(255, 255, 255, 0.18)" as const) : NAVY,
    border: glass ? ("rgba(255, 255, 255, 0.45)" as const) : ("rgba(255, 255, 255, 0.06)" as const),
    muted: glass ? ("rgba(255, 255, 255, 0.94)" as const) : ("rgba(255, 255, 255, 0.65)" as const),
    accent: glass ? WHITE : GOLD,
    box: glass ? ("rgba(255, 255, 255, 0.22)" as const) : NAVY_HI,
  };
}

const litres = (ml: number) => `${(ml / 1000).toFixed(1)} L`;
const OPEN = (uri: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri } });

function SetUp({ look }: { look: WidgetStyle }) {
  const p = palette(look);
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 22, padding: 14, justifyContent: "center" }}
      {...OPEN("sccoachingmobile://")}
    >
      <TextWidget text="Open S&C to set up" style={{ fontSize: 14, fontWeight: "600", color: WHITE }} />
    </FlexWidget>
  );
}

export function WaterWidgetAndroid({ data, look }: { data: WaterWidgetData | null; look: WidgetStyle }) {
  if (!data) return <SetUp look={look} />;
  const p = palette(look);
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "column" }}
      {...OPEN("sccoachingmobile://nutrition")}
    >
      <TextWidget text="Water" style={{ fontSize: 12, fontWeight: "600", color: p.muted }} />
      <TextWidget text={litres(data.loggedMl)} style={{ fontSize: 24, fontWeight: "700", color: WHITE, marginTop: 4 }} />
      <TextWidget text={data.targetMl ? `of ${litres(data.targetMl)}` : "today"} style={{ fontSize: 12, color: p.muted }} />
      <FlexWidget style={{ flex: 1 }} />
      <FlexWidget
        style={{ width: "match_parent", backgroundColor: WATER, borderRadius: 12, paddingVertical: 8, alignItems: "center" }}
        clickAction="ADD_WATER"
        clickActionData={{ amountMl: data.amountMl }}
      >
        <TextWidget text={`+${data.amountMl} ml`} style={{ fontSize: 14, fontWeight: "700", color: NAVY }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function NutritionWidgetAndroid({ data, look }: { data: NutritionWidgetData | null; look: WidgetStyle }) {
  if (!data) return <SetUp look={look} />;
  const p = palette(look);
  const left = data.targetCalories !== null ? data.targetCalories - data.calories : null;
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "column" }}
      {...OPEN("sccoachingmobile://log-food")}
    >
      <TextWidget text="Nutrition" style={{ fontSize: 12, fontWeight: "600", color: p.muted }} />
      <TextWidget text={`${data.calories.toLocaleString("en-IE")} kcal`} style={{ fontSize: 24, fontWeight: "700", color: WHITE, marginTop: 4 }} />
      <TextWidget
        text={left === null ? "eaten today" : left >= 0 ? `${left.toLocaleString("en-IE")} left of ${data.targetCalories!.toLocaleString("en-IE")}` : `${(-left).toLocaleString("en-IE")} over`}
        style={{ fontSize: 12, color: p.muted }}
      />
      <TextWidget text={data.targetProteinG ? `Protein ${data.proteinG} / ${data.targetProteinG} g` : `Protein ${data.proteinG} g`} style={{ fontSize: 12, color: p.muted, marginTop: 2 }} />
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget text="+ Log food" style={{ fontSize: 13, fontWeight: "700", color: p.accent }} />
    </FlexWidget>
  );
}

export function ClassWidgetAndroid({ data, look }: { data: ClassWidgetData | null; look: WidgetStyle }) {
  if (!data) return <SetUp look={look} />;
  const p = palette(look);
  const next = data.next;
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center" }}
      {...OPEN("sccoachingmobile://schedule")}
    >
      <FlexWidget style={{ flex: 1, height: "match_parent", flexDirection: "column" }}>
        <TextWidget text="Next class" style={{ fontSize: 12, fontWeight: "600", color: p.muted }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={next ? next.title : data.canBook ? "Nothing booked" : "No membership yet"}
          style={{ fontSize: 19, fontWeight: "700", color: WHITE }}
          maxLines={1}
          truncate="END"
        />
        <TextWidget
          text={next ? describeClassTime(next.date, next.startTime) : data.canBook ? "Tap to book a class" : "Tap to see classes"}
          style={{ fontSize: 15, fontWeight: "600", color: next ? p.accent : p.muted }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {next && data.canBook ? <TextWidget text="Book another" style={{ fontSize: 12, fontWeight: "700", color: p.accent }} /> : null}
      </FlexWidget>
      {data.classesLeft !== null ? (
        <FlexWidget style={{ backgroundColor: p.box, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", marginLeft: 12 }}>
          <TextWidget text={String(data.classesLeft)} style={{ fontSize: 28, fontWeight: "800", color: WHITE }} />
          <TextWidget text={data.classesLeft === 1 ? "class left" : "classes left"} style={{ fontSize: 11, fontWeight: "600", color: p.muted }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

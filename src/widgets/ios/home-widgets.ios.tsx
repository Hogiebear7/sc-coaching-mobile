"use no memo";

// Widget layouts run in their own runtime without React; the React Compiler (on for the app) must leave them as plain functions.

import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { background, containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, progressViewStyle, shapes, tint, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

// The iPhone home-screen widgets (WidgetKit, through expo-widgets). Each layout runs in the widget's own isolated runtime, so it can't use
// hooks, imports from the app, or anything outside its own body: colours and wording are written out in each one. The app sends each widget
// its props (src/lib/widgets/native-bridge.ios.ts); the designs match the in-app previews (src/components/widgets/WidgetPreviews.tsx).
// "glass" props: a see-through background; on iOS 26 with the Home Screen set to Clear, the system makes every widget Liquid Glass anyway.

export type WaterWidgetProps = {
  date: string;
  loggedMl: number;
  targetMl: number;
  amountMl: number;
  /** What this widget's own button has added on `date`; the app sends the part it hasn't sent yet (lib/widgets/snapshot.ts waterToSync). */
  widgetAddedMl: number;
  glass: boolean;
  empty: boolean;
};

const WaterWidgetLayout = (props: WaterWidgetProps, env: WidgetEnvironment) => {
  "widget";
  const text = "#ffffff";
  const muted = props.glass ? "#ffffffe0" : "#ffffffa0";
  const water = "#5fb4e8";
  const bg = props.glass ? "#ffffff2e" : "#0a1526";
  const litres = (ml: number) => `${(ml / 1000).toFixed(1)} L`;
  const p = props.targetMl > 0 ? Math.min(1, props.loggedMl / props.targetMl) : 0;
  if (props.empty) {
    return (
      <VStack modifiers={[containerBackground(bg, "widget"), widgetURL("sccoachingmobile://nutrition")]}>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text)]}>Open S&amp;C to set up</Text>
      </VStack>
    );
  }
  if (env.widgetFamily === "accessoryCircular") {
    return (
      <VStack modifiers={[widgetURL("sccoachingmobile://nutrition")]}>
        <Image systemName="drop.fill" size={12} />
        <Text modifiers={[font({ size: 13, weight: "bold" }), monospacedDigit()]}>{(props.loggedMl / 1000).toFixed(1)}</Text>
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, "widget"), widgetURL("sccoachingmobile://nutrition")]}>
      <HStack spacing={4}>
        <Image systemName="drop.fill" size={12} color={water} />
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(muted)]}>Water</Text>
      </HStack>
      <Text modifiers={[font({ size: 24, weight: "bold" }), monospacedDigit(), foregroundStyle(text)]}>{litres(props.loggedMl)}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>{props.targetMl > 0 ? `of ${litres(props.targetMl)}` : "today"}</Text>
      {props.targetMl > 0 ? <ProgressView value={p} modifiers={[progressViewStyle("linear"), tint(water)]} /> : null}
      <Spacer />
      <Button
        label={`+${props.amountMl} ml`}
        target="add-water"
        modifiers={[tint(water), frame({ maxWidth: 1000 })]}
        onPress={() => ({ ...props, loggedMl: props.loggedMl + props.amountMl, widgetAddedMl: props.widgetAddedMl + props.amountMl })}
      />
    </VStack>
  );
};
export const WaterWidget = createWidget("WaterWidget", WaterWidgetLayout);

export type NutritionWidgetProps = {
  calories: number;
  targetCalories: number;
  proteinG: number;
  targetProteinG: number;
  glass: boolean;
  empty: boolean;
};

const NutritionWidgetLayout = (props: NutritionWidgetProps) => {
  "widget";
  const text = "#ffffff";
  const muted = props.glass ? "#ffffffe0" : "#ffffffa0";
  const accent = props.glass ? "#ffffff" : "#c6a15b";
  const bg = props.glass ? "#ffffff2e" : "#0a1526";
  const n = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const left = props.targetCalories > 0 ? props.targetCalories - props.calories : null;
  if (props.empty) {
    return (
      <VStack modifiers={[containerBackground(bg, "widget"), widgetURL("sccoachingmobile://nutrition")]}>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text)]}>Open S&amp;C to set up</Text>
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={5} modifiers={[containerBackground(bg, "widget"), widgetURL("sccoachingmobile://log-food")]}>
      <HStack spacing={4}>
        <Image systemName="fork.knife" size={12} color={accent} />
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(muted)]}>Nutrition</Text>
      </HStack>
      <Text modifiers={[font({ size: 24, weight: "bold" }), monospacedDigit(), foregroundStyle(text)]}>{`${n(props.calories)} kcal`}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1), minimumScaleFactor(0.8)]}>
        {left === null ? "eaten today" : left >= 0 ? `${n(left)} left of ${n(props.targetCalories)}` : `${n(-left)} over`}
      </Text>
      {props.targetCalories > 0 ? <ProgressView value={Math.min(1, props.calories / props.targetCalories)} modifiers={[progressViewStyle("linear"), tint(accent)]} /> : null}
      <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>
        {props.targetProteinG > 0 ? `Protein ${props.proteinG} / ${props.targetProteinG} g` : `Protein ${props.proteinG} g`}
      </Text>
      <Spacer />
      <HStack spacing={4}>
        <Image systemName="plus.circle.fill" size={14} color={accent} />
        <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(accent)]}>Log food</Text>
      </HStack>
    </VStack>
  );
};
export const NutritionWidget = createWidget("NutritionWidget", NutritionWidgetLayout);

export type ClassWidgetProps = {
  title: string;
  /** "Today 18:30" etc., worked out by the app (the widget runtime has no locale formatting). Empty when nothing is booked. */
  when: string;
  classesLeft: number;
  hasClassesLeft: boolean;
  canBook: boolean;
  glass: boolean;
  empty: boolean;
};

const ClassWidgetLayout = (props: ClassWidgetProps) => {
  "widget";
  const text = "#ffffff";
  const muted = props.glass ? "#ffffffe0" : "#ffffffa0";
  const accent = props.glass ? "#ffffff" : "#c6a15b";
  const bg = props.glass ? "#ffffff2e" : "#0a1526";
  const box = props.glass ? "#ffffff33" : "#16243a";
  const booked = props.when !== "";
  return (
    <HStack spacing={12} modifiers={[containerBackground(bg, "widget"), widgetURL("sccoachingmobile://schedule")]}>
      <VStack alignment="leading" spacing={4}>
        <HStack spacing={4}>
          <Image systemName="calendar" size={12} color={accent} />
          <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(muted)]}>Next class</Text>
        </HStack>
        <Spacer />
        <Text modifiers={[font({ size: 19, weight: "bold" }), foregroundStyle(text), lineLimit(1), minimumScaleFactor(0.75)]}>
          {props.empty ? "Open S&C to set up" : booked ? props.title : props.canBook ? "Nothing booked" : "No membership yet"}
        </Text>
        <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(booked ? accent : muted)]}>
          {booked ? props.when : props.canBook ? "Tap to book a class" : "Tap to see classes"}
        </Text>
        <Spacer />
        {booked && props.canBook ? <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(accent)]}>Book another</Text> : null}
      </VStack>
      <Spacer />
      {props.hasClassesLeft ? (
        <VStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 10 }), background(box, shapes.roundedRectangle({ cornerRadius: 14 }))]}>
          <Text modifiers={[font({ size: 28, weight: "heavy" }), monospacedDigit(), foregroundStyle(text)]}>{String(props.classesLeft)}</Text>
          <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(muted)]}>{props.classesLeft === 1 ? "class left" : "classes left"}</Text>
        </VStack>
      ) : null}
    </HStack>
  );
};
export const ClassWidget = createWidget("ClassWidget", ClassWidgetLayout);
